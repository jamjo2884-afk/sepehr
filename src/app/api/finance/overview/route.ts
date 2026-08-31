import { NextResponse } from 'next/server';
import { getFinanceOverview } from '@/services/finance/finance-analytics.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/overview?brand=...
 *
 * Returns the finance overview KPIs (total budget, spent, remaining, etc.).
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || undefined;
    const overview = await getFinanceOverview(brandId);
    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    console.warn('[finance] Could not build overview.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت نمای کلی.' },
      { status: 500 },
    );
  }
});
