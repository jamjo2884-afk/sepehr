import type { SupabaseClient } from '@supabase/supabase-js';
import { getSocialAccounts, METRIC_COLUMN_BY_KEY } from '@/services/social.service';
import { matchImportRowToAccount } from '@/services/social-import/match';
import { periodRangeForLabel, weeklyRangeForDate } from '@/services/social-metrics';
import { PLATFORM_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import type {
  SocialMetricImportRow,
  SocialImportSummary,
} from '@/services/social-import/types';
import type { SocialAccount, SocialMetricValues } from '@/types/social';
import { normalizeAccountStatus } from '@/services/social-import/normalize';

/**
 * Bulk-import service — optimized for batch operations.
 *
 * 1. Batch-creates missing accounts (single Supabase insert)
 * 2. Batch-upserts all metrics grouped by (period, period_label)
 */

export interface ImportedRowResult {
  rowNumber: number;
  ok: boolean;
  errorMessage: string | null;
}

/** Progress callback fired during import. */
export type ImportProgressCallback = (progress: {
  phase: 'accounts' | 'resolving' | 'metrics';
  current: number;
  total: number;
  message: string;
}) => void;

/** Pre-check which period keys already exist. */
async function existingKeys(
  supabase: SupabaseClient,
  rows: Array<{ accountId: string; period: string; periodLabel: string }>,
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (rows.length === 0) return keys;
  const accountIds = [...new Set(rows.map((r) => r.accountId))];
  const { data, error } = await supabase
    .from('social_metrics')
    .select('account_id, period, period_label')
    .in('account_id', accountIds);
  if (error) return keys;
  for (const r of data ?? []) {
    keys.add(`${r.account_id}|${r.period}|${r.period_label}`);
  }
  return keys;
}

/**
 * Batch-create accounts that don't exist yet.
 * Returns a map of platform|username → SocialAccount for ALL accounts.
 */
async function batchEnsureAccounts(
  supabase: SupabaseClient,
  rows: SocialMetricImportRow[],
  existingAccounts: SocialAccount[],
): Promise<Map<string, SocialAccount>> {
  const accountMap = new Map<string, SocialAccount>();
  for (const a of existingAccounts) {
    accountMap.set(`${a.platform}|${a.username}`, a);
  }

  // Collect unique missing accounts
  const needed = new Map<string, {
    brand: string;
    platform: string;
    username: string;
    link?: string | null;
    sourceStatus?: string | null;
  }>();

  for (const row of rows) {
    if (!row.accountIdentifier || !row.brand) continue;
    const key = `${row.platform}|${row.accountIdentifier}`;
    if (!needed.has(key) && !accountMap.has(key)) {
      needed.set(key, {
        brand: row.brand,
        platform: row.platform,
        username: row.accountIdentifier,
        link: row.link,
        sourceStatus: row.sourceStatus,
      });
    }
  }

  if (needed.size === 0) return accountMap;

  // Batch insert all missing accounts in ONE query
  const newRows = [...needed.values()].map((acc) => ({
    brand: acc.brand.trim(),
    platform: acc.platform,
    username: acc.username.trim(),
    display_name: null,
    url: acc.link?.trim() || null,
    status: normalizeAccountStatus(acc.sourceStatus ?? '') ?? 'active',
  }));

  const { data: inserted, error } = await supabase
    .from('social_accounts')
    .insert(newRows)
    .select();

  if (error) {
    console.warn('[social-import] Batch insert accounts failed, falling back to individual.', error);
    // Fallback: try individual inserts
    for (const [key, acc] of needed) {
      if (accountMap.has(key)) continue;
      try {
        const { data, error: insErr } = await supabase
          .from('social_accounts')
          .insert({
            brand: acc.brand.trim(),
            platform: acc.platform,
            username: acc.username.trim(),
            display_name: null,
            url: acc.link?.trim() || null,
            status: normalizeAccountStatus(acc.sourceStatus ?? '') ?? 'active',
          })
          .select()
          .single();
        if (!insErr && data) {
          accountMap.set(key, data as unknown as SocialAccount);
        }
      } catch {
        // Skip
      }
    }
  } else {
    for (const row of inserted ?? []) {
      const key = `${row.platform}|${row.username}`;
      accountMap.set(key, row as unknown as SocialAccount);
    }
  }

  return accountMap;
}

/**
 * Commit validated import rows — batch-optimized.
 */
export async function importSocialMetricsRows(
  rows: SocialMetricImportRow[],
  options: {
    accounts?: SocialAccount[];
    supabase?: SupabaseClient;
    onProgress?: ImportProgressCallback;
  } = {},
): Promise<SocialImportSummary> {
  const accounts = options.accounts ?? (await getSocialAccounts());
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const onProgress = options.onProgress ?? (() => {});

  // Step 1: Batch-create missing accounts
  onProgress({ phase: 'accounts', current: 0, total: 1, message: 'در حال ساخت حساب‌ها...' });
  const accountMap = await batchEnsureAccounts(supabase, rows, accounts);
  const totalAccounts = [...accountMap.values()].length;
  const newAccounts = totalAccounts - accounts.length;
  onProgress({ phase: 'accounts', current: 1, total: 1, message: newAccounts > 0 ? `${newAccounts} حساب جدید ساخته شد` : 'حساب‌ها آماده‌اند' });

  // Step 2: Resolve every row to an account
  onProgress({ phase: 'resolving', current: 0, total: rows.length, message: 'در حال شناسایی حساب‌ها...' });
  const allAccounts = [...accountMap.values()];
  const resolved: Array<{
    row: SocialMetricImportRow;
    account: SocialAccount | null;
    error: string | null;
  }> = rows.map((row) => {
    if (row.resolvedAccountId) {
      const found = allAccounts.find((a) => a.id === row.resolvedAccountId);
      if (!found) return { row, account: null, error: 'Account پیدا نشد.' };
      if (found.platform !== row.platform) {
        return { row, account: null, error: 'حساب انتخاب‌شده متعلق به این پلتفرم نیست.' };
      }
      return { row, account: found, error: null };
    }

    const key = `${row.platform}|${row.accountIdentifier}`;
    const directMatch = accountMap.get(key);
    if (directMatch) {
      return { row, account: directMatch, error: null };
    }

    const result = matchImportRowToAccount(allAccounts, row);
    if (result.status === 'matched') {
      return { row, account: result.account, error: null };
    }
    const errorMsg =
      result.status === 'empty'
        ? 'شناسهٔ حساب وارد نشده است.'
        : result.status === 'ambiguous'
          ? 'حساب یکتا پیدا نشد.'
          : 'حسابی با این شناسه یافت نشد.';
    return { row, account: null, error: errorMsg };
  });

  onProgress({ phase: 'resolving', current: rows.length, total: rows.length, message: 'شناسایی حساب‌ها تکمیل شد' });

  const rejected: Array<{ rowNumber: number; message: string }> = [];
  for (const r of resolved) {
    if (!r.account || r.error) {
      rejected.push({ rowNumber: r.row.rowNumber, message: r.error ?? 'حساب یافت نشد.' });
      continue;
    }
    for (const err of r.row.errors) {
      rejected.push({ rowNumber: r.row.rowNumber, message: err });
    }
  }

  const toCommit = resolved.filter(
    (r) => r.account && r.error === null && r.row.errors.length === 0,
  );

  // Pre-check existing keys
  const existing = await existingKeys(
    supabase,
    toCommit.map((r) => ({
      accountId: r.account!.id,
      period: r.row.period,
      periodLabel: r.row.periodLabel,
    })),
  );

  // Step 3: Batch upsert metrics — group by (period, period_label)
  const groups = new Map<string, typeof toCommit>();
  for (const r of toCommit) {
    const groupKey = `${r.row.period}|${r.row.periodLabel}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(r);
  }

  // Fetch all existing metric rows for the accounts we're updating
  const accountIds = [...new Set(toCommit.map((r) => r.account!.id))];
  const { data: allExistingMetrics } = await supabase
    .from('social_metrics')
    .select('*')
    .in('account_id', accountIds);

  const existingMetricsByKey = new Map<string, Record<string, unknown>>();
  for (const m of allExistingMetrics ?? []) {
    existingMetricsByKey.set(
      `${m.account_id}|${m.period}|${m.period_label}`,
      m as Record<string, unknown>,
    );
  }

  let inserted = 0;
  let updated = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [...rejected];
  const totalGroups = groups.size;
  let groupIndex = 0;
  let rowsProcessed = 0;
  const totalMetricRows = toCommit.length;

  onProgress({ phase: 'metrics', current: 0, total: totalMetricRows, message: 'در حال ثبت آمار...' });

  for (const [groupKey, groupRows] of groups) {
    const sep = groupKey.indexOf('|');
    const period = groupKey.substring(0, sep);
    const periodLabel = groupKey.substring(sep + 1);

    const date = new Date();
    const range =
      period === 'weekly'
        ? weeklyRangeForDate(date)
        : periodRangeForLabel(period as 'daily' | 'weekly' | 'monthly', periodLabel);

    const upsertRows: Array<Record<string, number | string | null>> = [];

    for (const { row, account } of groupRows) {
      const acc = account!;
      const existingKey = `${acc.id}|${period}|${periodLabel}`;
      const existingRow = existingMetricsByKey.get(existingKey) ?? null;
      const supported = new Set(PLATFORM_METRIC_FIELDS[acc.platform]);

      const metricRow: Record<string, number | string | null> = {
        account_id: acc.id,
        period,
        period_label: periodLabel,
        period_start: range?.start ?? null,
        period_end: range?.end ?? null,
      };

      const values: SocialMetricValues = row.values;
      for (const [key, column] of Object.entries(METRIC_COLUMN_BY_KEY)) {
        const typedKey = key as keyof SocialMetricValues;
        const value = values[typedKey];
        if (supported.has(key as SocialMetricFieldKey)) {
          metricRow[column] =
            value ?? (existingRow?.[column] as number | string | null) ?? null;
        } else {
          metricRow[column] =
            (existingRow?.[column] as number | string | null) ??
            (key === 'followers' ? 0 : null);
        }
      }
      if (metricRow.followers === null) metricRow.followers = 0;
      upsertRows.push(metricRow);
    }

    // Single batch upsert for this group
    const { error: upsertError } = await supabase
      .from('social_metrics')
      .upsert(upsertRows, { onConflict: 'account_id,period,period_label' });

    if (upsertError) {
      console.warn('[social-import] Batch upsert failed for group', groupKey, upsertError);
      for (const { row: r } of groupRows) {
        errors.push({ rowNumber: r.rowNumber, message: 'ثبت آمار انجام نشد.' });
      }
    } else {
      for (const { account: acc } of groupRows) {
        const checkKey = `${acc!.id}|${period}|${periodLabel}`;
        if (existing.has(checkKey)) updated += 1;
        else inserted += 1;
      }
    }

    rowsProcessed += groupRows.length;
    groupIndex++;
    onProgress({
      phase: 'metrics',
      current: rowsProcessed,
      total: totalMetricRows,
      message: `گروه ${groupIndex} از ${totalGroups} — ردیف ${rowsProcessed} از ${totalMetricRows}`,
    });
  }

  return {
    total: rows.length,
    inserted,
    updated,
    rejected: errors.length,
    duplicate: 0,
    errors,
  };
}
