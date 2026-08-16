import type { SupabaseClient } from '@supabase/supabase-js';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import type {
  SocialDataQualityIssue,
  SocialDataQualityIssueReviewStatus,
  SocialDataQualityIssueType,
  SocialDataQualityIssueWithReview,
  SocialDataQualityReport,
  SocialDataQualityReportWithReviews,
  SocialDataQualityReview,
  SocialDataQualityReviewInput,
  SocialDataQualityReviewStatus,
} from '@/types/social';

/**
 * PHASE 16 — Social Data Quality Review Center.
 *
 * Human review state is SEPARATE from detection: `analyzeSocialDataQuality`
 * stays deterministic and never sees review state. This service owns the
 * `social_data_quality_reviews` table:
 *
 *   - get  → every persisted review (small table, one query)
 *   - upsert → create or update the review for one logical issue
 *   - delete → return an issue to 'open' (re-open)
 *   - mergeReviewStatus → attach review state to a detected report
 *
 * Review identity is the deterministic issue identity
 * `(issue_type, account_id, metric_id, field)` — exactly the tuple the
 * detector emits, so a review can never leak onto an unrelated issue
 * (e.g. a stale issue whose metric row changes gets a NEW identity and
 * stays open). Reviews NEVER write to `social_metrics` / `social_accounts`.
 */

/** Centralized Persian labels for review states (UI must use these). */
export const SOCIAL_DATA_QUALITY_REVIEW_LABELS: Record<
  SocialDataQualityIssueReviewStatus,
  string
> = {
  open: 'باز',
  reviewed: 'بررسی شد',
  ignored: 'نادیده گرفته شد',
};

/** Every issue type the detector can emit (runtime list for validation). */
export const SOCIAL_DATA_QUALITY_ISSUE_TYPES = [
  'negative_metric',
  'invalid_engagement_rate',
  'future_metric',
  'stale_account',
  'temporal_gap',
  'orphan_metric',
  'duplicate_metric',
  'missing_optional_field',
  'account_without_metrics',
] as const satisfies readonly SocialDataQualityIssueType[];

const VALID_ISSUE_TYPES = new Set<SocialDataQualityIssueType>(
  SOCIAL_DATA_QUALITY_ISSUE_TYPES,
);

const VALID_STATUSES = new Set<SocialDataQualityReviewStatus>([
  'reviewed',
  'ignored',
]);

/** Light runtime validation (the API validates with zod first). */
function validateReviewInput(input: SocialDataQualityReviewInput): void {
  if (!VALID_ISSUE_TYPES.has(input.issueType)) {
    throw new Error(`نوع مسئله نامعتبر است: ${String(input.issueType)}`);
  }
  if (!VALID_STATUSES.has(input.status)) {
    throw new Error(`وضعیت بررسی نامعتبر است: ${String(input.status)}`);
  }
  if (input.accountId !== null && typeof input.accountId !== 'string') {
    throw new Error('شناسهٔ حساب نامعتبر است.');
  }
  if (
    input.metricId != null &&
    (!Number.isInteger(input.metricId) || input.metricId <= 0)
  ) {
    throw new Error('شناسهٔ متریک نامعتبر است.');
  }
  if (input.field != null && !(input.field in SOCIAL_METRIC_FIELDS)) {
    throw new Error(`فیلد نامعتبر است: ${String(input.field)}`);
  }
}

/**
 * Canonical string identity of a logical issue. Both the detector's issues
 * (metricId as string) and persisted reviews (metricId as number) use the
 * same normalization, so `String()` is applied on both sides.
 */
export function reviewIdentityKey(
  issueType: SocialDataQualityIssueType,
  accountId: string | null,
  metricId: string | number | null,
  field: SocialMetricFieldKey | null,
): string {
  const account = accountId ?? '∅';
  const metric = metricId == null ? '∅' : String(metricId);
  const fieldKey = field ?? '∅';
  return `${issueType}|${account}|${metric}|${fieldKey}`;
}

