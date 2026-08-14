import { toJalaali } from 'jalaali-js';
import { PERSIAN_MONTHS } from '@/constants/ui.constants';
import {
  absoluteGrowth,
  percentageGrowth,
  sortMetricsByPeriod,
  totalEngagement,
} from '@/services/social-metrics';
import { toPersianDigits } from '@/utils/persian';
import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialBrandStat,
  SocialBrandTrend,
  SocialEntityStat,
  SocialKpiComparison,
  SocialKpiKey,
  SocialKpis,
  SocialMetric,
  SocialMonthlyGrowthPoint,
  SocialMonthRange,
  SocialPlatformStat,
  SocialRangePreset,
  SocialTrendPoint,
} from '@/types/social';

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
