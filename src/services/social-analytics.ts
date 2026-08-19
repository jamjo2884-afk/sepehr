import { toJalaali, jalaaliToDateObject, jalaaliMonthLength } from 'jalaali-js';
import { PERSIAN_MONTHS } from '@/constants/ui.constants';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import {
  absoluteGrowth,
  percentageGrowth,
  sortMetricsByPeriod,
  totalEngagement,
} from '@/services/social-metrics';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialBrandOverview,
  SocialBrandPlatformRow,
  SocialBrandPlatformTimelineRow,
  SocialBrandRanking,
  SocialBrandStat,
  SocialBrandTrend,
  SocialDataFreshness,
  SocialEntityStat,
  SocialGrowthDriver,
  SocialKpiComparison,
  SocialKpiKey,
  SocialKpis,
  SocialMetric,
  SocialMetricValueComparison,
  SocialMonthlyGrowthPoint,
  SocialMonthRange,
  SocialPeerComparisonItem,
  SocialPlatformStat,
  SocialRangePreset,
  SocialTrendPoint,
} from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';

/**
 * Pure analytics layer for the social-media dashboard.
 *
 * Everything here is a pure function over `SocialAccount[]` +
 * `SocialMetric[]` (as returned by the service layer) — no Supabase, no UI.
 * Month ranges are expressed as sortable Jalali 'YYYY-MM' labels because the
 * historical import stores months that way and `period_start` is not
 * populated for imported rows.
 *
 * All growth / engagement formulas come from `social-metrics.ts` — they are
 * never duplicated here.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/* =========================================================================
 * Jalali month helpers
 * ========================================================================= */

/** Current Jalali month as a sortable 'YYYY-MM' label. */
export function currentJalaliMonth(): string {
  const { jy, jm } = toJalaali(new Date());
  return `${jy}-${pad2(jm)}`;
}

