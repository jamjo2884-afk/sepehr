import type { SupabaseClient } from '@supabase/supabase-js';
import { socialBrandData } from '@/features/mock-data/social-data.generated';
import type {
  SocialMonthlyPoint,
  SocialAccountSeries,
  SocialBrandPlatform,
  SocialBrandNode,
} from '@/features/mock-data/social-data.generated';
import { percentageGrowth } from '@/services/social-metrics';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type {
  SocialAccount,
  SocialAccountStatus,
  SocialMetric,
  SocialMetricPeriod,
  SocialMetricSummary,
  SocialPeriodComparison,
} from '@/types/social';
import {
  aggregateWindow,
  comparePeriods as compareMetricPeriods,
  firstMetric,
  latestMetric,
  metricsInRange,
  periodLabelForDate,
  periodRangeForLabel,
  sortMetricsByPeriod,
  summarizeMetrics,
} from '@/services/social-metrics';

// Re-export generated types for convenience.
export type {
  SocialMonthlyPoint,
  SocialAccountSeries,
  SocialBrandPlatform,
  SocialBrandNode,
};

/**
 * Social-media data service.
 *
 * Two layers:
 *
 * 1. **Legacy dashboard API** (`getSocialOverview` + helpers) — rebuilds
 *    the nested brand tree the `/social` dashboard consumes. Reads the
 *    `social_followers` Supabase table (the raw import), falls back to the
 *    bundled snapshot. Kept unchanged so the UI keeps working.
 *
 * 2. **Normalized API** (new) — reads `social_accounts` + `social_metrics`
 *    (see supabase/migrations/20260814130000_create_social_accounts_metrics.sql)
 *    and returns the standardized `SocialAccount` / `SocialMetric` /
 *    `SocialMetricSummary` types. UI never talks to Supabase directly; it
 *    goes through these functions. Supabase first, bundled mock fallback.
 */

export const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'telegram',
  'youtube',
  'twitter',
  'bale',
  'eita',
  'rubika',
  'soroushplus',
];

/** A flattened account row: one brand × platform × handle, latest snapshot + series. */
export interface SocialAccountRow {
  brand: string;
  platform: SocialPlatform;
  handle: string | null;
  /** Latest available follower count. */
  latest: SocialMonthlyPoint | null;
  /** First available follower count. */
  first: SocialMonthlyPoint | null;
  /** Percentage growth from first to latest (0 when unknown). */
  growthPct: number;
  /** Full monthly follower series (chronological). */
  series: SocialMonthlyPoint[];
}

export interface SocialSummary {
  totalFollowers: number;
  totalAccounts: number;
  totalBrands: number;
  /** Portfolio growth from first to latest measurement, weighted by account size (%). */
  avgGrowthPct: number;
  /** Platform with the largest total audience. */
  topPlatform: SocialPlatform;
  /** Coverage: how many distinct Jalali months have data. */
  monthCount: number;
}

export interface SocialOverview {
  accounts: SocialAccountRow[];
  platforms: SocialPlatform[];
  brands: string[];
  months: string[];
  summary: SocialSummary;
}
function platformOf(id: string): id is SocialPlatform {
  return id in SOCIAL_PLATFORM_LABELS;
}

/** Flatten the brand tree into account rows. */
export function flattenAccounts(
  data: SocialBrandNode[] = socialBrandData,
): SocialAccountRow[] {
  const rows: SocialAccountRow[] = [];
  for (const brand of data) {
    for (const [platformId, handles] of Object.entries(brand.platforms)) {
      if (!platformOf(platformId) || !handles) continue;
      for (const series of Object.values(handles)) {
        const sorted = [...series.series].sort((a, b) =>
          a.month < b.month ? -1 : a.month > b.month ? 1 : 0,
        );
        const first = sorted[0] ?? null;
        const latest = sorted[sorted.length - 1] ?? null;
        rows.push({
          brand: brand.name,
          platform: platformId,
          handle: series.handle,
          latest,
          first,
          growthPct:
            first && latest ? percentageGrowth(latest.value, first.value) : 0,
          series: sorted,
        });
      }
    }
  }
  return rows;
}

