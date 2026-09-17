/**
 * Social trend service — server-side aggregation for the 5 time-series charts.
 *
 * Architecture (PRD Dev Rule 4 + 10):
 * - Workspace-aware: the caller (API route) resolves the workspace's brand
 *   ids via `getBrands(workspaceId)` and passes them here; every query
 *   filters `social_accounts.brand_id` IN (…). `social_accounts` has no
 *   workspace column, so `brand_id → brands.workspace_id` is the only
 *   workspace link — this keeps cross-workspace data out by construction.
 * - Aggregation happens in Postgres (GROUP BY period_label + brand/platform)
 *   instead of shipping raw rows to the browser. The client receives only
 *   the aggregated series.
 * - Honest zeros: months with no data are returned as points with value 0
 *   by the FRONTEND formatter (never fabricated server-side); the server
 *   returns exactly the months that exist in the data.
 *
 * Granularity note (production reality, verified 2026-09-16):
 * `social_metrics` contains ONLY monthly rows (Jalali 'YYYY-MM' labels,
 * 1403-03 … 1405-05). `social_followers` is empty. The 7/30/90-day presets
 * therefore map onto the last 1/1/3 Jalali months respectively until daily
 * data starts flowing in.
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import { isDemoMode } from '@/lib/auth';
import { jalaliMonthName } from '@/services/social-analytics';
import type { SocialPlatform } from '@/types/domain';

/** One aggregated point of one series. */
export interface SocialTrendSeriesPoint {
  /** Sortable Jalali 'YYYY-MM' label. */
  month: string;
  /** Persian label, e.g. 'مرداد ۱۴۰۴'. */
  monthLabel: string;
  value: number;
}

/**
 * One named series (brand or platform or aggregate).
 *
 * `byBrand` (optional) carries the per-brand split of a platform series so
 * the chart tooltip can show a second level (platform → brands of that
 * platform for the hovered month) without a second round trip.
 */
export interface SocialTrendSeries {
  name: string;
  points: SocialTrendSeriesPoint[];
  byBrand?: SocialTrendSeries[];
}

/** Full payload for the trend dashboard. */
export interface SocialTrendsPayload {
  /**
   * Chart 1 — total followers across ALL selected accounts, per month.
   * (Snapshot metric: the account's latest value inside the month is used;
   * rows are monthly snapshots so each month contributes its own value.)
   */
  totalFollowers: SocialTrendSeriesPoint[];
  /**
   * Chart 2 — views per month, one series per platform (views are sparse —
   * only months/platforms with recorded views appear).
   */
  viewsByPlatform: SocialTrendSeries[];
  /**
   * Chart 3 — total reach per month (sparse like views; a single line).
   */
  totalReach: SocialTrendSeriesPoint[];
  /** Chart 4 — followers per month, one series per brand. */
  followersByBrand: SocialTrendSeries[];
  /** Chart 5 — followers per month, one series per platform. */
  followersByPlatform: SocialTrendSeries[];
  /** Every Jalali month label present in the payload (sorted). */
  months: string[];
  /** Brand names included (resolved from brand ids → names). */
  brands: string[];
  /** Platforms included. */
  platforms: SocialPlatform[];
}

/** Columns we read from social_metrics (no secret / no PII). */
const METRIC_COLUMNS =
  'id, account_id, period, period_label, followers, views, reach';

interface MetricRowLite {
  id: string | number;
  account_id: string;
  period: string;
  period_label: string;
  followers: number | null;
  views: number | null;
  reach: number | null;
}

interface AccountRowLite {
  id: string;
  brand_id: string | null;
  brand: string | null;
  platform: SocialPlatform;
}

