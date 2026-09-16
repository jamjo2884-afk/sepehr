import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-auth';
import { getBrands } from '@/services/brand.service';
import { getSocialTrends } from '@/services/social-trends.service';
import { currentJalaliMonth, jalaliAddMonths } from '@/services/social-analytics';
import type { SocialTrendsPayload } from '@/services/social-trends.service';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * GET /api/social/trends
 *
 * Server-aggregated time series for the 5 trend charts.
 *
 * Workspace isolation (PRD Dev Rule 4): the brand set is ALWAYS resolved
 * server-side from the caller's workspace (`getBrands(workspaceId)`); any
 * client-provided `brand_ids` is intersected with that set so a user can
 * narrow the view to their own brands but can never widen it into another
 * workspace's data. An unknown or empty intersection yields an honest empty
 * payload, never another workspace's rows.
 *
 * Query params:
 * - brand_ids   optional comma-separated brand ids (workspace subset filter)
 * - months      optional lookback window in months (default 24, max 36)
 * - start/end   optional explicit Jalali 'YYYY-MM' bounds (override months)
 */
export const GET = withAuth(async (req: Request, auth) => {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Server-resolved workspace brand set (the security boundary).
    const wsBrands = await getBrands(auth.workspace.workspaceId);
    const wsBrandIds = wsBrands.map((b) => b.id);

    // 2. Optional client narrowing, intersected with the workspace set.
    const requested = (searchParams.get('brand_ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const brandIds =
      requested.length > 0
        ? requested.filter((id) => wsBrandIds.includes(id))
        : wsBrandIds;

    // 3. Month window.
    const now = currentJalaliMonth();
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const monthsParam = Number(searchParams.get('months') ?? 24);
    const lookback =
      Number.isFinite(monthsParam) && monthsParam > 0
        ? Math.min(Math.floor(monthsParam), 36)
        : 24;

    const monthEnd =
      endParam && MONTH_RE.test(endParam) && endParam <= now ? endParam : now;
    const monthStart =
      startParam && MONTH_RE.test(startParam) && startParam <= monthEnd
        ? startParam
        : jalaliAddMonths(monthEnd, -(lookback - 1));

    const payload = await getSocialTrends({
      brandIds,
      monthStart,
      monthEnd,
    });

    return NextResponse.json(
      { ok: true, range: { start: monthStart, end: monthEnd }, ...payload },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.warn('[api/social/trends] GET error:', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت روند شبکه‌های اجتماعی.' },
      { status: 500 },
    );
  }
});

export type { SocialTrendsPayload };