/** All distinct Jalali months present in the data, sorted ascending. */
export function collectMonths(
  data: SocialBrandNode[] = socialBrandData,
): string[] {
  const set = new Set<string>();
  for (const brand of data) {
    for (const handles of Object.values(brand.platforms)) {
      if (!handles) continue;
      for (const s of Object.values(handles)) {
        for (const p of s.series) set.add(p.month);
      }
    }
  }
  return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** All distinct months across account rows, sorted ascending. */
function collectMonthsFromRows(rows: SocialAccountRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) for (const p of row.series) set.add(p.month);
  return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Build the legacy dashboard account rows from normalized data.
 * One row per `SocialAccount`, with its monthly follower series derived
 * from the matching `social_metrics` rows (period='monthly').
 */
export function buildAccountRows(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): SocialAccountRow[] {
  const metricsByAccount = new Map<string, SocialMetric[]>();
  for (const m of metrics) {
    const list = metricsByAccount.get(m.accountId) ?? [];
    list.push(m);
    metricsByAccount.set(m.accountId, list);
  }
  return accounts.map((account) => {
    const series: SocialMonthlyPoint[] = sortMetricsByPeriod(
      metricsByAccount.get(account.id) ?? [],
    ).map((m) => ({ month: m.periodLabel, value: m.followers }));
    const first = series[0] ?? null;
    const latest = series[series.length - 1] ?? null;
    return {
      brand: account.brand,
      platform: account.platform,
      handle: account.username,
      latest,
      first,
      growthPct:
        first && latest ? percentageGrowth(latest.value, first.value) : 0,
      series,
    };
  });
}

export function summarizeAccounts(accounts: SocialAccountRow[]): SocialSummary {
  if (accounts.length === 0) {
    return {
      totalFollowers: 0,
      totalAccounts: 0,
      totalBrands: 0,
      avgGrowthPct: 0,
      topPlatform: 'instagram',
      monthCount: 0,
    };
  }
  const totalFollowers = accounts.reduce(
    (sum, a) => sum + (a.latest?.value ?? 0),
    0,
  );
  const totalFirst = accounts.reduce(
    (sum, a) => sum + (a.first?.value ?? 0),
    0,
  );
  // Weighted portfolio growth: total followers now vs. total at first
  // measurement. A plain mean of per-account percentages is dominated by
  // tiny accounts (e.g. 265 -> 16,900 = +6,278%) and produces a headline
  // KPI that misrepresents the portfolio (~730% vs the real ~77%).
  const avgGrowthPct =
    totalFirst > 0 ? ((totalFollowers - totalFirst) / totalFirst) * 100 : 0;
  const byPlatform = new Map<SocialPlatform, number>();
  for (const a of accounts) {
    byPlatform.set(
      a.platform,
      (byPlatform.get(a.platform) ?? 0) + (a.latest?.value ?? 0),
    );
  }
  let topPlatform: SocialPlatform = 'instagram';
  let topVal = -1;
  for (const [p, v] of byPlatform) {
    if (v > topVal) {
      topVal = v;
      topPlatform = p;
    }
  }
  const months = new Set<string>();
  for (const a of accounts) for (const p of a.series) months.add(p.month);
  return {
    totalFollowers,
    totalAccounts: accounts.length,
    totalBrands: new Set(accounts.map((a) => a.brand)).size,
    avgGrowthPct,
    topPlatform,
    monthCount: months.size,
  };
}

/** Aggregate follower totals per platform across all accounts, for a given month (or latest). */
export function platformTotals(
  accounts: SocialAccountRow[],
  month?: string,
): Array<{ platform: SocialPlatform; total: number }> {
  return SUPPORTED_PLATFORMS.map((platform) => {
    let total = 0;
    for (const a of accounts) {
      if (a.platform !== platform) continue;
      const point = month ? a.series.find((p) => p.month === month) : a.latest;
      total += point?.value ?? 0;
    }
    return { platform, total };
  }).filter((x) => x.total > 0);
} /**
 * Build the dashboard view model (legacy shape) from the normalized
 * `social_accounts` + `social_metrics` tables. Accounts without any
 * monthly metric are kept (they show 0 followers); months are collected
 * from all metric rows.
 */
export function buildSocialOverview(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): SocialOverview {
  const rows = buildAccountRows(accounts, metrics);
  const months = collectMonthsFromRows(rows);
  const brands = [...new Set(rows.map((a) => a.brand))].sort((a, b) =>
    a.localeCompare(b, 'fa'),
  );
  const summary = summarizeAccounts(rows);
  return {
    accounts: rows,
    platforms: SUPPORTED_PLATFORMS,
    brands,
    months,
    summary,
  };
}

/**
 * Fetch the full social overview from the normalized tables.
 * `social_accounts` + `social_metrics` (Supabase first, bundled snapshot
 * fallback per table).
 */
export async function getSocialOverview(): Promise<SocialOverview> {
  const [accounts, metrics] = await Promise.all([
    getSocialAccounts(),
    getSocialMetrics(undefined, 'monthly'),
  ]);
  return buildSocialOverview(accounts, metrics);
}

/** Everything the analytics dashboard needs, fetched in one round-trip. */
export interface SocialDashboardData {
  accounts: SocialAccount[];
  metrics: SocialMetric[];
}

/**
 * Fetch the dashboard dataset: all accounts + all monthly metrics.
 * The page reads this once and derives every KPI / chart / table from it
 * via `src/services/social-analytics.ts` — no per-section queries, no N+1.
 */
export async function getSocialDashboardData(): Promise<SocialDashboardData> {
  const [accounts, metrics] = await Promise.all([
    getSocialAccounts(),
    getSocialMetrics(undefined, 'monthly'),
  ]);
  return { accounts, metrics };
}

/** Human label helper. */
export function platformLabel(platform: SocialPlatform): string {
  return SOCIAL_PLATFORM_LABELS[platform];
}

/**
 * Build the public web URL of an account on its platform, from its handle.
 * Returns null when the platform has no public web profile or the handle is
 * missing. Used to deep-link out to the real account page.
 */
export function socialAccountUrl(
  platform: SocialPlatform,
  handle: string | null,
): string | null {
  if (!handle) return null;
  const h = encodeURIComponent(handle.replace(/^@/, ''));
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${h}`;
    case 'telegram':
      return `https://t.me/${h}`;
    case 'youtube':
      return `https://youtube.com/@${h}`;
    case 'twitter':
      return `https://x.com/${h}`;
    case 'bale':
      return `https://ble.ir/${h}`;
    case 'eita':
      return `https://eitaa.com/${h}`;
    case 'soroushplus':
      return `https://sapp.ir/${h}`;
    case 'rubika':
      // Rubika has no public per-channel web page.
      return null;
    default:
      return null;
  }
}