/** snake_case row of `social_data_quality_reviews`. */
interface ReviewRow {
  id: string;
  issue_type: SocialDataQualityIssueType;
  account_id: string | null;
  metric_id: number | null;
  field: SocialMetricFieldKey | null;
  status: SocialDataQualityReviewStatus;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toReview(row: ReviewRow): SocialDataQualityReview {
  return {
    id: row.id,
    issueType: row.issue_type,
    accountId: row.account_id,
    metricId: row.metric_id,
    field: row.field,
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All persisted reviews (one bounded query; the table stays tiny). */
export async function getSocialDataQualityReviews(
  options: { supabase?: SupabaseClient } = {},
): Promise<SocialDataQualityReview[]> {
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const { data, error } = await supabase
    .from('social_data_quality_reviews')
    .select('*')
    .order('reviewed_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewRow[]).map(toReview);
}

/** Find the review row matching the issue identity, if any. */
async function findReviewRow(
  supabase: SupabaseClient,
  input: Pick<
    SocialDataQualityReviewInput,
    'issueType' | 'accountId' | 'metricId' | 'field'
  >,
): Promise<ReviewRow | null> {
  let query = supabase
    .from('social_data_quality_reviews')
    .select('*')
    .eq('issue_type', input.issueType);
  query =
    input.accountId === null
      ? query.is('account_id', null)
      : query.eq('account_id', input.accountId);
  query =
    input.metricId == null
      ? query.is('metric_id', null)
      : query.eq('metric_id', input.metricId);
  query =
    input.field == null
      ? query.is('field', null)
      : query.eq('field', input.field);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as unknown as ReviewRow | null) ?? null;
}

/**
 * Create or update the review for one logical issue. Re-reviewing the same
 * issue updates the status (and reviewed_at); the unique identity index
 * guarantees a single row per logical issue even with NULL metric/field.
 */
export async function upsertSocialDataQualityReview(
  input: SocialDataQualityReviewInput,
  options: { supabase?: SupabaseClient } = {},
): Promise<SocialDataQualityReview> {
  validateReviewInput(input);
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const existing = await findReviewRow(supabase, input);
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from('social_data_quality_reviews')
      .update({ status: input.status, reviewed_at: now })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return toReview(data as unknown as ReviewRow);
  }

  const { data, error } = await supabase
    .from('social_data_quality_reviews')
    .insert({
      issue_type: input.issueType,
      account_id: input.accountId,
      metric_id: input.metricId ?? null,
      field: input.field ?? null,
      status: input.status,
      reviewed_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return toReview(data as unknown as ReviewRow);
}

/**
 * Remove the review of one logical issue → returns the issue to 'open'.
 * Returns false when no review existed (idempotent re-open).
 */
export async function deleteSocialDataQualityReview(
  input: Pick<
    SocialDataQualityReviewInput,
    'issueType' | 'accountId' | 'metricId' | 'field'
  >,
  options: { supabase?: SupabaseClient } = {},
): Promise<boolean> {
  validateReviewInput({ ...input, status: 'reviewed' });
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const existing = await findReviewRow(supabase, input);
  if (!existing) return false;
  const { error } = await supabase
    .from('social_data_quality_reviews')
    .delete()
    .eq('id', existing.id);
  if (error) throw error;
  return true;
}

/**
 * Attach human review state to a deterministic report. Pure — the detector
 * output (severity, classification, metric values) is never altered; each
 * issue only gains `reviewStatus` and the summary gains review counts.
 */
export function mergeReviewStatus(
  report: SocialDataQualityReport,
  reviews: SocialDataQualityReview[],
): SocialDataQualityReportWithReviews {
  const reviewByKey = new Map<string, SocialDataQualityReview>();
  for (const review of reviews) {
    reviewByKey.set(
      reviewIdentityKey(
        review.issueType,
        review.accountId,
        review.metricId,
        review.field,
      ),
      review,
    );
  }

  const issues: SocialDataQualityIssueWithReview[] = report.issues.map(
    (issue) => {
      const review = reviewByKey.get(
        reviewIdentityKey(
          issue.type,
          issue.accountId,
          issue.metricId,
          issue.field,
        ),
      );
      return {
        ...issue,
        reviewStatus: review?.status ?? 'open',
      };
    },
  );

  const openIssues = issues.filter((i) => i.reviewStatus === 'open').length;
  const reviewedIssues = issues.filter(
    (i) => i.reviewStatus === 'reviewed',
  ).length;
  const ignoredIssues = issues.filter(
    (i) => i.reviewStatus === 'ignored',
  ).length;

  return {
    summary: {
      ...report.summary,
      openIssues,
      reviewedIssues,
      ignoredIssues,
    },
    issues,
    accounts: report.accounts,
  };
}

/** Review-status filter for the UI (pure; 'all' returns everything). */
export function filterIssuesByReviewStatus(
  issues: SocialDataQualityIssueWithReview[],
  filter: 'all' | SocialDataQualityIssueReviewStatus,
): SocialDataQualityIssueWithReview[] {
  if (filter === 'all') return issues;
  return issues.filter((i) => i.reviewStatus === filter);
}

/** Narrow a detected issue to the identity a review is stored under. */
export function issueToReviewInput(
  issue: Pick<
    SocialDataQualityIssue,
    'type' | 'accountId' | 'metricId' | 'field'
  >,
  status: SocialDataQualityReviewStatus,
): SocialDataQualityReviewInput {
  return {
    issueType: issue.type,
    accountId: issue.accountId,
    metricId: issue.metricId == null ? null : Number(issue.metricId),
    field: issue.field,
    status,
  };
}
