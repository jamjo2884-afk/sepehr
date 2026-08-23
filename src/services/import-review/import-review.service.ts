/**
 * Import Review Center — Service Layer
 *
 * Manages the full lifecycle of a bulk import:
 * Upload → Parse → Validate → Review → Resolve/Reject → Commit → History.
 *
 * All writes go through this service. The client never touches Supabase directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportSession,
  ImportSessionStatus,
  ImportRow,
  ImportRowStatus,
  ImportErrorType,
  ImportAuditLogEntry,
  ImportSessionSummary,
  ErrorTypeCount,
  CandidateAccount,
  ImportCommitPreview,
  ImportCommitResult,
} from '@/types/import-review';
import type { SocialAccount } from '@/types/social';
import type { SocialMetricValues } from '@/types/social';
import { matchImportRowToAccount } from '@/services/social-import/match';
import { getSocialAccounts } from '@/services/social.service';
import { periodRangeForLabel } from '@/services/social-metrics';
import { METRIC_COLUMN_BY_KEY } from '@/services/social.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getClient(supabase?: SupabaseClient): Promise<SupabaseClient> {
  if (supabase) return supabase;
  const { supabase: client } = await import('@/lib/supabase');
  return client;
}

// ─── Session CRUD ────────────────────────────────────────────────────────────

/** Create a new import session. */
export async function createImportSession(
  filename: string,
  fileType: string,
  totalRows: number,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportSession> {
  const sb = await getClient(options.supabase);
  const { data, error } = await sb
    .from('import_sessions')
    .insert({
      filename,
      file_type: fileType,
      total_rows: totalRows,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data as ImportSession;
}

/** Get a single session by ID. */
export async function getImportSession(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportSession | null> {
  const sb = await getClient(options.supabase);
  const { data, error } = await sb
    .from('import_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as ImportSession | null;
}

/** List all sessions, newest first. */
export async function listImportSessions(
  options: { supabase?: SupabaseClient; limit?: number; offset?: number } = {},
): Promise<ImportSession[]> {
  const sb = await getClient(options.supabase);
  const { data, error } = await sb
    .from('import_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50) - 1);
  if (error) throw error;
  return (data ?? []) as ImportSession[];
}

/** Update session status + counts. */
export async function updateImportSession(
  sessionId: string,
  patch: Partial<Pick<ImportSession, 'status' | 'valid_rows' | 'error_rows' | 'ambiguous_rows' | 'resolved_rows' | 'rejected_rows' | 'imported_rows'>>,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const { error } = await sb
    .from('import_sessions')
    .update(patch)
    .eq('id', sessionId);
  if (error) throw error;
}

/** Delete a session and all its rows (cascade). */
export async function deleteImportSession(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const { error } = await sb
    .from('import_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

// ─── Row CRUD ────────────────────────────────────────────────────────────────

/** Bulk-insert parsed rows for a session. */
export async function createImportRows(
  sessionId: string,
  rows: Array<{
    row_number: number;
    raw_data: Record<string, unknown>;
    normalized_data: Record<string, unknown>;
    platform: string | null;
    account_identifier: string | null;
    username: string | null;
    display_name: string | null;
    brand: string | null;
    period: string | null;
    period_label: string | null;
  }>,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      session_id: sessionId,
      ...r,
      status: 'pending' as const,
    }));
    const { error } = await sb.from('import_rows').insert(batch);
    if (error) throw error;
  }
}

/** Get all rows for a session. */
export async function getImportRows(
  sessionId: string,
  options: { supabase?: SupabaseClient; status?: ImportRowStatus } = {},
): Promise<ImportRow[]> {
  const sb = await getClient(options.supabase);
  let query = sb
    .from('import_rows')
    .select('*')
    .eq('session_id', sessionId)
    .order('row_number');
  if (options.status) {
    query = query.eq('status', options.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ImportRow[];
}

/** Get a single row by ID. */
export async function getImportRow(
  rowId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportRow | null> {
  const sb = await getClient(options.supabase);
  const { data, error } = await sb
    .from('import_rows')
    .select('*')
    .eq('id', rowId)
    .maybeSingle();
  if (error) throw error;
  return data as ImportRow | null;
}

/** Update a single row. */
export async function updateImportRow(
  rowId: string,
  patch: Partial<Pick<ImportRow, 'status' | 'error_type' | 'error_message' | 'matched_account_id' | 'resolution_type' | 'resolution_data' | 'resolved_at' | 'platform' | 'account_identifier' | 'username' | 'display_name' | 'brand' | 'period' | 'period_label' | 'normalized_data'>>,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const { error } = await sb
    .from('import_rows')
    .update(patch)
    .eq('id', rowId);
  if (error) throw error;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

/** Write an audit log entry. */
export async function logAuditEntry(
  sessionId: string,
  rowId: string,
  action: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const { error } = await sb
    .from('import_audit_log')
    .insert({
      session_id: sessionId,
      row_id: rowId,
      action,
      old_value: oldValue,
      new_value: newValue,
    });
  if (error) throw error;
}

/** Get audit log for a session. */
export async function getAuditLog(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportAuditLogEntry[]> {
  const sb = await getClient(options.supabase);
  const { data, error } = await sb
    .from('import_audit_log')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImportAuditLogEntry[];
}

// ─── Matching & Validation ───────────────────────────────────────────────────

/**
 * Run matching + validation on all pending rows in a session.
 * Updates each row's status, error_type, error_message, matched_account_id.
 * Returns the updated session counts.
 */
export async function validateSession(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportSessionSummary> {
  const sb = await getClient(options.supabase);
  await updateImportSession(sessionId, { status: 'validating' }, { supabase: sb });

  const rows = await getImportRows(sessionId, { supabase: sb });
  const accounts = await getSocialAccounts();

  let valid = 0, error = 0, ambiguous = 0;

  for (const row of rows) {
    const platform = row.platform;
    const identifier = row.account_identifier;

    // Check platform support — all platforms in the TypeScript SocialPlatform type
    // are now supported by the Supabase enum (see migration 20260823100000).
    // We only reject truly unknown platforms that aren't in the type at all.
    const KNOWN_PLATFORMS: string[] = [
      'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
      'rubika', 'soroushplus', 'aparat', 'threads', 'shad', 'igap',
      'site', 'gap', 'virasty',
    ];
    if (platform && !KNOWN_PLATFORMS.includes(platform)) {
      await updateImportRow(row.id, {
        status: 'error',
        error_type: 'PLATFORM_NOT_SUPPORTED',
        error_message: 'این شبکه شناخته نشده است.',
        matched_account_id: null,
      }, { supabase: sb });
      error++;
      continue;
    }

    // Check missing identifier
    if (!identifier || identifier.trim() === '') {
      await updateImportRow(row.id, {
        status: 'error',
        error_type: 'MISSING_IDENTIFIER',
        error_message: 'شناسه حساب وارد نشده است.',
        matched_account_id: null,
      }, { supabase: sb });
      error++;
      continue;
    }

    // Check invalid platform
    if (!platform) {
      await updateImportRow(row.id, {
        status: 'error',
        error_type: 'INVALID_PLATFORM',
        error_message: 'پلتفرم نامعتبر است.',
        matched_account_id: null,
      }, { supabase: sb });
      error++;
      continue;
    }

    // Run matcher
    const result = matchImportRowToAccount(accounts, {
      accountIdentifier: identifier,
      platform: platform as never,
    });

    if (result.status === 'matched') {
      await updateImportRow(row.id, {
        status: 'valid',
        error_type: null,
        error_message: null,
        matched_account_id: result.accountId,
      }, { supabase: sb });
      valid++;
    } else if (result.status === 'ambiguous') {
      const candidateIds = result.candidates.map((c) => c.id);
      await updateImportRow(row.id, {
        status: 'ambiguous',
        error_type: 'AMBIGUOUS_ACCOUNT',
        error_message: `${result.candidates.length} حساب با این شناسه یافت شد. لطفاً یکی را انتخاب کنید.`,
        matched_account_id: null,
        resolution_data: { candidate_ids: candidateIds },
      }, { supabase: sb });
      ambiguous++;
    } else if (result.status === 'unmatched') {
      await updateImportRow(row.id, {
        status: 'error',
        error_type: 'ACCOUNT_NOT_FOUND',
        error_message: 'حسابی با این شناسه یافت نشد.',
        matched_account_id: null,
      }, { supabase: sb });
      error++;
    } else {
      // empty
      await updateImportRow(row.id, {
        status: 'error',
        error_type: 'MISSING_IDENTIFIER',
        error_message: 'شناسه حساب وارد نشده است.',
        matched_account_id: null,
      }, { supabase: sb });
      error++;
    }
  }

  const summary: ImportSessionSummary = {
    total: rows.length,
    valid,
    error,
    ambiguous,
    resolved: 0,
    rejected: 0,
    imported: 0,
  };

  const hasIssues = error > 0 || ambiguous > 0;
  await updateImportSession(sessionId, {
    status: hasIssues ? 'review_required' : 'ready',
    valid_rows: valid,
    error_rows: error,
    ambiguous_rows: ambiguous,
  }, { supabase: sb });

  return summary;
}

// ─── Row Operations ──────────────────────────────────────────────────────────

/** Get candidate accounts for an ambiguous row. */
export async function getCandidates(
  rowId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<CandidateAccount[]> {
  const sb = await getClient(options.supabase);
  const row = await getImportRow(rowId, { supabase: sb });
  if (!row || !row.resolution_data) return [];

  const candidateIds = (row.resolution_data as { candidate_ids?: string[] }).candidate_ids;
  if (!candidateIds?.length) return [];

  const { data, error } = await sb
    .from('social_accounts')
    .select('id, brand, username, display_name, platform, status, external_id')
    .in('id', candidateIds);
  if (error) throw error;
  return (data ?? []) as CandidateAccount[];
}

/** Resolve a row by matching to an existing account. */
export async function resolveRowMatchExisting(
  rowId: string,
  accountId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const row = await getImportRow(rowId, { supabase: sb });
  if (!row) throw new Error('Row not found');

  const oldValue = { status: row.status, matched_account_id: row.matched_account_id };

  await updateImportRow(rowId, {
    status: 'resolved',
    matched_account_id: accountId,
    resolution_type: 'match_existing',
    resolved_at: new Date().toISOString(),
    error_type: null,
    error_message: null,
  }, { supabase: sb });

  await logAuditEntry(row.session_id, rowId, 'match_existing', oldValue, {
    status: 'resolved',
    matched_account_id: accountId,
  }, { supabase: sb });

  await recalcSessionCounts(row.session_id, { supabase: sb });
}

/** Reject a row with a reason. */
export async function rejectRow(
  rowId: string,
  reason: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const row = await getImportRow(rowId, { supabase: sb });
  if (!row) throw new Error('Row not found');

  const oldValue = { status: row.status };

  await updateImportRow(rowId, {
    status: 'rejected',
    resolution_type: 'reject',
    resolution_data: { reason },
    resolved_at: new Date().toISOString(),
  }, { supabase: sb });

  await logAuditEntry(row.session_id, rowId, 'reject', oldValue, {
    status: 'rejected',
    reason,
  }, { supabase: sb });

  await recalcSessionCounts(row.session_id, { supabase: sb });
}

/** Edit a row's data and re-validate it. */
export async function editAndRevalidateRow(
  rowId: string,
  edits: {
    platform?: string;
    account_identifier?: string;
    username?: string;
    display_name?: string;
    brand?: string;
    period?: string;
    period_label?: string;
    normalized_data?: Record<string, unknown>;
  },
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const row = await getImportRow(rowId, { supabase: sb });
  if (!row) throw new Error('Row not found');

  const oldValue = { status: row.status, platform: row.platform, account_identifier: row.account_identifier };

  await updateImportRow(rowId, {
    ...edits,
    status: 'pending',
    error_type: null,
    error_message: null,
    matched_account_id: null,
    resolution_type: null,
    resolution_data: null,
    resolved_at: null,
  }, { supabase: sb });

  await logAuditEntry(row.session_id, rowId, 'edit', oldValue, {
    ...edits,
    status: 'pending',
  }, { supabase: sb });

  // Re-validate just this row
  const updatedRow = await getImportRow(rowId, { supabase: sb });
  if (!updatedRow) return;

  const accounts = await getSocialAccounts();
  const KNOWN_PLATFORMS: string[] = [
    'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
    'rubika', 'soroushplus', 'aparat', 'threads', 'shad', 'igap',
    'site', 'gap', 'virasty',
  ];

  if (updatedRow.platform && !KNOWN_PLATFORMS.includes(updatedRow.platform)) {
    await updateImportRow(rowId, {
      status: 'error',
      error_type: 'PLATFORM_NOT_SUPPORTED',
      error_message: 'این شبکه شناخته نشده است.',
    }, { supabase: sb });
  } else if (!updatedRow.account_identifier || updatedRow.account_identifier.trim() === '') {
    await updateImportRow(rowId, {
      status: 'error',
      error_type: 'MISSING_IDENTIFIER',
      error_message: 'شناسه حساب وارد نشده است.',
    }, { supabase: sb });
  } else if (!updatedRow.platform) {
    await updateImportRow(rowId, {
      status: 'error',
      error_type: 'INVALID_PLATFORM',
      error_message: 'پلتفرم نامعتبر است.',
    }, { supabase: sb });
  } else {
    const result = matchImportRowToAccount(accounts, {
      accountIdentifier: updatedRow.account_identifier,
      platform: updatedRow.platform as never,
    });
    if (result.status === 'matched') {
      await updateImportRow(rowId, {
        status: 'resolved',
        matched_account_id: result.accountId,
        resolution_type: 'edit',
        resolved_at: new Date().toISOString(),
      }, { supabase: sb });
    } else if (result.status === 'ambiguous') {
      await updateImportRow(rowId, {
        status: 'ambiguous',
        error_type: 'AMBIGUOUS_ACCOUNT',
        error_message: `${result.candidates.length} حساب یافت شد.`,
        resolution_data: { candidate_ids: result.candidates.map((c) => c.id) },
      }, { supabase: sb });
    } else {
      await updateImportRow(rowId, {
        status: 'error',
        error_type: 'ACCOUNT_NOT_FOUND',
        error_message: 'حسابی با این شناسه یافت نشد.',
      }, { supabase: sb });
    }
  }

  await recalcSessionCounts(row.session_id, { supabase: sb });
}

// ─── Session Recalculation ───────────────────────────────────────────────────

/** Recalculate session row counts from actual row statuses. */
export async function recalcSessionCounts(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<void> {
  const sb = await getClient(options.supabase);
  const rows = await getImportRows(sessionId, { supabase: sb });

  const counts = { valid_rows: 0, error_rows: 0, ambiguous_rows: 0, resolved_rows: 0, rejected_rows: 0, imported_rows: 0 };
  for (const r of rows) {
    if (r.status === 'valid') counts.valid_rows++;
    else if (r.status === 'error') counts.error_rows++;
    else if (r.status === 'ambiguous') counts.ambiguous_rows++;
    else if (r.status === 'resolved') counts.resolved_rows++;
    else if (r.status === 'rejected') counts.rejected_rows++;
    else if (r.status === 'imported') counts.imported_rows++;
  }

  const hasIssues = counts.error_rows > 0 || counts.ambiguous_rows > 0;
  const allDone = counts.error_rows === 0 && counts.ambiguous_rows === 0 && counts.resolved_rows === 0;
  let status: ImportSessionStatus = 'review_required';
  if (allDone && counts.valid_rows + counts.resolved_rows > 0) status = 'ready';
  else if (!hasIssues && counts.valid_rows > 0) status = 'ready';

  await updateImportSession(sessionId, { ...counts, status }, { supabase: sb });
}

// ─── Commit ──────────────────────────────────────────────────────────────────

/** Generate a preview of what the commit will do. */
export async function getCommitPreview(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportCommitPreview> {
  const sb = await getClient(options.supabase);
  const rows = await getImportRows(sessionId, { supabase: sb });
  const importable = rows.filter((r) => r.status === 'valid' || r.status === 'resolved');

  const accounts = await getSocialAccounts();
  const accountMap = new Map<string, SocialAccount>();
  for (const a of accounts) accountMap.set(a.id, a);

  let accountsToCreate = 0;
  let metricsToInsert = 0;
  let metricsToUpdate = 0;

  for (const row of importable) {
    if (row.matched_account_id) {
      // Existing account — metric update
      metricsToUpdate++;
    } else if (row.resolution_type === 'create_account') {
      accountsToCreate++;
      metricsToInsert++;
    }
  }

  return {
    accounts_to_create: accountsToCreate,
    metrics_to_insert: metricsToInsert,
    metrics_to_update: metricsToUpdate,
    rows_to_import: importable.length,
    rows_rejected: rows.filter((r) => r.status === 'rejected').length,
  };
}

const METRIC_KEYS = ['followers', 'following', 'posts', 'views', 'likes', 'comments', 'shares', 'saves', 'reach', 'impressions', 'engagementRate', 'storyViews', 'channelMembers', 'retweets', 'subscribers'] as const;

function extractValues(row: ImportRow): SocialMetricValues {
  const nd = row.normalized_data as Record<string, unknown>;
  // Values may be nested inside a 'values' sub-object (from the parse pipeline)
  // or at the top level.
  const source = (nd.values && typeof nd.values === 'object' && !Array.isArray(nd.values))
    ? nd.values as Record<string, unknown>
    : nd;
  const values: SocialMetricValues = {};
  for (const key of METRIC_KEYS) {
    if (source[key] !== undefined && source[key] !== null) {
      (values as Record<string, unknown>)[key] = source[key];
    }
  }
  return values;
}

/**
 * Commit the import: create accounts, upsert metrics.
 *
 * Uses bulk upsert for performance — groups rows by account and
 * upserts in batches instead of one-by-one recordSocialMetrics calls.
 */
export async function commitImport(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ImportCommitResult> {
  const sb = await getClient(options.supabase);
  await updateImportSession(sessionId, { status: 'importing' }, { supabase: sb });

  const rows = await getImportRows(sessionId, { supabase: sb });
  const importable = rows.filter((r) => r.status === 'valid' || r.status === 'resolved');

  let inserted = 0;
  const errors: Array<{ row_number: number; message: string }> = [];

  // Step 1: Create any accounts that need creating
  const accountIdMap = new Map<string, string>(); // row.id -> accountId
  for (const row of importable) {
    let accountId = row.matched_account_id;
    if (!accountId && row.resolution_type === 'create_account' && row.resolution_data) {
      try {
        const rd = row.resolution_data as Record<string, string>;
        const { data: newAcct, error: acctErr } = await sb
          .from('social_accounts')
          .insert({
            brand: rd.brand || row.brand || 'unknown',
            platform: row.platform,
            username: rd.username || row.username || row.account_identifier || '',
            display_name: rd.display_name || row.display_name || null,
            status: 'active',
          })
          .select('id')
          .single();
        if (acctErr) throw acctErr;
        accountId = newAcct.id;
        await updateImportRow(row.id, { matched_account_id: accountId }, { supabase: sb });
      } catch (err) {
        errors.push({ row_number: row.row_number, message: err instanceof Error ? err.message : 'خطای ایجاد حساب' });
        continue;
      }
    }
    if (accountId) accountIdMap.set(row.id, accountId);
  }

  // Step 2: Group rows by (accountId, period, periodLabel) for bulk upsert
  // If multiple import rows map to the same key, merge their values (last wins)
  const grouped = new Map<string, {
    accountId: string;
    period: string;
    periodLabel: string;
    values: SocialMetricValues;
    rowNumbers: number[];
  }>();

  for (const row of importable) {
    const accountId = accountIdMap.get(row.id);
    if (!accountId) {
      errors.push({ row_number: row.row_number, message: 'حسابی برای این ردیف یافت نشد.' });
      continue;
    }
    const period = row.period ?? 'monthly';
    const periodLabel = row.period_label ?? '';
    const key = `${accountId}|${period}|${periodLabel}`;
    const existing = grouped.get(key);
    const values = extractValues(row);
    if (existing) {
      // Merge: non-null values from new row overwrite
      for (const [k, v] of Object.entries(values)) {
        if (v !== null && v !== undefined) {
          (existing.values as Record<string, unknown>)[k] = v;
        }
      }
      existing.rowNumbers.push(row.row_number);
    } else {
      grouped.set(key, { accountId, period, periodLabel, values, rowNumbers: [row.row_number] });
    }
  }

  // Step 3: Fetch existing metrics in bulk for all relevant accounts
  const allAccountIds = [...new Set([...grouped.values()].map((g) => g.accountId))];
  const existingMetricsByAccount = new Map<string, Record<string, unknown>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let query = sb
      .from('social_metrics')
      .select('*')
      .in('account_id', allAccountIds)
      .range(from, from + PAGE - 1);
    const { data: existingRows, error: fetchErr } = await query;
    if (fetchErr) break;
    if (!existingRows || existingRows.length === 0) break;
    for (const r of existingRows) {
      const key = `${r.account_id}|${r.period}|${r.period_label}`;
      existingMetricsByAccount.set(key, r as Record<string, unknown>);
    }
    if (existingRows.length < PAGE) break;
  }

  // Step 4: Build upsert rows with NULL-merge logic
  const upsertRows: Array<Record<string, unknown>> = [];
  for (const [, group] of grouped) {
    const existing = existingMetricsByAccount.get(
      `${group.accountId}|${group.period}|${group.periodLabel}`,
    );
    const range = periodRangeForLabel(group.period as 'daily' | 'weekly' | 'monthly', group.periodLabel);
    const row: Record<string, unknown> = {
      account_id: group.accountId,
      period: group.period,
      period_label: group.periodLabel,
      period_start: range?.start ?? null,
      period_end: range?.end ?? null,
    };
    for (const [key, column] of Object.entries(METRIC_COLUMN_BY_KEY)) {
      const val = (group.values as Record<string, unknown>)[key];
      if (val !== null && val !== undefined) {
        row[column] = val;
      } else if (existing) {
        row[column] = existing[column] ?? null;
      } else {
        row[column] = key === 'followers' ? 0 : null;
      }
    }
    if (row.followers === null) row.followers = 0;
    upsertRows.push(row);
  }

  // Step 5: Bulk upsert in batches of 100
  const UPSERT_BATCH = 100;
  for (let i = 0; i < upsertRows.length; i += UPSERT_BATCH) {
    const batch = upsertRows.slice(i, i + UPSERT_BATCH);
    const { error: upsertErr } = await sb
      .from('social_metrics')
      .upsert(batch, { onConflict: 'account_id,period,period_label' });
    if (upsertErr) {
      console.warn('[import-review] Bulk upsert error:', upsertErr.message);
      // Fall back to row-by-row for this batch
      for (const row of batch) {
        const { error: singleErr } = await sb
          .from('social_metrics')
          .upsert(row, { onConflict: 'account_id,period,period_label' });
        if (singleErr) {
          errors.push({ row_number: 0, message: singleErr.message });
        }
      }
    }
  }

  // Step 6: Mark rows as imported
  const importedIds = importable
    .filter((r) => accountIdMap.has(r.id))
    .map((r) => r.id);
  // Update in batches of 100
  for (let i = 0; i < importedIds.length; i += 100) {
    const batch = importedIds.slice(i, i + 100);
    await sb.from('import_rows').update({ status: 'imported' }).in('id', batch);
  }
  inserted = importedIds.length;

  const finalStatus: ImportSessionStatus = errors.length === 0 ? 'completed' : 'failed';
  await updateImportSession(sessionId, {
    status: finalStatus,
    imported_rows: inserted,
  }, { supabase: sb });

  return { inserted, updated: 0, rejected: errors.length, errors };
}

// ─── Summary Helpers ─────────────────────────────────────────────────────────

/** Get error type counts for a session. */
export async function getErrorTypeCounts(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<ErrorTypeCount[]> {
  const sb = await getClient(options.supabase);
  const rows = await getImportRows(sessionId, { supabase: sb });
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.error_type) {
      counts.set(r.error_type, (counts.get(r.error_type) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([error_type, count]) => ({ error_type: error_type as ImportErrorType, count }))
    .sort((a, b) => b.count - a.count);
}
