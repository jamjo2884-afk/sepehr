import type { SocialPlatform } from '@/types/domain';
import type {
  NormalizedSocialMetric,
  SocialAccount,
  SocialConnectionStatus,
  SocialMetricPeriod,
  SocialSyncRunStatus,
} from '@/types/social';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type {
  SocialCredential,
  SocialPlatformConnector,
} from '@/services/connectors/types';
import { sanitizeErrorMessage } from '@/services/connectors/utils';
import { SOCIAL_ENGAGEMENT_RATE_CAP } from '@/services/social-score';

/**
 * Central sync service.
 *
 * Flow (per account):
 *   1. load the social_account
 *   2. resolve its connector from the registry
 *   3. resolve the server-side credential (env) — missing ⇒ explicit error
 *   4. verify the connection (updates connection_status)
 *   5. fetch + normalize (the connector returns NormalizedSocialMetric)
 *   6. validate (no negatives, engagement rate within 0..100)
 *   7. upsert via recordSocialMetrics (merge keeps stored values, no dupes)
 *   8. write a social_sync_logs row and update the account's last-sync fields
 *
 * Credentials never leave the server; error messages are sanitized so a
 * token can never leak into logs or the UI.
 */

/** Result of one sync run (safe to return to the client). */
export interface SocialSyncResult {
  ok: boolean;
  accountId: string;
  recordsFetched: number;
  recordsWritten: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Validation outcome of one normalized metric. */
interface ValidationResult {
  ok: boolean;
  error: string | null;
}

/** Values that must be non-negative counts. */
const COUNT_KEYS = new Set([
  'followers',
  'following',
  'posts',
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'reach',
  'impressions',
  'storyViews',
  'channelMembers',
  'retweets',
  'subscribers',
]);

/**
 * Validate a normalized metric: reject negative counts and engagement
 * rates outside 0..100. Returns ok + the first error message (Persian,
 * technical detail limited — no secrets).
 */
export function validateNormalizedMetric(
  metric: NormalizedSocialMetric,
): ValidationResult {
  for (const [key, value] of Object.entries(metric.values)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (COUNT_KEYS.has(key) && value < 0) {
      return {
        ok: false,
        error: `مقدار «${SOCIAL_METRIC_FIELDS[key as keyof typeof SOCIAL_METRIC_FIELDS]?.label ?? key}» نمی‌تواند منفی باشد.`,
      };
    }
    if (
      key === 'engagementRate' &&
      (value < 0 || value > SOCIAL_ENGAGEMENT_RATE_CAP * 10)
    ) {
      return {
        ok: false,
        error: 'نرخ تعامل باید بین ۰ تا ۱۰۰ باشد.',
      };
    }
  }
  return { ok: true, error: null };
}

/** Insert a sync log row and return its id. */
async function writeSyncLog(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  entry: {
    accountId: string;
    platform: SocialPlatform;
    status: SocialSyncRunStatus;
    recordsFetched: number;
    recordsWritten: number;
    errorCode: string | null;
    errorMessage: string | null;
  },
): Promise<void> {
  await supabase.from('social_sync_logs').insert({
    social_account_id: entry.accountId,
    platform: entry.platform,
    started_at: new Date().toISOString(),
    status: entry.status,
    records_fetched: entry.recordsFetched,
    records_written: entry.recordsWritten,
    error_code: entry.errorCode,
    error_message: entry.errorMessage,
  });
}

/** Update the account's connection + last-sync columns. */
async function updateAccountSyncState(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  state: {
    connectionStatus: SocialConnectionStatus;
    syncStatus: SocialSyncRunStatus;
  },
): Promise<void> {
  const patch: Record<string, string | null> = {
    connection_status: state.connectionStatus,
    last_sync_status: state.syncStatus,
    last_sync_at: new Date().toISOString(),
  };
  if (state.syncStatus === 'success') {
    patch.last_successful_sync_at = new Date().toISOString();
  }
  await supabase.from('social_accounts').update(patch).eq('id', accountId);
}

/**
 * Run one full sync for an account. `period` defaults to 'daily' (a
 * point-in-time snapshot from the platform API).
 */
export async function syncSocialAccount(
  accountId: string,
  options: {
    period?: SocialMetricPeriod;
    connector?: SocialPlatformConnector;
    credential?: SocialCredential | null;
  } = {},
): Promise<SocialSyncResult> {
  const { supabase } = await import('@/lib/supabase');

  // 1. Load the account.
  const { data: accountData, error: accountError } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  if (accountError || !accountData) {
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'account_not_found',
      errorMessage: 'حساب یافت نشد.',
    };
  }
  const account = accountData as unknown as SocialAccount;