/** Add `delta` months to a 'YYYY-MM' Jalali label (delta may be negative). */
export function jalaliAddMonths(label: string, delta: number): string {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (!m) return label;
  const idx = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

/** Number of months between two 'YYYY-MM' labels (inclusive difference). */
export function monthsBetween(start: string, end: string): number {
  const ms = start.match(/^(\d{4})-(\d{2})$/);
  const me = end.match(/^(\d{4})-(\d{2})$/);
  if (!ms || !me) return 0;
  return (Number(me[1]) - Number(ms[1])) * 12 + (Number(me[2]) - Number(ms[2]));
}

/** '1404-08' → 'مرداد ۱۴۰۴'. */
export function jalaliMonthName(label: string): string {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (!m) return label;
  return `${PERSIAN_MONTHS[Number(m[2]) - 1]} ${toPersianDigits(m[1])}`;
}

/* =========================================================================
 * Range presets
 * ========================================================================= */

/** Build a month range for a preset. 'custom' returns the current month; the
 * caller is expected to override it with the user's selection. */
export function monthRangeOfPreset(
  preset: SocialRangePreset,
): SocialMonthRange {
  const now = currentJalaliMonth();
  switch (preset) {
    case 'current':
      return { start: now, end: now };
    case 'previous': {
      const prev = jalaliAddMonths(now, -1);
      return { start: prev, end: prev };
    }
    case '3m':
      return { start: jalaliAddMonths(now, -2), end: now };
    case '6m':
      return { start: jalaliAddMonths(now, -5), end: now };
    case '12m':
      return { start: jalaliAddMonths(now, -11), end: now };
    case '24m':
      return { start: jalaliAddMonths(now, -23), end: now };
    case 'custom':
      return { start: now, end: now };
  }
}

/**
 * The window of the same length immediately before `range`. Used for
 * period-over-period comparison (3 months → previous 3 months, etc.).
 */
export function previousMonthRange(range: SocialMonthRange): SocialMonthRange {
  const len = monthsBetween(range.start, range.end) + 1;
  return {
    start: jalaliAddMonths(range.start, -len),
    end: jalaliAddMonths(range.end, -len),
  };
}

/* =========================================================================
 * Filtering
 * ========================================================================= */

/** Keep metrics whose periodLabel falls inside [start, end] (inclusive). */
export function metricsInMonthRange(
  metrics: SocialMetric[],
  range: SocialMonthRange,
): SocialMetric[] {
  return metrics.filter(
    (m) => m.periodLabel >= range.start && m.periodLabel <= range.end,
  );
}

/**
 * Keep only the accounts matching the selected brands / platforms.
 * An empty brands array means "all brands"; same for platforms.
 */
export function filterAccounts(
  accounts: SocialAccount[],
  brands: string[],
  platforms: SocialPlatform[],
): SocialAccount[] {
  return accounts.filter(
    (a) =>
      (brands.length === 0 || brands.includes(a.brand)) &&
      (platforms.length === 0 || platforms.includes(a.platform)),
  );
}

/* =========================================================================
 * KPI computation
 * ========================================================================= */

/** Group metrics by account, preserving order. */
function groupByAccount(metrics: SocialMetric[]): Map<string, SocialMetric[]> {
  const map = new Map<string, SocialMetric[]>();
  for (const m of metrics) {
    const list = map.get(m.accountId) ?? [];
    list.push(m);
    map.set(m.accountId, list);
  }
  return map;
}

/** Latest metric of a per-account list (by periodLabel / periodStart). */
function latestOf(list: SocialMetric[]): SocialMetric | null {
  const sorted = sortMetricsByPeriod(list);
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Headline KPIs over `metrics` restricted to `range`.
 *
 * - followers: the latest follower count per account inside the range,
 *   summed across accounts — historical rows are NOT summed (snapshot).
 * - views / engagement / posts: summed across every row in the range
 *   (flow metrics for the period).
 * - engagementRate: averaged across the range.
 *
 * `accountFilter` (optional) restricts the accounts included (used for the
 * per-brand / per-platform tables without re-filtering the metrics list).
 */
export function computeKpis(
  metrics: SocialMetric[],
  range: SocialMonthRange,
  accountFilter?: Set<string>,
): SocialKpis {
  const byAccount = groupByAccount(metricsInMonthRange(metrics, range));

  let followers = 0;
  let views = 0;
  let engagement = 0;
  let posts = 0;
  let accountCount = 0;
  const rates: number[] = [];

  // Follower count is a snapshot: only the latest value per account counts.
  for (const [accountId, list] of byAccount) {
    if (accountFilter && !accountFilter.has(accountId)) continue;
    const latest = latestOf(list);
    if (!latest) continue;
    accountCount += 1;
    followers += latest.followers;
    if (typeof latest.engagementRate === 'number') {
      rates.push(latest.engagementRate);
    }
  }

  // Flow metrics (views / engagement / posts) are period totals: sum every
  // row in the range once.
  for (const m of metricsInMonthRange(metrics, range)) {
    if (accountFilter && !accountFilter.has(m.accountId)) continue;
    views += m.views ?? 0;
    engagement += totalEngagement(m) + (m.saves ?? 0);
    posts += m.posts ?? 0;
  }

  return {
    followers,
    views,
    engagement,
    engagementRate:
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
    posts,
    accountCount,
  };
}

/** KPIs for a specific set of accounts (brand / platform slice). */
export function computeKpisForAccounts(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  range: SocialMonthRange,
): SocialKpis {
  return computeKpis(metrics, range, new Set(accounts.map((a) => a.id)));
}

/** Compare every KPI between the current and the previous window. */
export function computeKpiComparison(
  current: SocialKpis,
  previous: SocialKpis,
): SocialKpiComparison[] {
  const items: Array<{ key: SocialKpiKey; label: string }> = [
    { key: 'followers', label: 'دنبال‌کنندگان' },
    { key: 'views', label: 'بازدید' },
    { key: 'engagement', label: 'تعامل' },
    { key: 'posts', label: 'محتوا' },
    { key: 'engagementRate', label: 'نرخ تعامل' },
  ];
  return items.map(({ key, label }) => ({
    key,
    label,
    current: current[key],
    previous: previous[key],
    absoluteChange: absoluteGrowth(current[key], previous[key]),
    changePct: percentageGrowth(current[key], previous[key]),
  }));
}

/* =========================================================================
 * Trend series
 * ========================================================================= */

/**
 * Aggregate follower trend across the selected accounts: one point per month
 * present in the data, summed across accounts. Months with no data are not
 * fabricated.
 */
export function buildFollowersTrend(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  range: SocialMonthRange,
): SocialTrendPoint[] {
  const ids = new Set(accounts.map((a) => a.id));
  const inRange = metricsInMonthRange(metrics, range).filter((m) =>
    ids.has(m.accountId),
  );
  const byMonth = new Map<string, number>();
  for (const m of inRange) {
    byMonth.set(m.periodLabel, (byMonth.get(m.periodLabel) ?? 0) + m.followers);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, followers]) => ({
      month,
      monthLabel: jalaliMonthName(month),
      followers,
    }));
}