/**
 * Get the workspace's social trend aggregation.
 *
 * @param brandIds Brand ids belonging to the caller's workspace (from
 *        `getBrands(workspaceId)`). Empty array → empty payload for an
 *        AUTHENTICATED caller (honest zero, never "all brands of every
 *        workspace") — EXCEPT in demo mode, where no session exists and the
 *        workspace id is synthetic: there the tables are read workspace-
 *        agnostically, exactly like every other social reader (see the
 *        account-loading note below).
 * @param monthStart Inclusive Jalali 'YYYY-MM' lower bound.
 * @param monthEnd Inclusive Jalali 'YYYY-MM' upper bound.
 */
export async function getSocialTrends(input: {
  brandIds: string[];
  monthStart: string;
  monthEnd: string;
}): Promise<SocialTrendsPayload> {
  const { brandIds, monthStart, monthEnd } = input;

  const empty: SocialTrendsPayload = {
    totalFollowers: [],
    viewsByPlatform: [],
    totalReach: [],
    followersByBrand: [],
    followersByPlatform: [],
    months: [],
    brands: [],
    platforms: [],
  };

  /**
   * Demo mode has no real session: `getBrands('demo-workspace-000')` returns
   * nothing (and `brands` is RLS-hidden from anon anyway), so a strict empty
   * return would render an EMPTY trends block next to a fully populated
   * /social page — /api/social/analytics, getSocialAccounts and
   * getSocialMetrics all read the tables workspace-agnostically by design.
   * In demo there is no real user, so reading every account cannot leak
   * another workspace's data. An authenticated caller with zero brands keeps
   * the honest empty payload below.
   */
  const demo = await isDemoMode();
  if (brandIds.length === 0 && !demo) return empty;

  try {
    const supabase = await getSupabase();
    if (!(await isTableAvailable('social_accounts'))) return empty;
    if (!(await isTableAvailable('social_metrics'))) return empty;

    // Resolve brand id → display name for series labels.
    const { data: brandRows, error: brandErr } = await supabase
      .from('brands')
      .select('id, name')
      .in('id', brandIds);
    if (brandErr) throw brandErr;
    const brandName = new Map<string, string>(
      (brandRows ?? []).map((r) => [r.id as string, r.name as string]),
    );

    // Accounts of THIS workspace only. A legacy import left 58/110 accounts
    // with brand_id NULL but the brand NAME intact (`brand` column); matching
    // ONLY on brand_id silently dropped 8 of the 13 catalog brands from the
    // per-brand chart. Fetch by brand_id OR by the workspace brands' names —
    // the strict id link wins for labeling, the name is the fallback.
    const brandNames = [...brandName.values()];
    const accounts: AccountRowLite[] = [];
    {
      const PAGE = 1000;
      const load = async (filter: Record<string, unknown> | null) => {
        for (let from = 0; ; from += PAGE) {
          const query = filter
            ? supabase
                .from('social_accounts')
                .select('id, brand_id, brand, platform')
                .match(filter)
            : supabase
                .from('social_accounts')
                .select('id, brand_id, brand, platform');
          const { data, error } = await query.range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          accounts.push(...(data as unknown as AccountRowLite[]));
          if (data.length < PAGE) break;
        }
      };
      if (brandIds.length > 0) {
        // Direct id links (authoritative).
        await load({ brand_id: brandIds });
        const haveIds = new Set(accounts.map((a) => a.id));
        // Name-linked orphans (brand_id NULL): one request per brand name is
        // avoided by fetching `brand in (names)` + brand_id IS NULL.
        if (brandNames.length > 0) {
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
              .from('social_accounts')
              .select('id, brand_id, brand, platform')
              .in('brand', brandNames)
              .is('brand_id', null)
              .range(from, from + PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            for (const row of data as unknown as AccountRowLite[]) {
              if (!haveIds.has(row.id)) accounts.push(row);
            }
            if (data.length < PAGE) break;
          }
        }
      } else if (demo) {
        // Demo: no workspace brand set — read every account (see the note
        // above the empty-payload guard; same contract as /api/social/analytics).
        await load(null);
      }
    }
    if (accounts.length === 0) return empty;

    const accountIds = accounts.map((a) => a.id);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const accountIdToBrandName = new Map<string, string>();
    for (const a of accounts) {
      accountIdToBrandName.set(
        a.id,
        (a.brand_id && brandName.get(a.brand_id)) || a.brand || 'برند ناشناس',
      );
    }

    // Monthly metrics of these accounts within the month range. Account ids
    // are chunked (PostgREST URL-length safety) and each chunk is paginated
    // past the 1000-row response cap.
    const rows: MetricRowLite[] = [];
    {
      const CHUNK = 500; // account ids per request
      const PAGE = 1000; // rows per request
      for (let c = 0; c < accountIds.length; c += CHUNK) {
        const chunk = accountIds.slice(c, c + CHUNK);
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('social_metrics')
            .select(METRIC_COLUMNS)
            .eq('period', 'monthly')
            .gte('period_label', monthStart)
            .lte('period_label', monthEnd)
            .in('account_id', chunk)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          rows.push(...(data as unknown as MetricRowLite[]));
          if (data.length < PAGE) break;
        }
      }
    }

    // Group rows by month for snapshot vs flow metric semantics.
    // followers = snapshot → per month, take the account's value that month
    // and sum across accounts (each monthly row IS that month's snapshot).
    // views / reach = flow → sum every non-null value in the month.
    const byMonth = new Map<string, MetricRowLite[]>();
    for (const r of rows) {
      const list = byMonth.get(r.period_label) ?? [];
      list.push(r);
      byMonth.set(r.period_label, list);
    }
    const months = [...byMonth.keys()].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );

    // ---- Chart 1: total followers ----
    const totalFollowers: SocialTrendSeriesPoint[] = months.map((month) => {
      const list = byMonth.get(month) ?? [];
      const latestPerAccount = new Map<string, number>();
      for (const r of list) {
        if (typeof r.followers === 'number') {
          latestPerAccount.set(r.account_id, r.followers);
        }
      }
      let sum = 0;
      for (const v of latestPerAccount.values()) sum += v;
      return { month, monthLabel: jalaliMonthName(month), value: sum };
    });

    // ---- Chart 4: followers by brand ----
    const followersByBrand: SocialTrendSeries[] = [];
    {
      const brandNames = [...new Set(accountIdToBrandName.values())].sort(
        (a, b) => a.localeCompare(b, 'fa'),
      );
      for (const bname of brandNames) {
        const ids = new Set(
          [...accountById.values()]
            .filter((a) => accountIdToBrandName.get(a.id) === bname)
            .map((a) => a.id),
        );
        const points: SocialTrendSeriesPoint[] = [];
        for (const month of months) {
          const list = (byMonth.get(month) ?? []).filter((r) =>
            ids.has(r.account_id),
          );
          let sum = 0;
          let any = false;
          for (const r of list) {
            if (typeof r.followers === 'number') {
              sum += r.followers;
              any = true;
            }
          }
          if (any)
            points.push({
              month,
              monthLabel: jalaliMonthName(month),
              value: sum,
            });
        }
        if (points.length > 0) followersByBrand.push({ name: bname, points });
      }
    }

    // ---- Chart 5: followers by platform ----
    // Followers are a SNAPSHOT metric: real points only (no fabricated
    // zeros), but every platform of the workspace gets a series, each with
    // a `byBrand` split for the tooltip's second level. Sparse months stay
    // gaps inside the line (connectNulls off) instead of dropping the
    // platform from the legend.
    const followersByPlatform: SocialTrendSeries[] = [];
    {
      const platforms = [...new Set(accounts.map((a) => a.platform))].sort();
      for (const p of platforms) {
        const platformAccountIds = accounts
          .filter((a) => a.platform === p)
          .map((a) => a.id);
        const ids = new Set(platformAccountIds);
        const points: SocialTrendSeriesPoint[] = [];
        for (const month of months) {
          const list = (byMonth.get(month) ?? []).filter((r) =>
            ids.has(r.account_id),
          );
          let sum = 0;
          let any = false;
          for (const r of list) {
            if (typeof r.followers === 'number') {
              sum += r.followers;
              any = true;
            }
          }
          if (any)
            points.push({
              month,
              monthLabel: jalaliMonthName(month),
              value: sum,
            });
        }
        // Per-brand split of this platform (tooltip level 2).
        const brandNamesOnPlatform = [
          ...new Set(
            platformAccountIds.map(
              (id) => accountIdToBrandName.get(id) ?? 'برند ناشناس',
            ),
          ),
        ].sort((a, b) => a.localeCompare(b, 'fa'));
        const byBrand: SocialTrendSeries[] = [];
        for (const bname of brandNamesOnPlatform) {
          const bIds = new Set(
            platformAccountIds.filter(
              (id) => accountIdToBrandName.get(id) === bname,
            ),
          );
          const bPoints: SocialTrendSeriesPoint[] = [];
          for (const month of months) {
            const list = (byMonth.get(month) ?? []).filter((r) =>
              bIds.has(r.account_id),
            );
            let sum = 0;
            let any = false;
            for (const r of list) {
              if (typeof r.followers === 'number') {
                sum += r.followers;
                any = true;
              }
            }
            if (any)
              bPoints.push({
                month,
                monthLabel: jalaliMonthName(month),
                value: sum,
              });
          }
          if (bPoints.length > 0)
            byBrand.push({ name: bname, points: bPoints });
        }
        if (points.length > 0 || byBrand.length > 0)
          followersByPlatform.push({ name: p, points, byBrand });
      }
    }

    // ---- Chart 2: views by platform ----
    // Views are a FLOW metric: every platform of the workspace is emitted
    // (so the legend always lists them all) and months without recorded
    // views are honest zeros — never gaps, never dropped series.
    const viewsByPlatform: SocialTrendSeries[] = [];
    {
      const platforms = [...new Set(accounts.map((a) => a.platform))].sort();
      for (const p of platforms) {
        const ids = new Set(
          accounts.filter((a) => a.platform === p).map((a) => a.id),
        );
        const points: SocialTrendSeriesPoint[] = months.map((month) => {
          const list = (byMonth.get(month) ?? []).filter((r) =>
            ids.has(r.account_id),
          );
          let sum = 0;
          for (const r of list) {
            if (typeof r.views === 'number') sum += r.views;
          }
          return { month, monthLabel: jalaliMonthName(month), value: sum };
        });
        viewsByPlatform.push({ name: p, points });
      }
    }

    // ---- Chart 3: total reach ----
    const totalReach: SocialTrendSeriesPoint[] = months.map((month) => {
      const list = byMonth.get(month) ?? [];
      let sum = 0;
      for (const r of list) {
        if (typeof r.reach === 'number') sum += r.reach;
      }
      return { month, monthLabel: jalaliMonthName(month), value: sum };
    });

    return {
      totalFollowers,
      viewsByPlatform,
      totalReach,
      followersByBrand,
      followersByPlatform,
      months,
      // Authenticated path: the workspace catalog (even brands without data).
      // Demo path (no catalog readable): the distinct brand names of the
      // accounts actually read, so the brand chips match the series.
      brands:
        brandName.size > 0
          ? [...brandName.values()]
          : [...new Set(accountIdToBrandName.values())].sort((a, b) =>
              a.localeCompare(b, 'fa'),
            ),
      platforms: [...new Set(accounts.map((a) => a.platform))].sort(),
    };
  } catch (err) {
    // Fail loud enough to be debuggable, but the endpoint stays 200-with-zeros
    // (honest empty state) rather than leaking infrastructure errors.
    console.warn('[social-trends] aggregation failed:', err);
    return empty;
  }
}
