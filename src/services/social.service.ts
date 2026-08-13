import { socialBrandData } from '@/features/mock-data/social-data.generated';
import type {
  SocialMonthlyPoint,
  SocialAccountSeries,
  SocialBrandPlatform,
  SocialBrandNode,
} from '@/features/mock-data/social-data.generated';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';

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
 * Today the source is a TypeScript snapshot generated from the real
 * "گزارش ماهیانه سپهر" CSV (monthly follower counts per brand × platform,
 * Jalali months YYYY-MM). The function signatures are async so a future
 * implementation can swap in Google Sheets / platform APIs without touching
 * the UI.
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

function growthPct(first: number, latest: number): number {
  if (first <= 0) return 0;
  return ((latest - first) / first) * 100;
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
            first && latest ? growthPct(first.value, latest.value) : 0,
          series: sorted,
        });
      }
    }
  }
  return rows;
}

/** All distinct Jalali months present in the data, sorted ascending. */
export function collectMonths(data: SocialBrandNode[] = socialBrandData): string[] {
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
    byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + (a.latest?.value ?? 0));
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
      const point = month
        ? a.series.find((p) => p.month === month)
        : a.latest;
      total += point?.value ?? 0;
    }
    return { platform, total };
  }).filter((x) => x.total > 0);
}

/**
 * Fetch the full social overview from the real data snapshot.
 * Replace the implementation below with live fetches when sources are wired up.
 */
export async function getSocialOverview(): Promise<SocialOverview> {
  const accounts = flattenAccounts();
  const months = collectMonths();
  const brands = [...new Set(accounts.map((a) => a.brand))].sort(
    (a, b) => a.localeCompare(b, 'fa'),
  );
  const summary = summarizeAccounts(accounts);
  return {
    accounts,
    platforms: SUPPORTED_PLATFORMS,
    brands,
    months,
    summary,
  };
}

/** Human label helper. */
export function platformLabel(platform: SocialPlatform): string {
  return SOCIAL_PLATFORM_LABELS[platform];
}
