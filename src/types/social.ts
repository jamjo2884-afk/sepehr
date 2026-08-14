import type { ID, Timestamp } from '@/types/index';
import type { SocialPlatform } from '@/types/domain';

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
  platform: SocialPlatform;
  /** Unique handle / username on the platform. */
  username: string;
  /** Human-readable name of the account (may differ from username). */
  displayName: string | null;
  /** Public profile URL on the platform. */
  url: string | null;
  status: SocialAccountStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
