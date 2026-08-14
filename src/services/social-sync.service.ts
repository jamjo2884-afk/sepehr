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
 * token can never leak into logs or the UI. One account can never run two
 * syncs at once (in-flight guard). Sync-all runs with a bounded concurrency.
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

/** Accounts currently being synced — one account can never run two syncs. */
const inflightAccounts = new Set<string>();

/** Insert a sync log row with a real duration (started_at → finished_at). */
async function writeSyncLog(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  entry: {
    accountId: string;
    platform: SocialPlatform;
    startedAt: Date;
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
    started_at: entry.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
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

/** Result returned when an account is already being synced. */
function alreadyRunning(accountId: string): SocialSyncResult {
  return {
    ok: false,
    accountId,
    recordsFetched: 0,
    recordsWritten: 0,
    errorCode: 'already_running',
    errorMessage: 'همگام‌سازی این حساب در حال انجام است.',
  };
}

/**
 * Run one full sync for an account. `period` defaults to 'daily' (a
 * point-in-time snapshot from the platform API). Rejects concurrent runs
 * for the same account with `already_running`.
 */
/** Injected dependencies for one sync run (tests / scheduler reuse). */
export interface SocialSyncDeps {
  period?: SocialMetricPeriod;
  connector?: SocialPlatformConnector;
  credential?: SocialCredential | null;
  /**
   * Optional pre-resolved client. When omitted the service imports
   * `@/lib/supabase` itself. Sync-all resolves it once and shares it with
   * every worker so a run never triggers many concurrent module imports.
   */
  supabase?: import('@supabase/supabase-js').SupabaseClient;
}

export async function syncSocialAccount(
  accountId: string,
  options: SocialSyncDeps = {},
): Promise<SocialSyncResult> {
  if (inflightAccounts.has(accountId)) return alreadyRunning(accountId);
  inflightAccounts.add(accountId);
  try {
    return await runSync(accountId, options);
  } finally {
    inflightAccounts.delete(accountId);
  }
}

/** The actual sync pipeline (guarded by `syncSocialAccount`). */
async function runSync(
  accountId: string,
  options: SocialSyncDeps,
): Promise<SocialSyncResult> {
  const startedAt = new Date();
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;

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
      startedAt,
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
      startedAt,
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
      startedAt,
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
    const errorCode = verification.errorCode ?? 'verify_failed';
    await writeSyncLog(supabase, {
      accountId,
      platform: account.platform,
      startedAt,
      status: 'error',
      recordsFetched: 0,
      recordsWritten: 0,
      errorCode,
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
      errorCode,
      // Safe-to-show Persian message; raw API detail stays in the log.
      errorMessage: friendlySyncError(errorCode),
    };
  }

  // Account discovery: persist the platform's own account id when the
  // connector verified it (never guessed by us).
  if (verification.account?.externalId) {
    await supabase
      .from('social_accounts')
      .update({ external_id: verification.account.externalId })
      .eq('id', accountId);
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
      startedAt,
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
        supabase,
      },
    );
    if (written) recordsWritten += 1;
  }

  // 8. Log + account state.
  await writeSyncLog(supabase, {
    accountId,
    platform: account.platform,
    startedAt,
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

/**
 * Map a structured connector error code to a safe Persian message for the
 * UI. Unknown codes fall back to a generic message — technical detail is
 * never exposed to the user.
 */
function friendlySyncError(errorCode: string): string {
  switch (errorCode) {
    case 'bot_not_in_chat':
      return 'ربات به این کانال دسترسی ندارد. لطفاً ربات را به کانال اضافه کنید.';
    case 'invalid_credential':
      return 'اعتبار اتصال نامعتبر است.';
    case 'bot_forbidden':
      return 'ربات اجازهٔ دسترسی به این حساب را ندارد.';
    case 'token_expired':
      return 'نشست دسترسی منقضی شده است. لطفاً دوباره اتصال برقرار کنید.';
    case 'no_business_account':
      return 'این توکن به حساب تجاری (Business/Creator) اینستاگرام متصل نیست.';
    case 'permission_denied':
      return 'ربات یا حساب به این کانال/حساب دسترسی ندارد.';
    case 'rate_limited':
      return 'محدودیت درخواست API فعال شده است. بعداً دوباره تلاش کنید.';
    default:
      return 'همگام‌سازی انجام نشد.';
  }
}

/* =========================================================================
 * Sync All (bounded concurrency)
 * ========================================================================= */

/** How many accounts are synced at once during "sync all". */
export const SYNC_ALL_CONCURRENCY = 3;

/** Result of a sync-all run. */
export interface SyncAllResult {
  success: number;
  failed: number;
  skipped: number;
  total: number;
  results: Array<{
    accountId: string;
    ok: boolean;
    errorCode: string | null;
    errorMessage: string | null;
  }>;
}

/**
 * Sync every account whose `connection_status` is 'connected'. Accounts
 * that are not connected (never configured / disconnected / error) are
 * skipped, never attempted. Runs with `SYNC_ALL_CONCURRENCY` workers.
 * `options` is for tests / scheduler reuse (connector + credential
 * injection); production callers rely on the registry + env.
 */
export async function syncAllConnectedAccounts(
  options: SocialSyncDeps = {},
): Promise<SyncAllResult> {
  // Resolve the client once and share it with every worker. Each worker
  // importing `@/lib/supabase` on its own would trigger many concurrent
  // module loads (and is unreliable under vitest's mock runner); one
  // resolution per run is also cheaper.
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const { getSocialAccounts } = await import('@/services/social.service');
  const accounts = await getSocialAccounts();

  const connected = accounts.filter((a) => a.connectionStatus === 'connected');
  const skipped = accounts.length - connected.length;
  const results: SyncAllResult['results'] = [];
  let success = 0;
  let failed = 0;

  let index = 0;
  const workers = Array.from(
    { length: Math.min(SYNC_ALL_CONCURRENCY, connected.length) },
    async () => {
      while (index < connected.length) {
        const account = connected[index++];
        const result = await syncSocialAccount(account.id, {
          connector: options.connector,
          credential: options.credential,
          supabase,
        });
        results.push({
          accountId: account.id,
          ok: result.ok,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
        if (result.ok) success += 1;
        else failed += 1;
      }
    },
  );
  await Promise.all(workers);

  return { success, failed, skipped, total: accounts.length, results };
}

/* =========================================================================
 * Sync overview — platform summary, health, recent syncs
 * ========================================================================= */

/** Minimum number of completed syncs before health is reported. */
export const SYNC_HEALTH_MIN_SAMPLE = 3;

/** Health of the sync pipeline over recent runs (pure, testable). */
export interface SyncHealth {
  /** Success % (0–100), or null when there is not enough data. */
  rate: number | null;
  total: number;
  success: number;
  failed: number;
}

/**
 * Compute sync health from a list of log statuses. NULL when fewer than
 * `SYNC_HEALTH_MIN_SAMPLE` runs completed — the UI shows '—' then.
 */
export function calculateSyncHealth(
  logs: Array<{ status: SocialSyncRunStatus }>,
): SyncHealth {
  const success = logs.filter((l) => l.status === 'success').length;
  const failed = logs.filter((l) => l.status === 'error').length;
  const total = success + failed;
  if (total < SYNC_HEALTH_MIN_SAMPLE) {
    return { rate: null, total, success, failed };
  }
  return {
    rate: Math.round((success / total) * 100),
    total,
    success,
    failed,
  };
}

/** Per-platform summary used by the control center header. */
export interface SyncOverviewPlatform {
  platform: SocialPlatform;
  accounts: number;
  connected: number;
  error: number;
  disconnected: number;
  pending: number;
  /** Accounts that can never sync right now (credential missing). */
  notConfigured: number;
  /** Whether the platform's server-side credential is configured. */
  credentialConfigured: boolean;
}

/** One recent sync log joined with its account (for the UI table). */
export interface SyncOverviewRecent {
  id: string;
  accountId: string;
  brand: string;
  platform: SocialPlatform;
  username: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: SocialSyncRunStatus;
  recordsFetched: number;
  recordsWritten: number;
  errorCode: string | null;
  errorMessage: string | null;
  /** durationMs = finished_at - started_at, null when missing. */
  durationMs: number | null;
}

/** Everything the control center needs in one round trip. */
export interface SyncOverview {
  platforms: SyncOverviewPlatform[];
  health: SyncHealth;
  recent: SyncOverviewRecent[];
  /** Latest log per account id (null when the account never synced). */
  latestLogByAccount: Record<string, SyncOverviewRecent | null>;
}

/** Convert ASCII digits to Persian digits. */
const toPersianDigits = (input: string): string =>
  input.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** Human duration like '۲٫۴ ثانیه' (Persian digits). */
export function formatSyncDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${toPersianDigits(String(Math.round(ms)))} میلی‌ثانیه`;
  return `${toPersianDigits((ms / 1000).toFixed(1).replace('.', '٫'))} ثانیه`;
}

interface SyncLogRow {
  id: number | string;
  social_account_id: string;
  platform: SocialPlatform;
  started_at: string | null;
  finished_at: string | null;
  status: SocialSyncRunStatus;
  records_fetched: number;
  records_written: number;
  error_code: string | null;
  error_message: string | null;
}

/**
 * Build the control-center overview from the live `social_sync_logs` +
 * `social_accounts` data. One read of each table — no N+1.
 */
export async function getSyncOverview(): Promise<SyncOverview> {
  const { getSocialAccounts } = await import('@/services/social.service');
  const { isPlatformCredentialConfigured } =
    await import('@/lib/server/social-credentials');
  const { supabase } = await import('@/lib/supabase');

  const [accounts, logResult] = await Promise.all([
    getSocialAccounts(),
    supabase
      .from('social_sync_logs')
      .select(
        'id, social_account_id, platform, started_at, finished_at, status, ' +
          'records_fetched, records_written, error_code, error_message',
      )
      .order('started_at', { ascending: false })
      .limit(500),
  ]);
  const rows = (logResult.data ?? []) as unknown as SyncLogRow[];

  const byAccount = new Map<string, SocialAccount>();
  for (const a of accounts) byAccount.set(a.id, a);

  const platformsMap = new Map<SocialPlatform, SyncOverviewPlatform>();
  for (const account of accounts) {
    const p =
      platformsMap.get(account.platform) ??
      ({
        platform: account.platform,
        accounts: 0,
        connected: 0,
        error: 0,
        disconnected: 0,
        pending: 0,
        notConfigured: 0,
        credentialConfigured: isPlatformCredentialConfigured(account.platform),
      } satisfies SyncOverviewPlatform);
    p.accounts += 1;
    switch (account.connectionStatus) {
      case 'connected':
        p.connected += 1;
        break;
      case 'error':
        p.error += 1;
        break;
      case 'pending':
        p.pending += 1;
        break;
      default:
        p.disconnected += 1;
        break;
    }
    // Never connected + no credential ⇒ cannot sync right now.
    if (!p.credentialConfigured && account.connectionStatus !== 'connected') {
      p.notConfigured += 1;
    }
    platformsMap.set(account.platform, p);
  }
  const platforms = [...platformsMap.values()].sort((a, b) =>
    a.platform.localeCompare(b.platform),
  );

  const recent: SyncOverviewRecent[] = rows.map((row) => {
    const account = byAccount.get(row.social_account_id);
    const started = row.started_at ? new Date(row.started_at) : null;
    const finished = row.finished_at ? new Date(row.finished_at) : null;
    return {
      id: String(row.id),
      accountId: row.social_account_id,
      brand: account?.brand ?? '—',
      platform: row.platform,
      username: account?.username ?? '—',
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      recordsFetched: row.records_fetched,
      recordsWritten: row.records_written,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      durationMs:
        started && finished && finished >= started
          ? finished.getTime() - started.getTime()
          : null,
    };
  });

  const latestLogByAccount: Record<string, SyncOverviewRecent | null> = {};
  for (const item of recent) {
    if (!(item.accountId in latestLogByAccount)) {
      latestLogByAccount[item.accountId] = item;
    }
  }
  for (const a of accounts) {
    if (!(a.id in latestLogByAccount)) latestLogByAccount[a.id] = null;
  }

  return {
    platforms,
    health: calculateSyncHealth(recent),
    recent: recent.slice(0, 20),
    latestLogByAccount,
  };
}

/** Latest sync log rows for a set of accounts (for the accounts page). */
export async function getLatestSyncLogs(
  accountIds: string[],
  limitPerAccount = 5,
): Promise<Record<string, SyncOverviewRecent[]>> {
  const { supabase } = await import('@/lib/supabase');
  const out: Record<string, SyncOverviewRecent[]> = {};
  for (const id of accountIds) {
    const { data } = await supabase
      .from('social_sync_logs')
      .select(
        'id, social_account_id, platform, started_at, finished_at, status, ' +
          'records_fetched, records_written, error_code, error_message',
      )
      .eq('social_account_id', id)
      .order('started_at', { ascending: false })
      .limit(limitPerAccount);
    out[id] = ((data ?? []) as unknown as SyncLogRow[]).map((row) => {
      const started = row.started_at ? new Date(row.started_at) : null;
      const finished = row.finished_at ? new Date(row.finished_at) : null;
      return {
        id: String(row.id),
        accountId: id,
        brand: '—',
        platform: row.platform,
        username: '—',
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
        recordsFetched: row.records_fetched,
        recordsWritten: row.records_written,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        durationMs:
          started && finished && finished >= started
            ? finished.getTime() - started.getTime()
            : null,
      };
    });
  }
  return out;
}
