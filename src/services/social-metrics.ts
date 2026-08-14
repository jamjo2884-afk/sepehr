import type {
  SocialMetric,
  SocialMetricPeriod,
  SocialMetricSummary,
  SocialPeriodComparison,
} from '@/types/social';

/**
 * Single source of truth for social-metric calculations.
 *
 * Every growth / engagement / summary formula used by the app lives here so
 * numbers are consistent across pages and future features. Never duplicate
 * these formulas in services or components.
 */

/** Absolute change: current - previous. */
export function absoluteGrowth(current: number, previous: number): number {
  return current - previous;
}

/**
 * Percentage change: ((current - previous) / previous) * 100.
 * Returns 0 when the previous value is 0 or missing (undefined growth).
 */
export function percentageGrowth(current: number, previous: number): number {
  if (!previous || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

/** Engagement total for one metric row: likes + comments + shares. */
export function totalEngagement(metric: SocialMetric): number {
  return (metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0);
}

/** Average engagement rate across a list of metrics (%). */
export function averageEngagementRate(metrics: SocialMetric[]): number {
  const rates = metrics
    .map((m) => m.engagementRate)
    .filter((r): r is number => typeof r === 'number');
  if (rates.length === 0) return 0;
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}

/** Sort metrics by periodLabel ascending (string compare works for '1404-08'). */
export function sortMetricsByPeriod(metrics: SocialMetric[]): SocialMetric[] {
  return [...metrics].sort((a, b) =>
    a.periodLabel < b.periodLabel ? -1 : a.periodLabel > b.periodLabel ? 1 : 0,
  );
}

/** Latest metric by periodLabel, or null when empty. */
export function latestMetric(metrics: SocialMetric[]): SocialMetric | null {
  const sorted = sortMetricsByPeriod(metrics);
  return sorted[sorted.length - 1] ?? null;
}

/** Earliest metric by periodLabel, or null when empty. */
export function firstMetric(metrics: SocialMetric[]): SocialMetric | null {
  const sorted = sortMetricsByPeriod(metrics);
  return sorted[0] ?? null;
}

/**
 * Compare the latest period against the previous one for a list of metrics.
 * Returns null when there are fewer than 2 periods.
 */
export function comparePeriods(
  metrics: SocialMetric[],
): SocialPeriodComparison | null {
  const sorted = sortMetricsByPeriod(metrics);
  if (sorted.length < 2) return null;
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  return {
    current,
    previous,
    absoluteGrowth: absoluteGrowth(current.followers, previous.followers),
    percentageGrowth: percentageGrowth(current.followers, previous.followers),
  };
}

/**
 * Build a summary over a list of metrics for a period granularity.
 * Uses the latest available follower count as the headline number.
 */
export function summarizeMetrics(
  metrics: SocialMetric[],
  period: SocialMetricPeriod = 'monthly',
): SocialMetricSummary {
  const sorted = sortMetricsByPeriod(metrics);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const comparison = comparePeriods(sorted);

  const empty: SocialMetricSummary = {
    period,
    periodStart: null,
    periodEnd: null,
    followers: 0,
    absoluteGrowth: 0,
    percentageGrowth: 0,
    firstFollowers: 0,
    lastFollowers: 0,
    totalViews: 0,
    totalEngagement: 0,
    averageEngagementRate: 0,
    metricCount: 0,
  };
  if (!first || !last) return empty;

  return {
    period,
    periodStart: first.periodLabel,
    periodEnd: last.periodLabel,
    followers: last.followers,
    absoluteGrowth: comparison?.absoluteGrowth ?? 0,
    percentageGrowth: comparison?.percentageGrowth ?? 0,
    firstFollowers: first.followers,
    lastFollowers: last.followers,
    totalViews: sorted.reduce((sum, m) => sum + (m.views ?? 0), 0),
    totalEngagement: sorted.reduce((sum, m) => sum + totalEngagement(m), 0),
    averageEngagementRate: averageEngagementRate(sorted),
    metricCount: sorted.length,
  };
}
