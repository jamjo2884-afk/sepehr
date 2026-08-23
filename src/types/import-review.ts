/**
 * Import Review Center types.
 *
 * Mirrors the database schema in:
 * supabase/migrations/20260822100000_create_import_review_center.sql
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ImportRowStatus =
  | 'pending'
  | 'valid'
  | 'error'
  | 'ambiguous'
  | 'resolved'
  | 'rejected'
  | 'imported';

export type ImportSessionStatus =
  | 'draft'
  | 'validating'
  | 'review_required'
  | 'ready'
  | 'importing'
  | 'completed'
  | 'cancelled'
  | 'failed';

// ─── Error types ─────────────────────────────────────────────────────────────

export type ImportErrorType =
  | 'ACCOUNT_NOT_FOUND'
  | 'AMBIGUOUS_ACCOUNT'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'INVALID_PLATFORM'
  | 'MISSING_IDENTIFIER'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_METRIC'
  | 'INVALID_PERIOD'
  | 'DUPLICATE_ROW'
  | 'PLATFORM_MISMATCH'
  | 'BRAND_MISMATCH'
  | 'ACCOUNT_INACTIVE'
  | 'UNKNOWN_ERROR';

export const ERROR_TYPE_LABELS: Record<ImportErrorType, string> = {
  ACCOUNT_NOT_FOUND: 'حساب پیدا نشد',
  AMBIGUOUS_ACCOUNT: 'حساب مبهم',
  PLATFORM_NOT_SUPPORTED: 'پلتفرم پشتیبانی نمی‌شود',
  INVALID_PLATFORM: 'پلتفرم نامعتبر',
  MISSING_IDENTIFIER: 'شناسه حساب وارد نشده',
  MISSING_REQUIRED_FIELD: 'فیلد ضروری وارد نشده',
  INVALID_METRIC: 'مقدار آمار نامعتبر',
  INVALID_PERIOD: 'دوره نامعتبر',
  DUPLICATE_ROW: 'ردیف تکراری',
  PLATFORM_MISMATCH: 'عدم تطابق پلتفرم',
  BRAND_MISMATCH: 'عدم تطابق برند',
  ACCOUNT_INACTIVE: 'حساب غیرفعال',
  UNKNOWN_ERROR: 'خطای ناشناخته',
};

// ─── Resolution types ────────────────────────────────────────────────────────

export type ResolutionType =
  | 'match_existing'
  | 'create_account'
  | 'edit'
  | 'reject'
  | 'none';

// ─── Database row shapes ─────────────────────────────────────────────────────

export interface ImportSession {
  id: string;
  filename: string;
  file_type: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  ambiguous_rows: number;
  resolved_rows: number;
  rejected_rows: number;
  imported_rows: number;
  status: ImportSessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportRow {
  id: string;
  session_id: string;
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
  matched_account_id: string | null;
  status: ImportRowStatus;
  error_type: ImportErrorType | null;
  error_message: string | null;
  resolution_type: ResolutionType | null;
  resolution_data: Record<string, unknown> | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportAuditLogEntry {
  id: string;
  session_id: string;
  row_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

// ─── Derived / computed types ────────────────────────────────────────────────

/** Dashboard summary counts for a session. */
export interface ImportSessionSummary {
  total: number;
  valid: number;
  error: number;
  ambiguous: number;
  resolved: number;
  rejected: number;
  imported: number;
}

/** Grouped error type counts for the top-errors panel. */
export interface ErrorTypeCount {
  error_type: ImportErrorType;
  count: number;
}

/** Candidate account shown in the review dialog. */
export interface CandidateAccount {
  id: string;
  brand: string;
  username: string;
  display_name: string | null;
  platform: string;
  status: string;
  external_id: string | null;
}

/** Payload for resolving a row (match to existing account). */
export interface ResolveRowPayload {
  resolution_type: 'match_existing';
  matched_account_id: string;
}

/** Payload for creating a new account from a row. */
export interface CreateAccountPayload {
  resolution_type: 'create_account';
  brand: string;
  platform: string;
  username: string;
  display_name: string | null;
}

/** Payload for editing a row's data. */
export interface EditRowPayload {
  resolution_type: 'edit';
  platform?: string;
  account_identifier?: string;
  username?: string;
  display_name?: string;
  brand?: string;
  period?: string;
  period_label?: string;
  values?: Record<string, number | null>;
}

/** Payload for rejecting a row. */
export interface RejectRowPayload {
  resolution_type: 'reject';
  reason: string;
}

/** Preview before final commit. */
export interface ImportCommitPreview {
  accounts_to_create: number;
  metrics_to_insert: number;
  metrics_to_update: number;
  rows_to_import: number;
  rows_rejected: number;
}

/** Summary returned after committing. */
export interface ImportCommitResult {
  inserted: number;
  updated: number;
  rejected: number;
  errors: Array<{ row_number: number; message: string }>;
}
