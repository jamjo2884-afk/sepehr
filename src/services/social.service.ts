import type { SupabaseClient } from '@supabase/supabase-js';
import { socialBrandData } from '@/features/mock-data/social-data.generated';
import type {
  SocialMonthlyPoint,
  SocialAccountSeries,
  SocialBrandPlatform,
  SocialBrandNode,
} from '@/features/mock-data/social-data.generated';
import { percentageGrowth } from '@/services/social-metrics';
import {
  PLATFORM_METRIC_FIELDS,
  type SocialMetricFieldKey,
} from '@/constants/social-fields';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type {
  SocialAccount,
  SocialAccountInput,
  SocialAccountStatus,
  SocialConnectionStatus,
  SocialBrandOverview,
  SocialBrandPlatformRow,
  SocialBrandPlatformTimelineRow,
  SocialBrandRanking,
  SocialGrowthDriver,
  SocialMetric,
  SocialMetricPeriod,
  SocialMetricSummary,
  SocialMetricValues,
  SocialPeerComparisonItem,
  SocialPeriodComparison,
  SocialSyncRunStatus,
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
  weeklyRangeForDate,
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
  'rubino',
  'soroushplus',
  'aparat',
  'threads',
  'clubhouse',
  'shad',
  'igap',
  'site',
  'gap',
  'virasty',
  'facebook',
];