  // 2. Resolve the connector.
  const { resolveConnector } = await import('@/services/connectors/registry');
  const connector = options.connector ?? resolveConnector(account.platform);
  if (!connector) {
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'connector_not_available',
      errorMessage:
        'برای این پلتفرم هنوز اتصال‌دهنده (Connector) ثبت نشده است.',
    });
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'connector_not_available',
      errorMessage:
        'برای این پلتفرم هنوز اتصال‌دهنده (Connector) ثبت نشده است.',
    };
  }

  // 3. Resolve the credential (server-side env only).
  const { getPlatformCredential } =
    await import('@/lib/server/social-credentials');
  const credential =
    options.credential !== undefined
      ? options.credential
      : getPlatformCredential(account.platform);
  if (!credential) {
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'credential_not_configured',
      errorMessage:
        'برای این پلتفرم اعتبارنامه‌ای (Credential) پیکربندی نشده است.',
    });
    await updateAccountSyncState(supabase, accountId, {
      connectionStatus: 'disconnected',
      syncStatus: 'error',
    });
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'credential_not_configured',
      errorMessage: 'برای این پلتفرم اعتبارنامه‌ای پیکربندی نشده است.',
    };
  }

  // 4. Verify the connection (may be expensive; still the source of truth).
  const ctx = { credential, account, now: new Date() };
  let verification;
  try {
    verification = await connector.verifyConnection(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطای اتصال';
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'verify_failed',
      errorMessage: sanitizeErrorMessage(message, [credential.secret]),
    });
    await updateAccountSyncState(supabase, accountId, {
      connectionStatus: 'error',
      syncStatus: 'error',
    });
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'verify_failed',
      errorMessage: 'همگام‌سازی انجام نشد.',
    };
  }

  if (!verification.ok) {
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: verification.errorCode ?? 'verify_failed',
      errorMessage: sanitizeErrorMessage(
        verification.errorMessage ?? 'اتصال تأیید نشد.',
        [credential.secret],
      ),
    });
    await updateAccountSyncState(supabase, accountId, {
      connectionStatus: 'error',
      syncStatus: 'error',
    });
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: verification.errorCode ?? 'verify_failed',
      errorMessage: 'همگام‌سازی انجام نشد.',
    };
  }

  await updateAccountSyncState(supabase, accountId, {
    connectionStatus: 'connected',
    syncStatus: 'running',
  });

  // 5–6. Fetch, normalize (done by the connector), validate.
  let fetched: NormalizedSocialMetric[] = [];
  try {
    fetched = await connector.fetchAccountMetrics(
      ctx,
      options.period ?? 'daily',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطای دریافت داده';
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'fetch_failed',
      errorMessage: sanitizeErrorMessage(message, [credential.secret]),
    });
    await updateAccountSyncState(supabase, accountId, {
      connectionStatus: 'connected',
      syncStatus: 'error',
    });
    return {
      ok: false,
      accountId,
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode: 'fetch_failed',
      errorMessage: 'همگام‌سازی انجام نشد.',
    };
  }

  // Keep only valid rows; count how many were dropped.
  let recordsFetched = 0;
  let recordsWritten = 0;
  let firstError: string | null = null;
  const valid: NormalizedSocialMetric[] = [];
  for (const metric of fetched) {
    recordsFetched += 1;
    const check = validateNormalizedMetric(metric);
    if (check.ok) {
      valid.push(metric);
    } else if (!firstError) {
      firstError = check.error;
    }
  }

  // 7. Upsert via the existing record path (merge + unique constraint).
  const { recordSocialMetrics } = await import('@/services/social.service');
  for (const metric of valid) {
    const written = await recordSocialMetrics(
      accountId,
      metric.period,
      metric.values,
      {
        periodLabel: metric.periodLabel,
      },
    );
    if (written) recordsWritten += 1;
  }

  // 8. Log + account state.
  await writeSyncLog(supabase, {
    accountId,
    platform: account.platform,
    status: 'success',
    recordsFetched,
    recordsWritten,
    errorCode: null,
    errorMessage: null,
  });
  await updateAccountSyncState(supabase, accountId, {
    connectionStatus: 'connected',
    syncStatus: 'success',
  });

  if (firstError) {
    return {
      ok: true,
      accountId,
      recordsFetched,
      recordsWritten,
      errorCode: 'partial_validation',
      errorMessage: firstError,
    };
  }
  return {
    ok: true,
    accountId,
    recordsFetched,
    recordsWritten,
    errorCode: null,
    errorMessage: null,
  };
}

/** Latest sync log rows for a set of accounts (for the accounts page). */
export async function getLatestSyncLogs(
  accountIds: string[],
  limitPerAccount = 5,
): Promise<Record<string, unknown[]>> {
  const { supabase } = await import('@/lib/supabase');
  const out: Record<string, unknown[]> = {};
  for (const id of accountIds) {
    const { data } = await supabase
      .from('social_sync_logs')
      .select('*')
      .eq('social_account_id', id)
      .order('started_at', { ascending: false })
      .limit(limitPerAccount);
    out[id] = data ?? [];
  }
  return out;
}
