import {
  toJalaali,
  j2d,
  jalaaliMonthLength,
  jalaaliToDateObject,
} from 'jalaali-js';
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

/* =========================================================================
 * Period helpers (daily / weekly / monthly)
 * ========================================================================= */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Build a sortable, human-readable period label for a date.
 *
 * - monthly: '1404-08' (Jalali YYYY-MM, same format as the historical import)
 * - daily:   '1404-08-14' (Jalali YYYY-MM-DD)
 * - weekly:  '1404-W33' (Jalali year + week number, week starts Saturday)
 *
 * All labels sort lexicographically within their granularity, and the
 * monthly label is exactly the format already stored in `social_metrics`.
 */
export function periodLabelForDate(
  date: Date,
  period: SocialMetricPeriod,
): string {
  const { jy, jm, jd } = toJalaali(date);
  if (period === 'monthly') return `${jy}-${pad2(jm)}`;
  if (period === 'daily') return `${jy}-${pad2(jm)}-${pad2(jd)}`;
  const startOfYear = j2d(jy, 1, 1);
  const dayOfYear = j2d(jy, jm, jd) - startOfYear + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${jy}-W${pad2(week)}`;
}

/** ISO date range for a stored period label. Null when the label is unparsable. */
export function periodRangeForLabel(
  period: SocialMetricPeriod,
  periodLabel: string,
): { start: string; end: string } | null {
  if (period === 'monthly') {
    const m = periodLabel.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const jy = Number(m[1]);
    const jm = Number(m[2]);
    const start = jalaaliToDateObject(jy, jm, 1);
    const end = jalaaliToDateObject(jy, jm, jalaaliMonthLength(jy, jm));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === 'daily') {
    const m = periodLabel.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = jalaaliToDateObject(Number(m[1]), Number(m[2]), Number(m[3]));
    return { start: d.toISOString(), end: d.toISOString() };
  }
  // weekly labels ('1404-W33') can't be converted without an anchor year
  // table; callers that need the range should pass an anchor date instead.
  return null;
}

/**
 * ISO date range for a weekly period label, anchored on a real date within
 * that week (used to resolve the Jalali week number).
 */
export function weeklyRangeForDate(anchor: Date): {
  label: string;
  start: string;
  end: string;
} {
  const { jy, jm, jd } = toJalaali(anchor);
  const startOfYear = j2d(jy, 1, 1);
  const dayOfYear = j2d(jy, jm, jd) - startOfYear + 1;
  const week = Math.ceil(dayOfYear / 7);
  const start = jalaaliToDateObject(jy, jm, jd);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    label: `${jy}-W${pad2(week)}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Whether a metric falls inside an ISO date range (inclusive). Metrics
 * without periodStart are excluded.
 */
export function metricInRange(
  metric: SocialMetric,
  start: string,
  end: string,
): boolean {
  if (!metric.periodStart) return false;
  return metric.periodStart >= start && metric.periodStart <= end;
}

/** Keep only metrics whose periodStart falls inside [start, end]. */
export function metricsInRange(
  metrics: SocialMetric[],
  start: string,
  end: string,
): SocialMetric[] {
  return metrics.filter((m) => metricInRange(m, start, end));
}

/**
 * Split metrics into `windowSize`-sized trailing windows (e.g. 7 daily
 * points = one week). Returns windows ordered oldest → newest; the last
 * window is the most recent.
 */
export function splitWindows(
  metrics: SocialMetric[],
  windowSize: number,
): SocialMetric[][] {
  const sorted = sortMetricsByPeriod(metrics);
  const windows: SocialMetric[][] = [];
  for (let i = 0; i < sorted.length; i += windowSize) {
    windows.push(sorted.slice(i, i + windowSize));
  }
  return windows;
}

/**
 * Aggregate one window of metrics into a single synthetic metric row.
 * Snapshot columns (followers, following, channel members, subscribers)
 * take the latest value; flow columns (posts, views, likes, …) are summed;
 * engagement rate is averaged.
 */
export function aggregateWindow(metrics: SocialMetric[]): SocialMetric | null {
  const sorted = sortMetricsByPeriod(metrics);
  if (sorted.length === 0) return null;
  const latest = sorted[sorted.length - 1];
  const sum = (pick: (m: SocialMetric) => number | null): number | null => {
    const values = sorted
      .map(pick)
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
  };
  const avg = (pick: (m: SocialMetric) => number | null): number | null => {
    const values = sorted
      .map(pick)
      .filter((v): v is number => typeof v === 'number');
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };
  return {
    id: latest.id,
    accountId: latest.accountId,
    period: latest.period,
    periodLabel: latest.periodLabel,
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    followers: latest.followers,
    following: latest.following,
    posts: sum((m) => m.posts),
    views: sum((m) => m.views),
    likes: sum((m) => m.likes),
    comments: sum((m) => m.comments),
    shares: sum((m) => m.shares),
    saves: sum((m) => m.saves),
    reach: sum((m) => m.reach),
    impressions: sum((m) => m.impressions),
    engagementRate: avg((m) => m.engagementRate),
    storyViews: sum((m) => m.storyViews),
    channelMembers: latest.channelMembers,
    retweets: sum((m) => m.retweets),
    subscribers: latest.subscribers,
    createdAt: latest.createdAt,
    updatedAt: latest.updatedAt,
  };
}

/**
 * Compare the two most recent non-overlapping windows of a fixed size.
 * E.g. for daily metrics with windowSize=7 this compares this week vs the
 * previous week. Returns null when there aren't two full windows.
 */
export function compareWindows(
  metrics: SocialMetric[],
  windowSize: number,
): SocialPeriodComparison | null {
  const windows = splitWindows(metrics, windowSize);
  if (windows.length < 2) return null;
  const current = aggregateWindow(windows[windows.length - 1]);
  const previous = aggregateWindow(windows[windows.length - 2]);
  if (!current || !previous) return null;
  return {
    current,
    previous,
    absoluteGrowth: absoluteGrowth(current.followers, previous.followers),
    percentageGrowth: percentageGrowth(current.followers, previous.followers),
  };
}

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

/**
 * Sort metrics chronologically. Prefers `periodStart` (ISO) when both rows
 * have it; falls back to `periodLabel` string compare (works for '1404-08'
 * and '1404-08-14' within one granularity).
 */
export function sortMetricsByPeriod(metrics: SocialMetric[]): SocialMetric[] {
  return [...metrics].sort((a, b) => {
    if (a.periodStart && b.periodStart && a.periodStart !== b.periodStart) {
      return a.periodStart < b.periodStart ? -1 : 1;
    }
    return a.periodLabel < b.periodLabel
      ? -1
      : a.periodLabel > b.periodLabel
        ? 1
        : 0;
  });
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