/**
 * Encode a SocialAccountRow's composite key into a URL-safe string.
 * Format: `brand|platform|handle` (handle may be empty).
 */
export function encodeAccountKey(account: SocialAccountRow): string {
  const parts = [account.brand, account.platform, account.handle ?? ''];
  return encodeURIComponent(parts.join('|'));
}

/**
 * Decode a URL-safe account key back to its components.
 */
export function decodeAccountKey(
  key: string,
): { brand: string; platform: SocialPlatform; handle: string | null } | null {
  try {
    const decoded = decodeURIComponent(key);
    const [brand, platform, handle] = decoded.split('|');
    if (!brand || !platform) return null;
    if (!platformOf(platform)) return null;
    return {
      brand,
      platform: platform as SocialPlatform,
      handle: handle || null,
    };
  } catch {
    return null;
  }
}

/**
 * Find a single account by its encoded key. Returns null if not found.
 * Reads from the normalized tables via getSocialAccounts + getSocialMetrics.
 */
export async function getAccountByKey(
  key: string,
): Promise<SocialAccountRow | null> {
  const parsed = decodeAccountKey(key);
  if (!parsed) return null;
  const [accounts, metrics] = await Promise.all([
    getSocialAccounts(),
    getSocialMetrics(undefined, 'monthly'),
  ]);
  const account = accounts.find(
    (a) =>
      a.brand === parsed.brand &&
      a.platform === parsed.platform &&
      a.username === (parsed.handle ?? ''),
  );
  if (!account) return null;
  const rows = buildAccountRows([account], metrics);
  return rows[0] ?? null;
}