/** One follower trend per brand (multi-brand comparison on one chart). */
export function buildBrandTrends(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  range: SocialMonthRange,
): SocialBrandTrend[] {
  const brands = [...new Set(accounts.map((a) => a.brand))];
  const idsByBrand = new Map<string, Set<string>>();
  for (const a of accounts) {
    const set = idsByBrand.get(a.brand) ?? new Set<string>();
    set.add(a.id);
    idsByBrand.set(a.brand, set);
  }
  const inRange = metricsInMonthRange(metrics, range);
  return brands.map((brand) => {
    const ids = idsByBrand.get(brand) ?? new Set<string>();
    const byMonth = new Map<string, number>();
    for (const m of inRange) {
      if (!ids.has(m.accountId)) continue;
      byMonth.set(
        m.periodLabel,
        (byMonth.get(m.periodLabel) ?? 0) + m.followers,
      );
    }
    const points: SocialTrendPoint[] = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([month, followers]) => ({
        month,
        monthLabel: jalaliMonthName(month),
        followers,
      }));
    return { brand, points };
  });
}

/** Month-over-month percentage growth of a follower trend. */
export function monthlyGrowthSeries(
  series: SocialTrendPoint[],
): SocialMonthlyGrowthPoint[] {
  return series.slice(1).map((point, i) => {
    const prev = series[i];
    return {
      month: point.month,
      monthLabel: point.monthLabel,
      change: absoluteGrowth(point.followers, prev.followers),
      growthPct: percentageGrowth(point.followers, prev.followers),
    };
  });
}

/* =========================================================================
 * Platform trend series
 * ========================================================================= */

/** Follower trend of one platform (for multi-platform comparison). */
export interface SocialPlatformTrend {
  platform: SocialPlatform;
  points: SocialTrendPoint[];
}

/**
 * One follower trend per platform (multi-platform comparison chart).
 * Aggregates followers across all accounts belonging to each platform.
 * Months with no data for a platform are excluded (no fabricated values).
 */
export function buildPlatformTrends(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  range: SocialMonthRange,
): SocialPlatformTrend[] {
  const platformSet = [...new Set(accounts.map((a) => a.platform))];
  const idsByPlatform = new Map<SocialPlatform, Set<string>>();
  for (const a of accounts) {
    const set = idsByPlatform.get(a.platform) ?? new Set<string>();
    set.add(a.id);
    idsByPlatform.set(a.platform, set);
  }
  const inRange = metricsInMonthRange(metrics, range);
  return platformSet.map((platform) => {
    const ids = idsByPlatform.get(platform) ?? new Set<string>();
    const byMonth = new Map<string, number>();
    for (const m of inRange) {
      if (!ids.has(m.accountId)) continue;
      byMonth.set(
        m.periodLabel,
        (byMonth.get(m.periodLabel) ?? 0) + m.followers,
      );
    }
    const points: SocialTrendPoint[] = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([month, followers]) => ({
        month,
        monthLabel: jalaliMonthName(month),
        followers,
      }));
    return { platform, points };
  });
}

/* =========================================================================
 * Brand performance analytics
 * ========================================================================= */

/** Which series a brand trend chart can plot. */
export type SocialBrandTrendMetric = 'followers' | 'views' | 'engagement';

/**
 * Monthly series of one indicator for one brand (summed across its
 * accounts). Only months with real data are included — gaps are not
 * fabricated. Views / engagement are null when no data exists for that
 * month.
 */
