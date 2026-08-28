import { NextResponse } from 'next/server';
import { getFinanceDashboardData,
  getPlatformEfficiency,
  getBrandPerformance,
  getScatterData,
} from '@/services/finance/finance-analytics.service';
import { getHumanCostByBrand, getBrandTotalCosts } from '@/services/finance/team-analytics.service';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/analytics?brand=...
 *
 * Returns the full finance analytics dashboard data including
 * budget vs actual, expense breakdown, brand costs, platform
 * efficiency, and scatter data.
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand') || undefined;

    const [dashboard, accounts, metrics] = await Promise.all([
      getFinanceDashboardData(brand),
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]);

    const [platformEfficiency, brandPerformance, scatterData] =
      await Promise.all([
        getPlatformEfficiency(accounts, metrics, brand),
        getBrandPerformance(accounts, metrics),
        getScatterData(accounts, metrics),
      ]);

    const [humanCosts, brandTotalCosts] = await Promise.all([
      getHumanCostByBrand(),
      getBrandTotalCosts(dashboard.brandCosts, accounts, metrics),
    ]);

    return NextResponse.json({
      ok: true,
      ...dashboard,
      platformEfficiency,
      brandPerformance,
      scatterData,
      humanCosts,
      brandTotalCosts,
    });
  } catch (err) {
    console.warn('[finance] Could not build analytics.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت تحلیل‌ها.' },
      { status: 500 },
    );
  }
});
