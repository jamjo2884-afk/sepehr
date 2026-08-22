import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialMetricPeriod,
  SocialMetricValues,
} from '@/types/social';

/** Where the imported data comes from. */
export type SocialImportSource = 'file' | 'csv' | 'google_sheets';

/**
 * One parsed + validated row from an Excel / CSV / (future) Sheets import.
 *
 * `values` only contains the metric columns the row's platform supports;
 * absent keys mean "not provided" (NULL), exactly like the manual form.
 * `errors` lists human-readable (Persian) problems — an empty array means
 * the row is ready to import.
 */
export interface SocialMetricImportRow {
  /** 1-based row number in the source sheet (header row excluded). */
  rowNumber: number;
  platform: SocialPlatform;
  /** Raw account identifier from the file (may be an id, external id, handle or name). */
  accountIdentifier: string;
  period: SocialMetricPeriod;
  /** Normalized period label ('1405-05', '1405-05-23', '1405-W33'). */
  periodLabel: string;
  /** Normalized metric values for the platform's valid fields only. */
  values: SocialMetricValues;
  /** Validation problems; empty = the row is valid. */
  errors: string[];
  /** User-resolved account ID (set when user picks from ambiguous/unmatched). */
  resolvedAccountId?: string | null;
}

/** A row with the account matched for preview display. */
export interface SocialImportPreviewRow extends SocialMetricImportRow {
  /** Matched account (null when ambiguous or not found). */
  account: SocialAccount | null;
  /** Matching problem in Persian (null when matched / not attempted yet). */
  matchError: string | null;
  /** Structured match status. */
  matchStatus?: 'matched' | 'ambiguous' | 'unmatched' | 'empty';
  /** Candidate accounts when ambiguous. */
  candidates?: Array<{
    id: string;
    brand: string;
    username: string;
    displayName: string | null;
  }> | null;
}

/** Parsed file content before row-level validation. */
export interface SocialImportParseResult {
  rows: SocialMetricImportRow[];
  /** Problems with the file itself (missing headers, empty file, …). */
  fileErrors: string[];
}

/** Outcome of committing validated rows through the standard service. */
export interface SocialImportSummary {
  total: number;
  /** Rows written as brand-new metric rows. */
  inserted: number;
  /** Rows that updated an existing (account, period, label) row. */
  updated: number;
  /** Rows skipped because they failed validation or account matching. */
  rejected: number;
  /** Always 0 — the UNIQUE constraint + upsert prevents duplicates. */
  duplicate: number;
  errors: Array<{ rowNumber: number; message: string }>;
}