/** A flattened account row: one brand × platform × handle, latest snapshot + series. */
export interface SocialAccountRow {
  brand: string;
  brandId?: string | null;
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
          brandId: null,
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
      brandId: account.brandId ?? null,
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
    totalBrands: new Set(accounts.map((a) => a.brandId ?? a.brand)).size,
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
  const brands = [...new Set(rows.map((a) => a.brandId ?? a.brand))].sort((a, b) =>
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
    case 'aparat':
      return `https://aparat.com/${h}`;
    case 'threads':
      return `https://www.threads.net/@${h}`;
    case 'igap':
      return `https://igap.net/${h}`;
    case 'virasty':
      return `https://virasty.com/${h}`;
    case 'facebook':
      return `https://facebook.com/${h}`;
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
    brandId: null,
    platform: row.platform,
    username: row.handle ?? '',
    displayName: row.handle,
    url: socialAccountUrl(row.platform, row.handle),
    externalId: null,
    status: 'active' as SocialAccountStatus,
    createdAt: now,
    updatedAt: now,
    connectionStatus: 'disconnected' as const,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
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
  brand_id: string | null;
  platform: SocialPlatform;
  username: string;
  display_name: string | null;
  url: string | null;
  external_id: string | null;
  status: SocialAccountStatus;
  connection_status: SocialConnectionStatus;
  last_sync_at: string | null;
  last_sync_status: SocialSyncRunStatus | null;
  last_successful_sync_at: string | null;
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

export function toSocialAccount(row: AccountRow, brandNames?: Map<string, string>): SocialAccount {
  const brandId = row.brand_id ?? null;
  return {
    id: row.id,
    brand: (brandId && brandNames?.get(brandId)) ?? row.brand ?? '',
    brandId,
    platform: row.platform,
    username: row.username,
    displayName: row.display_name,
    url: row.url,
    externalId: row.external_id ?? null,
    status: row.status,
    connectionStatus: row.connection_status,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSocialMetric(row: MetricRow): SocialMetric {
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
    // Try with brand_id first (post-migration schema)
    let { data, error } = await supabase
      .from('social_accounts')
      .select(
        'id, brand_id, platform, username, display_name, url, external_id, ' +
          'status, connection_status, last_sync_at, last_sync_status, ' +
          'last_successful_sync_at, created_at, updated_at',
      )
      .order('platform', { ascending: true })
      .order('username', { ascending: true })
      .limit(10000);
    // If brand_id column doesn't exist yet, retry without it
    if (error && (error as { code?: string }).code === '42703') {
      const retry = await supabase
        .from('social_accounts')
        .select(
          'id, brand, platform, username, display_name, url, external_id, ' +
            'status, connection_status, last_sync_at, last_sync_status, ' +
            'last_successful_sync_at, created_at, updated_at',
        )
        .order('brand', { ascending: true })
        .order('platform', { ascending: true })
        .order('username', { ascending: true })
        .limit(10000);
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    if (!data || data.length === 0) return accountsFromSnapshot();
    const rows = data as unknown as AccountRow[];
    // Resolve brand names if we got brand_id, otherwise use brand column
    if (rows[0] && 'brand_id' in rows[0]) {
      const { resolveBrandNames } = await import('@/services/brand.service');
      const brandIds = rows.map((r) => r.brand_id).filter((id): id is string => !!id);
      const brandNames = await resolveBrandNames(brandIds);
      return rows.map((r) => toSocialAccount(r, brandNames));
    }
    // Legacy schema: brand column exists as text
    return rows.map((r) => toSocialAccount(r));
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
 * Everything the brand performance page needs, computed from one shared
 * accounts + metrics dataset (two Supabase round trips total).
 */
export interface BrandSocialAnalytics {
  overview: SocialBrandOverview;
  platforms: SocialBrandPlatformRow[];
  peers: SocialPeerComparisonItem[];
  rankings: SocialBrandRanking[];
  drivers: SocialGrowthDriver[];
  timeline: SocialBrandPlatformTimelineRow[];
}

/**
 * Brand-level analytics for the account-detail page. The brand is resolved
 * from the account's `brand` field; every analysis (overview, per-platform
 * performance, peer comparison, rankings, growth drivers, freshness
 * timeline) is derived from the same dataset in the analytics layer.
 */
export async function getBrandSocialAnalytics(
  brand: string,
): Promise<BrandSocialAnalytics | null> {
  try {
    const accounts = await getSocialAccounts();
    const metrics = await getSocialMetrics(undefined, 'monthly');
    if (!accounts.some((a) => (a.brandId ?? a.brand) === brand)) return null;
    const {
      buildBrandOverview,
      buildBrandPlatformPerformance,
      buildBrandPeerComparison,
      buildBrandRankings,
      buildBrandGrowthDrivers,
      buildBrandPlatformTimeline,
    } = await import('@/services/social-analytics');
    return {
      overview: buildBrandOverview(accounts, metrics, brand),
      platforms: buildBrandPlatformPerformance(accounts, metrics, brand),
      peers: buildBrandPeerComparison(accounts, metrics, brand),
      rankings: buildBrandRankings(accounts, metrics, brand),
      drivers: buildBrandGrowthDrivers(
        buildBrandPlatformPerformance(accounts, metrics, brand),
      ),
      timeline: buildBrandPlatformTimeline(accounts, metrics, brand),
    };
  } catch (err) {
    console.warn('[social] Could not build brand social analytics.', err);
    return null;
  }
}

/**
 * Create a social account row. Rejects duplicates (UNIQUE brand, platform,
 * username) with a typed result so the UI can show a Persian message.
 * Returns the stored account, or null on failure.
 */
export async function createSocialAccount(
  input: SocialAccountInput,
): Promise<SocialAccount | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    // Resolve brand name to brandId if not provided
    let brandId = input.brandId ?? null;
    if (!brandId && input.brand) {
      const { resolveBrandId } = await import('@/services/brand.service');
      brandId = await resolveBrandId(input.brand);
    }
    const row: Record<string, unknown> = {
      brand_id: brandId,
      platform: input.platform,
      username: input.username.trim(),
      display_name: input.displayName?.trim() || null,
      url: input.url?.trim() || null,
      status: input.status ?? 'active',
    };
    const { data, error } = await supabase
      .from('social_accounts')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    const { resolveBrandNames } = await import('@/services/brand.service');
    const createdRow = data as unknown as AccountRow;
    const createdBrandId = (createdRow as unknown as { brand_id?: string | null }).brand_id;
    const brandNames = createdBrandId ? await resolveBrandNames([createdBrandId]) : new Map<string, string>();
    return toSocialAccount(createdRow, brandNames);
  } catch (err) {
    console.warn('[social] Could not create social account.', err);
    return null;
  }
}

/**
 * Update a social account row (brand / platform / username / display name /
 * URL / status). Returns the updated account, or null on failure (a
 * duplicate brand+platform+username edit fails the same way as create).
 */
export async function updateSocialAccount(
  accountId: string,
  input: SocialAccountInput,
): Promise<SocialAccount | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    // Resolve brand name to brandId if not provided
    let brandId = input.brandId ?? null;
    if (!brandId && input.brand) {
      const { resolveBrandId } = await import('@/services/brand.service');
      brandId = await resolveBrandId(input.brand);
    }
    const row: Record<string, unknown> = {
      brand_id: brandId,
      platform: input.platform,
      username: input.username.trim(),
      display_name: input.displayName?.trim() || null,
      url: input.url?.trim() || null,
      status: input.status ?? 'active',
    };
    const { data, error } = await supabase
      .from('social_accounts')
      .update(row)
      .eq('id', accountId)
      .select()
      .single();    if (error) throw error;
    const { resolveBrandNames } = await import('@/services/brand.service');
    const updatedRow = data as unknown as AccountRow;
    const updatedBrandId = (updatedRow as unknown as { brand_id?: string | null }).brand_id;
    const brandNames = updatedBrandId ? await resolveBrandNames([updatedBrandId]) : new Map<string, string>();
    return toSocialAccount(updatedRow, brandNames);
  } catch (err) {


    console.warn('[social] Could not update social account.', err);
    return null;
  }
}

/**
 * Change an account's lifecycle status (active / inactive / archived /
 * suspended) without touching the rest of the row.
 */
export async function setSocialAccountStatus(
  accountId: string,
  status: SocialAccountStatus,
): Promise<SocialAccount | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase
      .from('social_accounts')
      .update({ status })
      .eq('id', accountId)
      .select()
      .single();    if (error) throw error;
    const { resolveBrandNames } = await import('@/services/brand.service');
    const updatedRow = data as unknown as AccountRow;
    const brandId = (updatedRow as unknown as { brand_id?: string | null }).brand_id;
    const brandNames = brandId ? await resolveBrandNames([brandId]) : new Map<string, string>();
    return toSocialAccount(updatedRow, brandNames);
  } catch (err) {


    console.warn('[social] Could not update social account status.', err);
    return null;
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
export async function fetchAllMetricRows(
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
  const accounts = (await getSocialAccounts()).filter((a) => (a.brandId ?? a.brand) === brand);
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

/** snake_case column for each input key. Shared by every metric write
 * path (record / bulk record / update) — never duplicated elsewhere. */
export const METRIC_COLUMN_BY_KEY: Record<keyof SocialMetricValues, string> = {
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
  engagementRate: 'engagement_rate',
  storyViews: 'story_views',
  channelMembers: 'channel_members',
  retweets: 'retweets',
  subscribers: 'subscribers',
};

/**
 * Upsert a metrics row for one account and period. The period label is
 * generated from `date` (default now) when not provided, so callers can
 * record a snapshot without thinking about label formats. Duplicate rows
 * are prevented by the `UNIQUE (account_id, period, period_label)`
 * constraint — re-recording the same period updates the existing row.
 * Returns the stored row on success, null on failure (already logged).
 */
export async function recordSocialMetrics(
  accountId: string,
  period: SocialMetricPeriod,
  values: SocialMetricValues,
  options: {
    date?: Date;
    periodLabel?: string;
    /** Pre-resolved client (the sync service shares one across a run). */
    supabase?: import('@supabase/supabase-js').SupabaseClient;
  } = {},
): Promise<SocialMetric | null> {
  try {
    const supabase =
      options.supabase ?? (await import('@/lib/supabase')).supabase;
    const date = options.date ?? new Date();
    const periodLabel = options.periodLabel ?? periodLabelForDate(date, period);
    // Weekly labels can't be converted back to a range without an anchor
    // date; use the anchor date directly for daily/weekly rows.
    const range =
      period === 'weekly' && options.date
        ? weeklyRangeForDate(options.date)
        : periodRangeForLabel(period, periodLabel);
    const row = {
      account_id: accountId,
      period,
      period_label: periodLabel,
      period_start: range?.start ?? null,
      period_end: range?.end ?? null,
      // `followers` is NOT NULL in the schema. NULL here means "not
      // provided" — the merge below keeps the stored value on re-record;
      // only a brand-new row defaults to 0. Every other column stays NULL
      // when not provided.
      followers: values.followers ?? null,
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
    // Re-recording an existing period must not wipe previously entered
    // values: empty inputs are stored as NULL, so before upserting we merge
    // the row over the existing one — NULL payload keys keep the stored
    // value, while explicit numbers (including 0) overwrite it.
    const { data: existing } = await supabase
      .from('social_metrics')
      .select('*')
      .eq('account_id', accountId)
      .eq('period', period)
      .eq('period_label', periodLabel)
      .maybeSingle();
    if (existing) {
      const rowRecord = row as Record<string, number | string | null>;
      const existingRecord = existing as Record<string, unknown>;
      for (const key of Object.keys(rowRecord)) {
        const stored = existingRecord[key];
        if (rowRecord[key] === null && stored !== undefined) {
          rowRecord[key] = stored as number | string | null;
        }
      }
    }
    // NOT NULL fallback for a brand-new row whose followers were left empty.
    if (row.followers === null) row.followers = 0;
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
 * Upsert one metric row per account in a single request. All accounts share
 * the same period and label; each row keeps only the columns its platform
 * supports (from `PLATFORM_METRIC_FIELDS`) — e.g. `story_views` is written
 * only for Instagram accounts, never for Telegram. Previously stored values
 * are preserved for columns the bulk form leaves empty (NULL payload), and
 * duplicates are prevented by the same UNIQUE constraint as single records.
 * Returns the number of rows written, or null on failure (already logged).
 */
export async function recordSocialMetricsBulk(
  accounts: Array<Pick<SocialAccount, 'id' | 'platform'>>,
  period: SocialMetricPeriod,
  values: SocialMetricValues,
  options: { date?: Date; periodLabel?: string } = {},
): Promise<number | null> {
  try {
    if (accounts.length === 0) return 0;
    const { supabase } = await import('@/lib/supabase');
    const date = options.date ?? new Date();
    const periodLabel = options.periodLabel ?? periodLabelForDate(date, period);
    const range =
      period === 'weekly' && options.date
        ? weeklyRangeForDate(options.date)
        : periodRangeForLabel(period, periodLabel);
    const accountIds = accounts.map((a) => a.id);

    // Existing rows for the same accounts + period + label, for merging.
    const { data: existingRows } = await supabase
      .from('social_metrics')
      .select('*')
      .in('account_id', accountIds)
      .eq('period', period)
      .eq('period_label', periodLabel);
    const existingByAccount = new Map<string, Record<string, unknown>>(
      (existingRows ?? []).map((r) => [
        r.account_id as string,
        r as Record<string, unknown>,
      ]),
    );

    const rows: Array<Record<string, number | string | null>> = [];
    for (const account of accounts) {
      const supported = new Set(PLATFORM_METRIC_FIELDS[account.platform]);
      const existing = existingByAccount.get(account.id);
      const row: Record<string, number | string | null> = {
        account_id: account.id,
        period,
        period_label: periodLabel,
        period_start: range?.start ?? null,
        period_end: range?.end ?? null,
      };
      for (const [key, column] of Object.entries(METRIC_COLUMN_BY_KEY)) {
        const typedKey = key as keyof SocialMetricValues;
        const fieldKey = key as SocialMetricFieldKey;
        const value = values[typedKey];
        if (supported.has(fieldKey)) {
          row[column] =
            value ?? (existing?.[column] as number | string | null) ?? null;
        } else {
          // Column not supported by this platform: keep stored value, or
          // default followers to 0 (NOT NULL in the schema).
          row[column] =
            (existing?.[column] as number | string | null) ??
            (key === 'followers' ? 0 : null);
        }
      }
      if (row.followers === null) row.followers = 0;
      rows.push(row);
    }

    const { data, error } = await supabase
      .from('social_metrics')
      .upsert(rows, { onConflict: 'account_id,period,period_label' })
      .select();
    if (error) throw error;
    return data?.length ?? 0;
  } catch (err) {
    console.warn('[social] Could not bulk record social metrics.', err);
    return null;
  }
}

/**
 * Identity/lifecycle fields for `updateSocialMetric`. These define the
 * (account_id, period, period_label) row key — providing any of them moves
 * the row instead of only changing metric values.
 */
export interface SocialMetricIdentity {
  /** Move the row to another account. */
  accountId?: string;
  /** Change the period granularity (monthly/weekly/daily). */
  period?: SocialMetricPeriod;
  /**
   * Anchor date used to derive `period_label` and `period_start/end`
   * through the same canonical helpers as `recordSocialMetrics`. Required
   * for weekly rows (labels can't be converted back to a range).
   */
  date?: Date;
}

/**
 * Update an existing metric row by id. Only the keys present in `values`
 * are written; `null` clears a nullable column, `followers` falls back to 0
 * (NOT NULL schema). Returns the updated row, or null on failure.
 *
 * `identity` (optional) also moves the row's lifecycle fields — account,
 * period, period label and the derived start/end range. The label/range
 * are computed exactly like `recordSocialMetrics` so the row key stays
 * consistent, and a duplicate (account, period, label) key on ANOTHER row
 * is rejected before the write (the UNIQUE constraint would fail anyway).
 *
 * Optional optimistic concurrency: when `expectedUpdatedAt` is provided the
 * row is only updated when its `updated_at` still matches (a compare-and-
 * swap). A null return then means the row was changed or deleted by another
 * process after the caller read it — never overwrite in that case.
 */
export async function updateSocialMetric(
  metricId: string | number,
  values: SocialMetricValues,
  options: {
    expectedUpdatedAt?: string | null;
    identity?: SocialMetricIdentity;
  } = {},
): Promise<SocialMetric | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const row: Record<string, number | string | null> = {};
    for (const key of Object.keys(values) as Array<keyof SocialMetricValues>) {
      const value = values[key];
      row[METRIC_COLUMN_BY_KEY[key]] =
        value ?? (key === 'followers' ? 0 : null);
    }

    // Identity/lifecycle move: recompute label + range from the same
    // canonical helpers as recordSocialMetrics, then reject the write when
    // the target (account, period, label) key already belongs to another row.
    let targetAccountId: string | undefined;
    let targetPeriod: SocialMetricPeriod | undefined;
    let targetLabel: string | undefined;
    if (options.identity) {
      const { accountId, period, date } = options.identity;
      const anchor = date ?? new Date();
      if (accountId) row.account_id = accountId;
      if (period) {
        row.period = period;
        const label = periodLabelForDate(anchor, period);
        row.period_label = label;
        const range =
          period === 'weekly'
            ? weeklyRangeForDate(anchor)
            : periodRangeForLabel(period, label);
        if (range?.start) row.period_start = range.start;
        if (range?.end) row.period_end = range.end;
      }
      targetAccountId = accountId;
      targetPeriod = period;
      targetLabel = period ? periodLabelForDate(date ?? new Date(), period) : undefined;

      const { data: current } = await supabase
        .from('social_metrics')
        .select('id, account_id, period, period_label')
        .eq('id', metricId)
        .maybeSingle();
      if (!current) return null;
      const { data: clash } = await supabase
        .from('social_metrics')
        .select('id')
        .eq('account_id', targetAccountId ?? (current.account_id as string))
        .eq('period', targetPeriod ?? (current.period as string))
        .eq('period_label', targetLabel ?? (current.period_label as string))
        .neq('id', metricId)
        .maybeSingle();
      if (clash) {
        console.warn(
          '[social] Duplicate metric key on update; aborted.',
          { metricId, row },
        );
        return null;
      }
    }

    let query = supabase.from('social_metrics').update(row).eq('id', metricId);
    if (options.expectedUpdatedAt) {
      query = query.eq('updated_at', options.expectedUpdatedAt);
    }
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    // No row matched the id (+ expected updated_at) — either the metric no
    // longer exists or it was changed concurrently. Same null contract.
    if (!data) return null;
    return toSocialMetric(data as unknown as MetricRow);
  } catch (err) {
    console.warn('[social] Could not update social metric.', err);
    return null;
  }
}

/**
 * Delete a metric row by id. Related rows follow the schema's ON DELETE
 * CASCADE: `social_data_quality_reviews` and `social_metric_edit_logs` for
 * that metric are removed with it. Returns false when nothing was deleted
 * (row missing, or `expectedUpdatedAt` no longer matches).
 */
export async function deleteSocialMetric(
  metricId: string | number,
  options: { expectedUpdatedAt?: string | null } = {},
): Promise<boolean> {
  try {
    const { supabase } = await import('@/lib/supabase');
    let query = supabase.from('social_metrics').delete().eq('id', metricId);
    if (options.expectedUpdatedAt) {
      query = query.eq('updated_at', options.expectedUpdatedAt);
    }
    const { data, error } = await query.select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn('[social] Could not delete social metric.', err);
    return false;
  }
}

/** Latest metric of one account (by period), or null when none exist. */
export async function getLatestMetric(
  accountId: string,
  period?: SocialMetricPeriod,
): Promise<SocialMetric | null> {
  const metrics = await getAccountMetrics(accountId, period);
  return latestMetric(metrics);
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