export function buildBrandTrendSeries(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
  metric: SocialBrandTrendMetric,
): Array<{ month: string; monthLabel: string; value: number | null }> {
  const ids = new Set(
    accounts.filter((a) => a.brand === brand).map((a) => a.id),
  );
  const inBrand = metrics.filter((m) => ids.has(m.accountId));
  const byMonth = new Map<string, SocialMetric[]>();
  for (const m of sortMetricsByPeriod(inBrand)) {
    const list = byMonth.get(m.periodLabel) ?? [];
    list.push(m);
    byMonth.set(m.periodLabel, list);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, list]) => {
      let value: number | null = null;
      if (metric === 'followers') {
        value = list.reduce((sum, m) => sum + m.followers, 0);
      } else if (metric === 'views') {
        value = sumOrNull(list, (m) => m.views);
      } else {
        value = sumOrNull(list, (m) => totalEngagement(m));
      }
      return { month, monthLabel: jalaliMonthName(month), value };
    });
}

/* =========================================================================
 * Brand performance analytics
 * ========================================================================= */

/**
 * How old (in days) a platform's latest metric may be before it is shown
 * as 'قدیمی' instead of 'به‌روز'. Kept here as the single source of truth
 * (never hardcoded in components).
 */
export const SOCIAL_DATA_STALE_DAYS = 60;

/**
 * Latest metric of each account (by period), for snapshot-style stats that
 * must not double count historical rows.
 */
function latestMetricsByAccountMap(
  metrics: SocialMetric[],
): Map<string, SocialMetric> {
  const map = new Map<string, SocialMetric>();
  for (const m of sortMetricsByPeriod(metrics)) {
    map.set(m.accountId, m);
  }
  return map;
}

/** Sum only non-null values; null when no value exists at all. */
function sumOrNull(
  metrics: SocialMetric[],
  pick: (m: SocialMetric) => number | null,
): number | null {
  const values = metrics
    .map(pick)
    .filter((v): v is number => typeof v === 'number');
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
}