/** Full account detail: legacy dashboard row + normalized account + latest metric. */
export interface SocialAccountDetail {
  /** Legacy dashboard row (follower series + growth). */
  row: SocialAccountRow;
  /** Normalized account record (stable uuid id, url, status). */
  account: SocialAccount | null;
  /** Latest metric of the normalized account, when available. */
  latestMetric: SocialMetric | null;
}

/**
 * Fetch everything the account detail page needs in one call: the legacy
 * follower row for the chart/table, plus the normalized account and its
 * latest metric so platform-specific indicators (story views, channel
 * members, retweets, subscribers) can be shown. Reads the normalized
 * tables via getSocialAccounts + getSocialMetrics.
 */
export async function getAccountDetail(
  key: string,
): Promise<SocialAccountDetail | null> {
  const parsed = decodeAccountKey(key);
  if (!parsed) return null;

  const [accounts, metrics] = await Promise.all([
    getSocialAccounts(),
    getSocialMetrics(undefined, 'monthly'),
  ]);
  const account =
    accounts.find(
      (a) =>
        a.brand === parsed.brand &&
        a.platform === parsed.platform &&
        a.username === (parsed.handle ?? ''),
    ) ?? null;
  if (!account) return null;

  const rows = buildAccountRows([account], metrics);
  const row = rows[0];
  if (!row) return null;

  return {
    row,
    account,
    latestMetric: latestMetric(
      metrics.filter((m) => m.accountId === account.id),
    ),
  };
}

/* =========================================================================
 * Normalized API (new) — social_accounts + social_metrics
 * ========================================================================= */

/**
 * Build a fallback `SocialAccount` list from the bundled snapshot. Used only
 * when Supabase is unreachable so the normalized API never returns nothing.
 * The id is the encoded brand|platform|handle key (stable across runs).
 */
