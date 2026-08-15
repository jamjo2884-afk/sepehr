import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recordSocialMetrics,
  getSocialAccounts,
} from '@/services/social.service';
import { matchImportRowToAccount } from '@/services/social-import/match';
import type {
  SocialMetricImportRow,
  SocialImportSummary,
} from '@/services/social-import/types';
import type { SocialAccount } from '@/types/social';

/**
 * Bulk-import service.
 *
 * Takes fully parsed + validated rows (from the parser/validator) and
 * commits them through the SAME path as the manual form:
 *
 *   row → account matching → recordSocialMetrics() → social_metrics
 *
 * No direct `supabase.from('social_metrics').insert()` anywhere — the
 * standard service preserves the NULL-merge and duplicate-prevention
 * behavior of the manual entry path, so an import can never wipe existing
 * metrics or create duplicate (account, period, label) rows.
 *
 * The summary distinguishes newly inserted rows from updated ones by
 * checking which (account_id, period, period_label) keys already exist
 * before committing.
 */

/** Committed row + its outcome. */
export interface ImportedRowResult {
  rowNumber: number;
  ok: boolean;
  errorMessage: string | null;
}

/** Pre-check which period keys already exist for the given accounts. */
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
  if (error) {
    // If the pre-check fails, fall back to treating every row as inserted.
    return keys;
  }
  for (const r of data ?? []) {
    keys.add(`${r.account_id}|${r.period}|${r.period_label}`);
  }
  return keys;
}

/**
 * Commit validated import rows to `social_metrics` through
 * `recordSocialMetrics`. Rows that fail account matching are skipped and
 * reported as rejected.
 *
 * `accounts` and `supabase` are optional injections (used by tests); by
 * default the service fetches the real accounts and client.
 */
export async function importSocialMetricsRows(
  rows: SocialMetricImportRow[],
  options: {
    accounts?: SocialAccount[];
    supabase?: SupabaseClient;
  } = {},
): Promise<SocialImportSummary> {
  const accounts = options.accounts ?? (await getSocialAccounts());
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;

  // Resolve every row to an account first.
  const resolved: Array<{
    row: SocialMetricImportRow;
    account: SocialAccount | null;
    error: string | null;
  }> = rows.map((row) => {
    const result = matchImportRowToAccount(accounts, row);
    if ('account' in result) {
      return { row, account: result.account, error: null };
    }
    return { row, account: null, error: result.error };
  });

  const rejected: Array<{ rowNumber: number; message: string }> = [];
  for (const r of resolved) {
    if (!r.account || r.error) {
      rejected.push({
        rowNumber: r.row.rowNumber,
        message: r.error ?? 'حساب یافت نشد.',
      });
      continue;
    }
    for (const err of r.row.errors) {
      rejected.push({ rowNumber: r.row.rowNumber, message: err });
    }
  }

  const toCommit = resolved.filter(
    (r) => r.account && r.error === null && r.row.errors.length === 0,
  );

  // Pre-check existing keys to distinguish inserts from updates.
  const existing = await existingKeys(
    supabase,
    toCommit.map((r) => ({
      accountId: r.account!.id,
      period: r.row.period,
      periodLabel: r.row.periodLabel,
    })),
  );

  let inserted = 0;
  let updated = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [...rejected];

  for (const r of toCommit) {
    const account = r.account!;
    const key = `${account.id}|${r.row.period}|${r.row.periodLabel}`;
    const wasExisting = existing.has(key);
    const stored = await recordSocialMetrics(
      account.id,
      r.row.period,
      r.row.values,
      { periodLabel: r.row.periodLabel, supabase },
    );
    if (!stored) {
      errors.push({
        rowNumber: r.row.rowNumber,
        message: 'ثبت آمار انجام نشد. لطفاً دوباره تلاش کنید.',
      });
      continue;
    }
    if (wasExisting) updated += 1;
    else inserted += 1;
  }

  return {
    total: rows.length,
    inserted,
    updated,
    rejected: errors.length,
    duplicate: 0, // UNIQUE (account_id, period, period_label) + upsert → never.
    errors,
  };
}
