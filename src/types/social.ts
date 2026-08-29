import type { ID, Timestamp } from '@/types/index';
import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricFieldKey } from '@/constants/social-fields';

/**
 * Standardized social-media domain types.
 *
 * These mirror the normalized schema in
 * `supabase/migrations/20260814130000_create_social_accounts_metrics.sql`:
 * static account info lives in `social_accounts`, per-period metrics in
 * `social_metrics`. UI code should depend on these types (via the service
 * layer), never on raw Supabase rows.
 */

/** Granularity of a metrics record. Extensible via enum values. */
export type SocialMetricPeriod = 'daily' | 'weekly' | 'monthly';

export const SOCIAL_METRIC_PERIODS: SocialMetricPeriod[] = [
  'daily',
  'weekly',
  'monthly',
];

/** Lifecycle state of a connected social account. */
export type SocialAccountStatus =
  'active' | 'inactive' | 'archived' | 'suspended';

export const SOCIAL_ACCOUNT_STATUS_LABELS: Record<SocialAccountStatus, string> =
  {
    active: 'فعال',
    inactive: 'غیرفعال',
    archived: 'بایگانی‌شده',
    suspended: 'معلق',
  };

/** Static information about one brand × platform × username account. */
export interface SocialAccount {
  id: ID;
  brand: string;
  /** Canonical brand reference — may be absent during transition. */
  brandId?: string | null;
  platform: SocialPlatform;
  /** Unique handle / username on the platform. */
  username: string;
  /** Human-readable name of the account (may differ from username). */
  displayName: string | null;
  /** Public profile URL on the platform. */
  url: string | null;
  /**
   * The platform's OWN account identifier (Telegram chat id, Instagram
   * Graph API user id). Written only from the platform API response by a
   * connector — never guessed by the app.
   */
  externalId: string | null;
  status: SocialAccountStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Sync / connection state (added by the sync infrastructure). */
  connectionStatus: SocialConnectionStatus;
  lastSyncAt: Timestamp | null;
  lastSyncStatus: SocialSyncRunStatus | null;
  lastSuccessfulSyncAt: Timestamp | null;
}

/**
 * Input values for creating / updating a `social_accounts` row through the
 * service. `status` defaults to 'active' when creating.
 */
export interface SocialAccountInput {
  brand: string;
  brandId?: string | null;
  platform: SocialPlatform;
  username: string;
  displayName?: string | null;
  url?: string | null;
  status?: SocialAccountStatus;
}

/**
 * Metrics for one account at one point in time (one period). Only the
 * columns relevant to the platform are populated; the rest are null.
 */
