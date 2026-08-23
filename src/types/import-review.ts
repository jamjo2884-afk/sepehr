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
  | 'ANOMALY_HIGH'
  | 'ANOMALY_LOW'
  | 'ANOMALY_NEGATIVE'
  | 'ANOMALY_SPIKE'
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
  ANOMALY_HIGH: 'مقدار غیرعادی بالا',
  ANOMALY_LOW: 'مقدار غیرعادی پایین',
  ANOMALY_NEGATIVE: 'مقدار منفی',
  ANOMALY_SPIKE: 'جهش ناگهانی',
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

/* ---------------------------------------------------------------------------
 * Anomaly Detection Types
 * --------------------------------------------------------------------------- */

/** Severity of an anomaly detection. */
export type AnomalySeverity = 'critical' | 'warning' | 'info';

/** Type of anomaly detected. */
export type AnomalyType =
  | 'value_too_high'
  | 'value_too_low'
  | 'negative_value'
  | 'sudden_spike'
  | 'sudden_drop'
  | 'impossible_engagement'
  | 'zero_followers_with_data';

/** A single anomaly detected in a metric value. */
export interface MetricAnomaly {
  field: string;
  /** Persian label of the metric field. */
  fieldLabel: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  /** The value in the import row. */
  importValue: number;
  /** The historical mean (null when no history). */
  historicalMean: number | null;
  /** The historical max. */
  historicalMax: number | null;
  /** The historical min. */
  historicalMin: number | null;
  /** The previous period value (null when not available). */
  previousValue: number | null;
  /** How many times the mean this value is (e.g. 5.2x). */
  deviationFactor: number | null;
  /** Human-readable Persian description. */
  message: string;
}

/** Full anomaly report for one import row. */
export interface RowAnomalyReport {
  rowId: string;
  rowNumber: number;
  accountIdentifier: string;
  platform: string;
  brand: string | null;
  anomalies: MetricAnomaly[];
  /** Severity = worst severity among anomalies. */
  overallSeverity: AnomalySeverity | null;
}

/** Summary of all anomalies in a session. */
export interface SessionAnomalySummary {
  /** Total rows with at least one anomaly. */
  totalFlagged: number;
  /** Anomalies by severity. */
  critical: number;
  warning: number;
  info: number;
  /** Anomalies grouped by metric field. */
  byField: Record<string, number>;
  /** Anomalies grouped by anomaly type. */
  byType: Record<string, number>;
  /** Individual row reports. */
  reports: RowAnomalyReport[];
}

/** Summary returned after committing. */
export interface ImportCommitResult {
  inserted: number;
  updated: number;
  rejected: number;
  errors: Array<{ row_number: number; message: string }>;
}