/** Average only non-null values; null when none exist. */
function avgOrNull(
  metrics: SocialMetric[],
  pick: (m: SocialMetric) => number | null,
): number | null {
  const values = metrics
    .map(pick)
    .filter((v): v is number => typeof v === 'number');
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/** Whether any metric in the list has a real engagement value. */
function hasRealEngagement(metrics: SocialMetric[]): boolean {
  return metrics.some(
    (m) => m.likes !== null || m.comments !== null || m.shares !== null,
  );
}

/** Distinct period labels of a metric list, sorted ascending. */
function distinctPeriodLabels(metrics: SocialMetric[]): string[] {
  return [...new Set(metrics.map((m) => m.periodLabel))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

/**
 * Latest and previous period labels of a metric list (per its own series),
 * so growth is measured between whole periods, not between the two newest
 * rows (which may belong to different accounts of a multi-account brand).
 */
function latestTwoPeriods(metrics: SocialMetric[]): {
  latest: string | null;
  previous: string | null;
} {
  const labels = distinctPeriodLabels(metrics);
  if (labels.length === 0) return { latest: null, previous: null };
  if (labels.length === 1) return { latest: labels[0], previous: null };
  return {
    latest: labels[labels.length - 1],
    previous: labels[labels.length - 2],
  };
}

/** Sum of `followers` over the metrics of one period label. */
function followersOfPeriod(
  metrics: SocialMetric[],
  periodLabel: string,
): number {
  return metrics
    .filter((m) => m.periodLabel === periodLabel)
    .reduce((sum, m) => sum + m.followers, 0);
}

/**
 * Headline stats of one brand over its full history (latest snapshot for
 * followers, summed flow metrics for views / engagement / posts). A flow
 * metric is null when the brand has NO real data for it anywhere.
 */
export function buildBrandOverview(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialBrandOverview {
  const brandAccounts = accounts.filter((a) => a.brand === brand);
  const brandMetrics = metrics.filter((m) =>
    brandAccounts.some((a) => a.id === m.accountId),
  );
  const latestByAccount = latestMetricsByAccountMap(brandMetrics);
  const sortedMetrics = sortMetricsByPeriod(brandMetrics);
  const latest = sortedMetrics[sortedMetrics.length - 1] ?? null;
  const { latest: latestPeriod, previous: previousPeriod } =
    latestTwoPeriods(brandMetrics);

  const activeAccounts = brandAccounts.filter((a) =>
    latestByAccount.has(a.id),
  ).length;
  const followers = [...latestByAccount.values()].reduce(
    (sum, m) => sum + m.followers,
    0,
  );

  let growth: number | null = null;
  let growthPct: number | null = null;
  if (latestPeriod && previousPeriod) {
    const currentTotal = followersOfPeriod(brandMetrics, latestPeriod);
    const previousTotal = followersOfPeriod(brandMetrics, previousPeriod);
    growth = absoluteGrowth(currentTotal, previousTotal);
    growthPct = percentageGrowth(currentTotal, previousTotal);
  }

  const latestAccount = latest
    ? (brandAccounts.find((a) => a.id === latest.accountId) ?? null)
    : null;

  return {
    brand,
    activeAccounts,
    followers,
    growth,
    growthPct,
    views: sumOrNull(brandMetrics, (m) => m.views),
    engagement: hasRealEngagement(brandMetrics)
      ? sumOrNull(brandMetrics, (m) => totalEngagement(m))
      : null,
    engagementRate: avgOrNull(brandMetrics, (m) => m.engagementRate),
    posts: sumOrNull(brandMetrics, (m) => m.posts),
    latestPeriodLabel: latestPeriod,
    latestAccountName: latestAccount?.username ?? null,
  };
}

/**
 * Per-platform performance of one brand over its full history. Growth is
 * measured between the latest two periods of the platform's own series.
 */
export function buildBrandPlatformPerformance(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialBrandPlatformRow[] {
  const brandAccounts = accounts.filter((a) => a.brand === brand);
  const platforms = [...new Set(brandAccounts.map((a) => a.platform))];

  return platforms
    .map((platform) => {
      const platformAccounts = brandAccounts.filter(
        (a) => a.platform === platform,
      );
      const ids = new Set(platformAccounts.map((a) => a.id));
      const platformMetrics = metrics.filter((m) => ids.has(m.accountId));
      const latestByAccount = latestMetricsByAccountMap(platformMetrics);
      const sorted = sortMetricsByPeriod(platformMetrics);
      const latest = sorted[sorted.length - 1] ?? null;
      const { latest: latestPeriod, previous: previousPeriod } =
        latestTwoPeriods(platformMetrics);

      let growth: number | null = null;
      let growthPct: number | null = null;
      if (latestPeriod && previousPeriod) {
        growth = absoluteGrowth(
          followersOfPeriod(platformMetrics, latestPeriod),
          followersOfPeriod(platformMetrics, previousPeriod),
        );
        growthPct = percentageGrowth(
          followersOfPeriod(platformMetrics, latestPeriod),
          followersOfPeriod(platformMetrics, previousPeriod),
        );
      }

      return {
        platform,
        followers: [...latestByAccount.values()].reduce(
          (sum, m) => sum + m.followers,
          0,
        ),
        growth,
        growthPct,
        views: sumOrNull(platformMetrics, (m) => m.views),
        engagement: hasRealEngagement(platformMetrics)
          ? sumOrNull(platformMetrics, (m) => totalEngagement(m))
          : null,
        engagementRate: avgOrNull(platformMetrics, (m) => m.engagementRate),
        posts: sumOrNull(platformMetrics, (m) => m.posts),
        latestPeriodLabel: latest?.periodLabel ?? null,
        accounts: platformAccounts.length,
      };
    })
    .sort((a, b) => b.followers - a.followers);
}

/**
 * Compare one brand against the average of the other brands. Each average
 * is computed only from the brands that have real data for that indicator
 * (e.g. average views uses only the brands with views).
 */
export function buildBrandPeerComparison(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialPeerComparisonItem[] {
  const brands = [...new Set(accounts.map((a) => a.brand))].filter(
    (b) => b !== brand,
  );
  const labels: Array<{ key: SocialKpiKey; label: string }> = [
    { key: 'followers', label: 'دنبال‌کنندگان' },
    { key: 'views', label: 'بازدید' },
    { key: 'engagement', label: 'تعامل' },
    { key: 'posts', label: 'محتوا' },
  ];

  return labels.map(({ key, label }) => {
    const brandOverview = buildBrandOverview(accounts, metrics, brand);
    const brandValue =
      key === 'followers'
        ? brandOverview.followers
        : (brandOverview[key] ?? null);

    const peerValues: number[] = [];
    for (const other of brands) {
      const overview = buildBrandOverview(accounts, metrics, other);
      const value =
        key === 'followers' ? overview.followers : (overview[key] ?? null);
      if (typeof value === 'number' && value > 0) peerValues.push(value);
    }

    const peersAverage =
      peerValues.length > 0
        ? peerValues.reduce((a, b) => a + b, 0) / peerValues.length
        : null;
    const difference =
      typeof brandValue === 'number' && peersAverage !== null
        ? brandValue - peersAverage
        : null;
    return {
      key,
      label,
      brand: brandValue,
      peersAverage,
      peersCount: peerValues.length,
      difference,
    };
  });
}

/**
 * 1-based rank of one brand for each indicator among all brands that have
 * real data for it (1 = highest). Null when the brand has no data.
 */
export function buildBrandRankings(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialBrandRanking[] {
  const brands = [...new Set(accounts.map((a) => a.brand))];
  const labels: Array<{ key: SocialKpiKey; label: string }> = [
    { key: 'followers', label: 'دنبال‌کنندگان' },
    { key: 'views', label: 'بازدید' },
    { key: 'engagement', label: 'تعامل' },
    { key: 'posts', label: 'محتوا' },
  ];

  return labels.map(({ key, label }) => {
    const values = brands
      .map((b) => {
        const overview = buildBrandOverview(accounts, metrics, b);
        const value =
          key === 'followers' ? overview.followers : (overview[key] ?? null);
        return { brand: b, value };
      })
      .filter(
        (v): v is { brand: string; value: number } =>
          typeof v.value === 'number' && v.value > 0,
      )
      .sort((a, b) => b.value - a.value);

    const own = values.find((v) => v.brand === brand) ?? null;
    return {
      key,
      label,
      value: own?.value ?? null,
      rank: own ? values.indexOf(own) + 1 : null,
      total: values.length,
    };
  });
}

/**
 * Freshness of each platform's latest metric vs. today, using the Jalali
 * month label (end of month as the reference date). 'stale' when the
 * latest metric is older than SOCIAL_DATA_STALE_DAYS.
 */
export function buildBrandPlatformTimeline(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialBrandPlatformTimelineRow[] {
  const brandAccounts = accounts.filter((a) => a.brand === brand);
  const platforms = [...new Set(brandAccounts.map((a) => a.platform))];
  const now = new Date();

  return platforms.map((platform) => {
    const ids = new Set(
      brandAccounts.filter((a) => a.platform === platform).map((a) => a.id),
    );
    const sorted = sortMetricsByPeriod(
      metrics.filter((m) => ids.has(m.accountId)),
    );
    const latest = sorted[sorted.length - 1] ?? null;
    if (!latest) {
      return { platform, latestPeriodLabel: null, freshness: 'no-data' };
    }
    const ageDays = ageOfPeriodLabelDays(latest.periodLabel, now);
    const freshness: SocialDataFreshness =
      ageDays === null || ageDays <= SOCIAL_DATA_STALE_DAYS
        ? 'up-to-date'
        : 'stale';
    return { platform, latestPeriodLabel: latest.periodLabel, freshness };
  });
}

/** Approximate age in days of a 'YYYY-MM' Jalali label vs. now (end of month). */
export function ageOfPeriodLabelDays(label: string, now: Date): number | null {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const end = jalaaliToDateObject(jy, jm, jalaaliMonthLength(jy, jm));
  const ms = now.getTime() - end.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Rule-based growth insights for a brand. No AI, no fabricated text: only
 * conclusions that follow directly from the data (or an explicit
 * 'not enough data' note).
 */
export function buildBrandGrowthDrivers(
  rows: SocialBrandPlatformRow[],
): SocialGrowthDriver[] {
  const drivers: SocialGrowthDriver[] = [];
  // A zero growth is "no change", not a positive or negative driver — it
  // must not be presented as the best/worst platform.
  const withGrowth = rows.filter(
    (r): r is SocialBrandPlatformRow & { growth: number; growthPct: number } =>
      r.growth !== null && r.growth !== 0 && r.growthPct !== null,
  );

  if (withGrowth.length === 0) {
    drivers.push({
      type: 'info',
      text: 'داده کافی برای تحلیل عوامل رشد وجود ندارد.',
    });
    return drivers;
  }

  const sorted = [...withGrowth].sort((a, b) => b.growth - a.growth);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const totalGrowth = rows.reduce((sum, r) => sum + (r.growth ?? 0), 0);

  if (totalGrowth > 0) {
    drivers.push({
      type: 'positive',
      text: `بخش عمدهٔ رشد دنبال‌کنندگان از ${SOCIAL_PLATFORM_LABELS[best.platform]} حاصل شده است (${formatGrowthPctSafe(best.growthPct)}).`,
    });
  } else if (totalGrowth < 0) {
    drivers.push({
      type: 'negative',
      text: `بیشترین افت دنبال‌کنندگان در ${SOCIAL_PLATFORM_LABELS[worst.platform]} ثبت شده است (${formatGrowthPctSafe(worst.growthPct)}).`,
    });
  } else {
    drivers.push({
      type: 'info',
      text: 'مجموع رشد دنبال‌کنندگان در آخرین دوره تقریباً صفر بوده است.',
    });
  }

  if (best !== worst && totalGrowth > 0) {
    drivers.push({
      type: 'info',
      text: `${SOCIAL_PLATFORM_LABELS[best.platform]} با ${formatNumber(Math.abs(best.growth ?? 0))} دنبال‌کنندهٔ جدید، بیشترین سهم را در رشد داشته است.`,
    });
  }

  const withEngagement = rows.filter(
    (r): r is SocialBrandPlatformRow & { engagement: number } =>
      typeof r.engagement === 'number' && r.engagement > 0,
  );
  if (withEngagement.length > 0) {
    const top = withEngagement.sort((a, b) => b.engagement - a.engagement)[0];
    drivers.push({
      type: 'info',
      text: `بیشترین تعامل در ${SOCIAL_PLATFORM_LABELS[top.platform]} ثبت شده است.`,
    });
  }

  return drivers;
}

function formatGrowthPctSafe(value: number | null): string {
  if (value === null) return '۰٪';
  return `${toPersianDigits(String(Math.round(Math.abs(value) * 10) / 10))}٪`;
}

/* =========================================================================
 * Brand period comparison
 * ========================================================================= */

/**
 * Latest and previous period labels of one brand (whole periods, so a
 * multi-account brand compares month-to-month, never two arbitrary rows).
 */
export function latestBrandPeriods(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): { latest: string | null; previous: string | null } {
  const ids = new Set(
    accounts.filter((a) => a.brand === brand).map((a) => a.id),
  );
  const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
  return latestTwoPeriods(brandMetrics);
}

/**
 * Compare every metric field between the brand's latest and previous
 * period, summing across the brand's accounts per period. Unlike
 * `compareMetricValues` (per-account, two newest rows), this compares
 * whole periods so a multi-account brand never mixes accounts. A field is
 * included only when at least one side has a real value.
 */
export function compareBrandPeriods(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialMetricValueComparison[] {
  const ids = new Set(
    accounts.filter((a) => a.brand === brand).map((a) => a.id),
  );
  const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
  const { latest, previous } = latestTwoPeriods(brandMetrics);
  if (!latest || !previous) return [];

  const current = brandMetrics.filter((m) => m.periodLabel === latest);
  const prev = brandMetrics.filter((m) => m.periodLabel === previous);

  const out: SocialMetricValueComparison[] = [];
  for (const key of Object.keys(
    SOCIAL_METRIC_FIELDS,
  ) as SocialMetricFieldKey[]) {
    const column = METRIC_COLUMN_BY_FIELD_KEY_BRAND[key];
    const cur = aggregateBrandField(current, key, column);
    const prevVal = aggregateBrandField(prev, key, column);
    if (cur === null && prevVal === null) continue;
    out.push({
      key,
      label: SOCIAL_METRIC_FIELDS[key].label,
      current: cur,
      previous: prevVal,
      absoluteChange:
        cur !== null && prevVal !== null ? absoluteGrowth(cur, prevVal) : null,
      changePct:
        cur !== null && prevVal !== null
          ? percentageGrowth(cur, prevVal)
          : null,
    });
  }

  // Engagement (likes + comments + shares) as an aggregate field.
  const curEngagement = hasRealEngagement(current)
    ? sumOrNull(current, (m) => totalEngagement(m))
    : null;
  const prevEngagement = hasRealEngagement(prev)
    ? sumOrNull(prev, (m) => totalEngagement(m))
    : null;
  if (curEngagement !== null || prevEngagement !== null) {
    out.push({
      key: 'engagement' as SocialMetricFieldKey,
      label: 'تعامل',
      current: curEngagement,
      previous: prevEngagement,
      absoluteChange:
        curEngagement !== null && prevEngagement !== null
          ? absoluteGrowth(curEngagement, prevEngagement)
          : null,
      changePct:
        curEngagement !== null && prevEngagement !== null
          ? percentageGrowth(curEngagement, prevEngagement)
          : null,
    });
  }

  return out;
}

/** Column on SocialMetric for each brand-comparison field key. */
const METRIC_COLUMN_BY_FIELD_KEY_BRAND: Record<
  SocialMetricFieldKey,
  keyof SocialMetric
> = {
  followers: 'followers',
  following: 'following',
  posts: 'posts',
  views: 'views',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  saves: 'saves',
  reach: 'reach',
  impressions: 'impressions',
  engagementRate: 'engagementRate',
  storyViews: 'storyViews',
  channelMembers: 'channelMembers',
  retweets: 'retweets',
  subscribers: 'subscribers',
};

/**
 * Aggregate one field across a period's metrics: followers are summed as
 * snapshots (each account appears once per period), flow metrics summed,
 * engagement rate averaged. Returns null when the period has no value.
 */
function aggregateBrandField(
  metrics: SocialMetric[],
  key: SocialMetricFieldKey,
  column: keyof SocialMetric,
): number | null {
  if (key === 'engagementRate') {
    return avgOrNull(metrics, (m) => m[column] as number | null);
  }
  return sumOrNull(metrics, (m) => m[column] as number | null);
}

/* =========================================================================
 * Comparison tables (brand / platform)
 * ========================================================================= */

/**
 * Per-brand stats over the current window with growth measured against the
 * previous window of the same length.
 */
export function buildBrandStats(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  current: SocialMonthRange,
  previous: SocialMonthRange,
): SocialBrandStat[] {
  const brands = [...new Set(accounts.map((a) => a.brand))];
  return brands
    .map((brand) => {
      const brandAccounts = accounts.filter((a) => a.brand === brand);
      const kpis = computeKpisForAccounts(brandAccounts, metrics, current);
      const prevKpis = computeKpisForAccounts(brandAccounts, metrics, previous);
      return { brand, ...toEntityStat(kpis, prevKpis) };
    })
    .sort((a, b) => b.followers - a.followers);
}

/** Per-platform stats for the selected accounts (one brand or all). */
export function buildPlatformStats(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  current: SocialMonthRange,
  previous: SocialMonthRange,
): SocialPlatformStat[] {
  const platforms = [...new Set(accounts.map((a) => a.platform))];
  return platforms
    .map((platform) => {
      const platformAccounts = accounts.filter((a) => a.platform === platform);
      const kpis = computeKpisForAccounts(platformAccounts, metrics, current);
      const prevKpis = computeKpisForAccounts(
        platformAccounts,
        metrics,
        previous,
      );
      return {
        platform,
        ...toEntityStat(kpis, prevKpis),
      };
    })
    .sort((a, b) => b.followers - a.followers);
}

function toEntityStat(
  kpis: SocialKpis,
  prevKpis: SocialKpis,
): SocialEntityStat {
  return {
    followers: kpis.followers,
    growth: absoluteGrowth(kpis.followers, prevKpis.followers),
    growthPct: percentageGrowth(kpis.followers, prevKpis.followers),
    views: kpis.views,
    engagement: kpis.engagement,
    engagementRate: kpis.engagementRate,
    posts: kpis.posts,
  };
}

/** All distinct month labels in a metric list, sorted ascending. */
export function distinctMonths(metrics: SocialMetric[]): string[] {
  return [...new Set(metrics.map((m) => m.periodLabel))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}