export interface SocialMetric {
  id: ID;
  accountId: ID;
  period: SocialMetricPeriod;
  /** Display key for the period, e.g. '1404-08' (Jalali month) or an ISO date. */
  periodLabel: string;
  periodStart: Timestamp | null;
  periodEnd: Timestamp | null;
  // Common metric set.
  followers: number;
  following: number | null;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  /** Engagement rate in percent (0–100). */
  engagementRate: number | null;
  // Platform-specific metrics.
  storyViews: number | null;
  channelMembers: number | null;
  retweets: number | null;
  subscribers: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Aggregated view of one or more metrics across a period range. */
export interface SocialMetricSummary {
  period: SocialMetricPeriod;
  /** Period label of the earliest metric in the range. */
  periodStart: string | null;
  /** Period label of the latest metric in the range. */
  periodEnd: string | null;
  /** Latest follower/subscriber count. */
  followers: number;
  /** Absolute change in followers vs. the previous period. */
  absoluteGrowth: number;
  /** Percentage change in followers vs. the previous period (%). */
  percentageGrowth: number;
  /** Earliest follower count in the range. */
  firstFollowers: number;
  /** Latest follower count in the range. */
  lastFollowers: number;
  /** Sum of views (or 0 when unavailable). */
  totalViews: number;
  /** Sum of likes + comments + shares. */
  totalEngagement: number;
  /** Average engagement rate across the range (%). */
  averageEngagementRate: number;
  metricCount: number;
}

/** A single point in a follower / metric time series. */
export interface SocialMetricPoint {
  periodLabel: string;
  followers: number;
  /** Raw metric row, for access to platform-specific columns. */
  metric?: SocialMetric;
}

/** A full account with its metric history attached. */
export interface SocialAccountWithMetrics extends SocialAccount {
  /** Chronological metric history (ascending by periodLabel). */
  metrics: SocialMetric[];
  /** Latest point in the series, if any. */
  latest: SocialMetric | null;
  /** First point in the series, if any. */
  first: SocialMetric | null;
}

/** Result of comparing the latest period against the previous one. */
export interface SocialPeriodComparison {
  current: SocialMetric | null;
  previous: SocialMetric | null;
  /** current.followers - previous.followers. */
  absoluteGrowth: number;
  /** ((current - previous) / previous) * 100, 0 when previous is 0/absent. */
  percentageGrowth: number;
}

/* =========================================================================
 * Analytics dashboard types (social-analytics service)
 * ========================================================================= */

/**
 * Jalali month range as inclusive, sortable 'YYYY-MM' labels.
 * E.g. { start: '1404-06', end: '1405-05' } = the last 12 months.
 */
export interface SocialMonthRange {
  start: string;
  end: string;
}

export type SocialRangePreset =
  'current' | 'previous' | '3m' | '6m' | '12m' | '24m' | 'custom';

export const SOCIAL_RANGE_PRESET_LABELS: Record<
  Exclude<SocialRangePreset, 'custom'>,
  string
> = {
  current: 'ماه جاری',
  previous: 'ماه قبل',
  '3m': '۳ ماه اخیر',
  '6m': '۶ ماه اخیر',
  '12m': '۱۲ ماه اخیر',
  '24m': '۲۴ ماه اخیر',
};

/** Headline KPIs for the analytics dashboard over a month range. */
export interface SocialKpis {
  /** Sum of the *latest* follower count per account inside the range. */
  followers: number;
  /** Sum of views across all metrics in the range. */
  views: number;
  /** Sum of likes + comments + shares + saves in the range. */
  engagement: number;
  /** Average engagement rate across the range (%). */
  engagementRate: number;
  /** Sum of posts in the range. */
  posts: number;
  /** Accounts that contributed at least one metric in the range. */
  accountCount: number;
}

export type SocialKpiKey =
  'followers' | 'views' | 'engagement' | 'engagementRate' | 'posts';

/**
 * One metric field compared between the latest period and the period
 * before it (used by the account-detail comparison section). `current` /
 * `previous` are null when that period has no value for the field.
 */
export interface SocialMetricValueComparison {
  key: SocialMetricFieldKey;
  label: string;
  current: number | null;
  previous: number | null;
  /** current - previous (null when either side is missing). */
  absoluteChange: number | null;
  /** percentage change (null when the previous value is missing or 0). */
  changePct: number | null;
}

/** One KPI compared between the current and the previous window. */
export interface SocialKpiComparison {
  key: SocialKpiKey;
  label: string;
  current: number;
  previous: number;
  /** current - previous (absolute). */
  absoluteChange: number;
  /** percentage change (%). */
  changePct: number;
}

/** One point of an aggregate follower trend (one month). */
export interface SocialTrendPoint {
  /** Sortable 'YYYY-MM' Jalali label. */
  month: string;
  /** Human label, e.g. 'مرداد ۱۴۰۴'. */
  monthLabel: string;
  followers: number;
}

/** Follower trend of one brand (for multi-brand comparison). */
export interface SocialBrandTrend {
  brand: string;
  points: SocialTrendPoint[];
}

/** Month-over-month follower growth point. */
export interface SocialMonthlyGrowthPoint {
  month: string;
  monthLabel: string;
  /** Absolute follower change vs. the previous month. */
  change: number;
  /** Percentage change vs. the previous month (%). */
  growthPct: number;
}

/** Shared stat row used by the brand / platform comparison tables. */
export interface SocialEntityStat {
  /** Latest-in-range follower sum. */
  followers: number;
  /** Absolute follower growth vs. the previous window. */
  growth: number;
  /** Percentage follower growth vs. the previous window (%). */
  growthPct: number;
  /** Views summed over the range. */
  views: number;
  /** Engagement summed over the range. */
  engagement: number;
  /** Average engagement rate over the range (%). */
  engagementRate: number;
  /** Posts summed over the range. */
  posts: number;
}

export interface SocialBrandStat extends SocialEntityStat {
  brand: string;
}

export interface SocialPlatformStat extends SocialEntityStat {
  platform: SocialPlatform;
}

/* =========================================================================
 * Brand performance analytics (account-detail / brand page)
 * ========================================================================= */

/**
 * Brand-level headline stats. `views` / `engagement` / `posts` /
 * `engagementRate` are null when NO real data exists in the window (never
 * a fabricated zero) — the UI renders '—' in that case.
 */
export interface SocialBrandOverview {
  brand: string;
  /** Accounts of the brand with at least one metric. */
  activeAccounts: number;
  /** Sum of the latest follower snapshot per account (latest available). */
  followers: number;
  /** Absolute follower growth (latest period vs the previous one). */
  growth: number | null;
  /** Percentage follower growth, null when previous is missing/zero. */
  growthPct: number | null;
  views: number | null;
  engagement: number | null;
  engagementRate: number | null;
  posts: number | null;
  /** Period label of the newest metric across the brand, or null. */
  latestPeriodLabel: string | null;
  latestAccountName: string | null;
}

/** Per-platform performance row for one brand. */
export interface SocialBrandPlatformRow {
  platform: SocialPlatform;
  followers: number;
  growth: number | null;
  growthPct: number | null;
  views: number | null;
  engagement: number | null;
  engagementRate: number | null;
  posts: number | null;
  /** Period label of the newest metric of this platform, or null. */
  latestPeriodLabel: string | null;
  accounts: number;
}

export type SocialDataFreshness = 'up-to-date' | 'stale' | 'no-data';

export interface SocialBrandPlatformTimelineRow {
  platform: SocialPlatform;
  latestPeriodLabel: string | null;
  freshness: SocialDataFreshness;
}

/** Brand vs the average of all other brands, per indicator. */
export interface SocialPeerComparisonItem {
  key: SocialKpiKey;
  label: string;
  /** Brand value (null = no real data for the brand). */
  brand: number | null;
  /** Average of the other brands that have real data for this indicator. */
  peersAverage: number | null;
  /** How many other brands contributed to the average. */
  peersCount: number;
  /** brand - peersAverage. */
  difference: number | null;
}

/** Rule-based growth insight (no AI). */
export interface SocialGrowthDriver {
  type: 'positive' | 'negative' | 'info';
  text: string;
}

/** Rank of a brand for one indicator among all brands. */
export interface SocialBrandRanking {
  key: SocialKpiKey;
  label: string;
  /** Brand value for the indicator. */
  value: number | null;
  /** 1-based rank (1 = best / highest). */
  rank: number | null;
  /** How many brands were ranked. */
  total: number;
}

/* =========================================================================
 * Sync / connector infrastructure
 * ========================================================================= */

/** How an account is connected to its platform API. */
export type SocialConnectionStatus =
  'connected' | 'disconnected' | 'error' | 'pending';

export const SOCIAL_CONNECTION_STATUS_LABELS: Record<
  SocialConnectionStatus,
  string
> = {
  connected: 'متصل',
  disconnected: 'قطع',
  error: 'خطا',
  pending: 'در انتظار',
};

/** Outcome of the latest sync run for an account. */
export type SocialSyncRunStatus = 'success' | 'error' | 'running';

export const SOCIAL_SYNC_RUN_LABELS: Record<SocialSyncRunStatus, string> = {
  success: 'موفق',
  error: 'ناموفق',
  running: 'در حال اجرا',
};

/** One sync run row in `social_sync_logs`. */
export interface SocialSyncLog {
  id: string;
  socialAccountId: string;
  platform: SocialPlatform;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  status: SocialSyncRunStatus;
  recordsFetched: number;
  recordsWritten: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * A metric row normalized by a connector, ready for upsert into
 * `social_metrics`. Field values are the connector's platform-specific
 * numbers mapped onto the shared metric set; absent fields are omitted so
 * the merge behavior of `recordSocialMetrics` keeps previously stored
 * values.
 */
export interface NormalizedSocialMetric {
  period: SocialMetricPeriod;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** Only the fields the platform really provides. */
  values: SocialMetricValues;
}

/* =========================================================================
 * Social Performance Score (social-score service)
 * ========================================================================= */

/** The five components a brand score can be built from. */
export type SocialScoreComponentKey =
  'growth' | 'engagement' | 'audience' | 'views' | 'publishing';

/** How much real data backs the score. */
export type SocialScoreConfidence = 'high' | 'medium' | 'low';

/** One component of the score with its own sub-score and effective weight. */
export interface SocialScoreComponent {
  key: SocialScoreComponentKey;
  /** Persian label, e.g. 'رشد'. */
  label: string;
  /** 0–100; null when the component has NO real data (unavailable). */
  score: number | null;
  /** Effective weight in % after redistribution among available components. */
  weight: number | null;
  /** Short Persian tooltip explaining what the component measures. */
  tooltip: string;
  /** One-line rule-based explanation, or null when unavailable. */
  explanation: string | null;
}

/** A brand's Social Performance Score with its full breakdown. */
export interface SocialScore {
  brand: string;
  /** Overall 0–100, or null when nothing can be computed. */
  score: number | null;
  /** Performance band label (عالی / خوب / …), or null. */
  band: string | null;
  confidence: SocialScoreConfidence;
  components: SocialScoreComponent[];
  /** Score of the previous period, or null when not computable. */
  previousScore: number | null;
  /** current - previous, or null. */
  trend: number | null;
  /** 1-based rank among all ranked brands, or null. */
  rank: number | null;
  /** How many brands were ranked. */
  rankTotal: number;
  /** Average score of the other brands, or null. */
  peersAverage: number | null;
  /** brand score - peers average, or null. */
  peersDifference: number | null;
  /** Distinct period count used. */
  periodCount: number;
  /** Persian warning when some components are missing real data. */
  dataQualityNote: string | null;
}

/** Per-platform performance score of one brand. */
export interface SocialPlatformScore {
  platform: SocialPlatform;
  score: number | null;
  band: string | null;
  confidence: SocialScoreConfidence;
  components: SocialScoreComponent[];
  /** Score trend vs the previous period, or null. */
  trend: number | null;
}

/** One row of the brand ranking table in /social. */
export interface SocialBrandScoreRow {
  brand: string;
  /** Overall 0–100, or null when the brand has no computable data. */
  score: number | null;
  confidence: SocialScoreConfidence;
  /** Latest-period follower growth %, or null. */
  growth: number | null;
  /** Latest-period engagement, or null. */
  engagement: number | null;
  /** Latest follower total. */
  followers: number;
  /** Score trend vs the previous period, or null. */
  trend: number | null;
  /** 1-based rank. */
  rank: number;
  /** Number of ranked brands. */
  rankTotal: number;
}

/**
 * Input values for creating / updating a metric row through the service.
 * Only the keys present are written (partial update); `null` clears a
 * nullable column, while an absent key leaves it untouched. `followers` is
 * NOT NULL in the schema, so it defaults to 0 when empty.
 */
export type SocialMetricValues = Partial<{
  /** NULL means "not provided" — preserved on re-record, defaults to 0 for new rows. */
  followers: number | null;
  following: number | null;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  engagementRate: number | null;
  storyViews: number | null;
  channelMembers: number | null;
  retweets: number | null;
  subscribers: number | null;
}>;

/* =========================================================================
 * Data Quality (social-data-quality service)
 * ========================================================================= */

/** Severity of one data-quality issue. */
export type SocialDataQualitySeverity = 'critical' | 'warning' | 'info';

/** Overall health status of one account (critical > warning > healthy). */
export type SocialDataQualityStatus = 'healthy' | 'warning' | 'critical';

/** Machine-readable type of a data-quality issue. */
export type SocialDataQualityIssueType =
  | 'negative_metric'
  | 'invalid_engagement_rate'
  | 'future_metric'
  | 'stale_account'
  | 'temporal_gap'
  | 'orphan_metric'
  | 'duplicate_metric'
  | 'missing_optional_field'
  | 'account_without_metrics';

/** One detected data-quality problem. */
export interface SocialDataQualityIssue {
  /** Stable, deterministic issue id. */
  id: string;
  severity: SocialDataQualitySeverity;
  type: SocialDataQualityIssueType;
  /** Account the issue belongs to (dangling id for orphan metrics). */
  accountId: string | null;
  platform: SocialPlatform | null;
  /**
   * Primary key of the `social_metrics` row the issue is tied to, when one
   * exists (negative/future/temporal-gap/duplicate/orphan/stale issues).
   * NULL for account-level issues (e.g. account without metrics, missing
   * optional field). Stable identity — used as part of the review key.
   */
  metricId: string | null;
  /** Period label of the related metric, when the issue concerns one. */
  metricDate: string | null;
  /** Metric field the issue concerns (e.g. 'storyViews'), when applicable. */
  field: SocialMetricFieldKey | null;
  /** Persian, human-readable message. */
  message: string;
  /** Optional structured context (e.g. { storedValue, gapMonths }). */
  details: Record<string, unknown> | null;
}

/** Per-account data-quality status. */
export interface SocialDataQualityAccountStatus {
  accountId: string;
  status: SocialDataQualityStatus;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

/** Headline counts for the data-quality report. */
export interface SocialDataQualitySummary {
  totalAccounts: number;
  healthyAccounts: number;
  warningAccounts: number;
  criticalAccounts: number;
  totalIssues: number;
}

/** Full read-only data-quality report (pure detector output). */
export interface SocialDataQualityReport {
  summary: SocialDataQualitySummary;
  issues: SocialDataQualityIssue[];
  accounts: SocialDataQualityAccountStatus[];
}

/* =========================================================================
 * Data Quality Review (social-data-quality-review service)
 * ========================================================================= */

/** Human review state attached to a detected issue (no data mutation). */
export type SocialDataQualityReviewStatus = 'reviewed' | 'ignored';

/** Effective review state of an issue in the merged report. */
export type SocialDataQualityIssueReviewStatus =
  'open' | SocialDataQualityReviewStatus;

/** One persisted human review row (`social_data_quality_reviews`). */
export interface SocialDataQualityReview {
  id: string;
  /** Issue type this review applies to (deterministic issue identity). */
  issueType: SocialDataQualityIssueType;
  accountId: string | null;
  metricId: number | null;
  field: SocialMetricFieldKey | null;
  status: SocialDataQualityReviewStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating / updating a review through the service. */
export interface SocialDataQualityReviewInput {
  issueType: SocialDataQualityIssueType;
  accountId: string | null;
  metricId?: number | null;
  field?: SocialMetricFieldKey | null;
  status: SocialDataQualityReviewStatus;
}

/** A detected issue with its human review state attached. */
export interface SocialDataQualityIssueWithReview extends SocialDataQualityIssue {
  /** 'open' when no review record exists. */
  reviewStatus: SocialDataQualityIssueReviewStatus;
}

/** Data-quality report merged with review states (what the API returns). */
export interface SocialDataQualityReportWithReviews {
  summary: SocialDataQualitySummary & {
    openIssues: number;
    reviewedIssues: number;
    ignoredIssues: number;
  };
  issues: SocialDataQualityIssueWithReview[];
  accounts: SocialDataQualityAccountStatus[];
}