export function accountsFromSnapshot(): SocialAccount[] {
  const now = new Date().toISOString();
  const rows = flattenAccounts(socialBrandData);
  return rows.map((row) => ({
    id: encodeURIComponent(
      [row.brand, row.platform, row.handle ?? ''].join('|'),
    ),
    brand: row.brand,
    platform: row.platform,
    username: row.handle ?? '',
    displayName: row.handle,
    url: socialAccountUrl(row.platform, row.handle),
    status: 'active' as SocialAccountStatus,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Build fallback metrics for one account from the snapshot. */
export function metricsFromSnapshot(account: SocialAccount): SocialMetric[] {
  const row = flattenAccounts(socialBrandData).find(
    (r) =>
      r.brand === account.brand &&
      r.platform === account.platform &&
      r.handle === account.username,
  );
  if (!row) return [];
  const now = new Date().toISOString();
  return row.series.map((point) => ({
    id: encodeURIComponent([account.id, 'monthly', point.month].join('|')),
    accountId: account.id,
    period: 'monthly' as SocialMetricPeriod,
    periodLabel: point.month,
    periodStart: null,
    periodEnd: null,
    followers: point.value,
    following: null,
    posts: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    impressions: null,
    engagementRate: null,
    storyViews: null,
    channelMembers: null,
    retweets: null,
    subscribers: null,
    createdAt: now,
    updatedAt: now,
  }));
}

interface AccountRow {
  id: string;
  brand: string;
  platform: SocialPlatform;
  username: string;
  display_name: string | null;
  url: string | null;
  status: SocialAccountStatus;
  created_at: string;
  updated_at: string;
}

interface MetricRow {
  id: string | number;
  account_id: string;
  period: SocialMetricPeriod;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
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
  engagement_rate: number | null;
  story_views: number | null;
  channel_members: number | null;
  retweets: number | null;
  subscribers: number | null;
  created_at: string;
  updated_at: string;
}

function toSocialAccount(row: AccountRow): SocialAccount {
  return {
    id: row.id,
    brand: row.brand,
    platform: row.platform,
    username: row.username,
    displayName: row.display_name,
    url: row.url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSocialMetric(row: MetricRow): SocialMetric {
  return {
    id: String(row.id),
    accountId: row.account_id,
    period: row.period,
    periodLabel: row.period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    followers: row.followers,
    following: row.following,
    posts: row.posts,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    reach: row.reach,
    impressions: row.impressions,
    engagementRate: row.engagement_rate,
    storyViews: row.story_views,
    channelMembers: row.channel_members,
    retweets: row.retweets,
    subscribers: row.subscribers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All social accounts (Supabase first, snapshot fallback). */
export async function getSocialAccounts(): Promise<SocialAccount[]> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase
      .from('social_accounts')
      .select(
        'id, brand, platform, username, display_name, url, status, created_at, updated_at',
      )
      .order('brand', { ascending: true })
      .order('platform', { ascending: true })
      .order('username', { ascending: true })
      .limit(10000);
    if (error) throw error;
    if (!data || data.length === 0) return accountsFromSnapshot();
    return (data as unknown as AccountRow[]).map(toSocialAccount);
  } catch (err) {
    console.warn(
      '[social] Could not read social_accounts from Supabase, ' +
        'falling back to the bundled snapshot.',
      err,
    );
    return accountsFromSnapshot();
  }
}

/**
 * Metrics for one or more accounts, filtered by period granularity.
 * Supabase first, snapshot fallback.
 *
 * The Supabase project caps REST responses at 1000 rows per request, so the
 * fetch is paginated with range headers to guarantee the full history is
 * read (1156 monthly rows today, and any future daily/weekly rows).
 */
export async function getSocialMetrics(
  accountIds?: string[],
  period?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const rows = await fetchAllMetricRows(supabase, accountIds, period);
    if (rows.length === 0) {
      // Fall back to the snapshot when the table is empty so callers never
      // get an empty result from a misconfigured backend.
      const accounts =
        accountIds && accountIds.length > 0
          ? (await getSocialAccounts()).filter((a) => accountIds.includes(a.id))
          : await getSocialAccounts();
      return accounts.flatMap((account) => metricsFromSnapshot(account));
    }
    return rows.map(toSocialMetric);
  } catch (err) {
    console.warn(
      '[social] Could not read social_metrics from Supabase, ' +
        'falling back to the bundled snapshot.',
      err,
    );
    const accounts =
      accountIds && accountIds.length > 0
        ? (await getSocialAccounts()).filter((a) => accountIds.includes(a.id))
        : await getSocialAccounts();
    return accounts.flatMap((account) => metricsFromSnapshot(account));
  }
}

/** Read every matching metric row, paginating past the 1000-row cap. */
async function fetchAllMetricRows(
  supabase: SupabaseClient,
  accountIds: string[] | undefined,
  period: SocialMetricPeriod | undefined,
): Promise<MetricRow[]> {
  const PAGE = 1000;
  const rows: MetricRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('social_metrics')
      .select(
        'id, account_id, period, period_label, period_start, period_end, ' +
          'followers, following, posts, views, likes, comments, shares, saves, ' +
          'reach, impressions, engagement_rate, story_views, channel_members, ' +
          'retweets, subscribers, created_at, updated_at',
      )
      .order('period_label', { ascending: true })
      .range(from, from + PAGE - 1);
    if (accountIds && accountIds.length > 0) {
      query = query.in('account_id', accountIds);
    }
    if (period) {
      query = query.eq('period', period);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as MetricRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Metrics for a single account, sorted by periodLabel. */
export async function getAccountMetrics(
  accountId: string,
  period?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  const metrics = await getSocialMetrics([accountId], period);
  return sortMetricsByPeriod(metrics);
}

/** Metrics summary for a single account. */
export async function getAccountSummary(
  accountId: string,
  period: SocialMetricPeriod = 'monthly',
): Promise<SocialMetricSummary> {
  const metrics = await getAccountMetrics(accountId, period);
  return summarizeMetrics(metrics, period);
}

/** Metrics for every account of a brand, aggregated. */
export async function getBrandMetrics(
  brand: string,
  period?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  const accounts = (await getSocialAccounts()).filter((a) => a.brand === brand);
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return [];
  return getSocialMetrics(ids, period);
}

/** Metrics summary for a brand across all its accounts. */
export async function getBrandSummary(
  brand: string,
  period: SocialMetricPeriod = 'monthly',
): Promise<SocialMetricSummary> {
  const metrics = await getBrandMetrics(brand, period);
  return summarizeMetrics(metrics, period);
}

/** Metrics for all accounts on a platform, aggregated. */
export async function getPlatformMetrics(
  platform: SocialPlatform,
  period?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  const accounts = (await getSocialAccounts()).filter(
    (a) => a.platform === platform,
  );
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return [];
  return getSocialMetrics(ids, period);
}

/** Metrics summary for a platform across all its accounts. */
export async function getPlatformSummary(
  platform: SocialPlatform,
  period: SocialMetricPeriod = 'monthly',
): Promise<SocialMetricSummary> {
  const metrics = await getPlatformMetrics(platform, period);
  return summarizeMetrics(metrics, period);
}

/** Compare the latest vs. previous period for one account. */
export async function getAccountPeriodComparison(
  accountId: string,
  period: SocialMetricPeriod = 'monthly',
): Promise<SocialPeriodComparison | null> {
  const metrics = await getAccountMetrics(accountId, period);
  return compareMetricPeriods(metrics);
}

/** Latest metric per account in a group (brand or platform). */
export function latestMetricsByAccount(
  metrics: SocialMetric[],
): Map<string, SocialMetric> {
  const byAccount = new Map<string, SocialMetric[]>();
  for (const m of metrics) {
    const list = byAccount.get(m.accountId) ?? [];
    list.push(m);
    byAccount.set(m.accountId, list);
  }
  const out = new Map<string, SocialMetric>();
  for (const [id, list] of byAccount) {
    const latest = latestMetric(list);
    if (latest) out.set(id, latest);
  }
  return out;
}

/** First metric per account in a group (brand or platform). */
export function firstMetricsByAccount(
  metrics: SocialMetric[],
): Map<string, SocialMetric> {
  const byAccount = new Map<string, SocialMetric[]>();
  for (const m of metrics) {
    const list = byAccount.get(m.accountId) ?? [];
    list.push(m);
    byAccount.set(m.accountId, list);
  }
  const out = new Map<string, SocialMetric>();
  for (const [id, list] of byAccount) {
    const first = firstMetric(list);
    if (first) out.set(id, first);
  }
  return out;
}

/**
 * Metrics for one account within an ISO date range [start, end] (inclusive).
 * Filters client-side after fetching so the snapshot fallback path works
 * identically; the data set is small (one account's history).
 */
export async function getMetricsForDateRange(
  accountId: string,
  start: string,
  end: string,
  period?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  const metrics = await getAccountMetrics(accountId, period);
  return metricsInRange(metrics, start, end);
}

/**
 * Upsert a metrics row for one account and period. The period label is
 * generated from `date` (default now) when not provided, so callers can
 * record a snapshot without thinking about label formats. Returns the
 * stored row on success, null on failure (already logged).
 */
export async function recordSocialMetrics(
  accountId: string,
  period: SocialMetricPeriod,
  values: {
    followers?: number;
    following?: number | null;
    posts?: number | null;
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
    reach?: number | null;
    impressions?: number | null;
    engagementRate?: number | null;
    storyViews?: number | null;
    channelMembers?: number | null;
    retweets?: number | null;
    subscribers?: number | null;
  },
  options: { date?: Date; periodLabel?: string } = {},
): Promise<SocialMetric | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const date = options.date ?? new Date();
    const periodLabel = options.periodLabel ?? periodLabelForDate(date, period);
    const range = periodRangeForLabel(period, periodLabel);
    const row = {
      account_id: accountId,
      period,
      period_label: periodLabel,
      period_start: range?.start ?? null,
      period_end: range?.end ?? null,
      followers: values.followers ?? 0,
      following: values.following ?? null,
      posts: values.posts ?? null,
      views: values.views ?? null,
      likes: values.likes ?? null,
      comments: values.comments ?? null,
      shares: values.shares ?? null,
      saves: values.saves ?? null,
      reach: values.reach ?? null,
      impressions: values.impressions ?? null,
      engagement_rate: values.engagementRate ?? null,
      story_views: values.storyViews ?? null,
      channel_members: values.channelMembers ?? null,
      retweets: values.retweets ?? null,
      subscribers: values.subscribers ?? null,
    };
    const { data, error } = await supabase
      .from('social_metrics')
      .upsert(row, { onConflict: 'account_id,period,period_label' })
      .select()
      .single();
    if (error) throw error;
    return toSocialMetric(data as unknown as MetricRow);
  } catch (err) {
    console.warn('[social] Could not record social metric.', err);
    return null;
  }
}

/**
 * Aggregate an account's metrics into a coarser granularity. E.g. daily
 * rows into weekly (or monthly) buckets. Returns the aggregated rows
 * (one per bucket), or an empty list when there is nothing to aggregate.
 */
export async function getAggregatedMetrics(
  accountId: string,
  targetPeriod: SocialMetricPeriod,
  sourcePeriod?: SocialMetricPeriod,
): Promise<SocialMetric[]> {
  const source =
    sourcePeriod ??
    (targetPeriod === 'monthly'
      ? 'weekly'
      : targetPeriod === 'weekly'
        ? 'daily'
        : 'daily');
  const metrics = await getAccountMetrics(accountId, source);
  return aggregateToPeriod(metrics, targetPeriod);
}

/** Group metrics into buckets by a target period label, then aggregate. */
function aggregateToPeriod(
  metrics: SocialMetric[],
  targetPeriod: SocialMetricPeriod,
): SocialMetric[] {
  const buckets = new Map<string, SocialMetric[]>();
  for (const m of sortMetricsByPeriod(metrics)) {
    const label = bucketLabel(m, targetPeriod);
    const list = buckets.get(label) ?? [];
    list.push(m);
    buckets.set(label, list);
  }
  const out: SocialMetric[] = [];
  for (const list of buckets.values()) {
    const aggregated = aggregateWindow(list);
    if (aggregated) {
      out.push({
        ...aggregated,
        period: targetPeriod,
        periodLabel: bucketLabel(aggregated, targetPeriod),
        periodStart: aggregated.periodStart,
        periodEnd: aggregated.periodEnd,
      });
    }
  }
  return sortMetricsByPeriod(out);
}

/** Compute the target-period label for a metric (by date when possible). */
function bucketLabel(
  metric: SocialMetric,
  targetPeriod: SocialMetricPeriod,
): string {
  if (metric.periodStart) {
    const d = new Date(metric.periodStart);
    if (!Number.isNaN(d.getTime())) {
      return periodLabelForDate(d, targetPeriod);
    }
  }
  // Fallback: keep the source label when it already matches the target
  // granularity (e.g. monthly input for a monthly target).
  return metric.periodLabel;
}
