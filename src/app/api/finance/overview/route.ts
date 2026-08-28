import { NextResponse } from 'next/server';
import { getFinanceOverview } from '@/services/finance/finance-analytics.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/overview?brand=...
 *
 * Returns the finance overview KPIs (total budget, spent, remaining, etc.).
 */
export async function GET(
  req: Request,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand') || undefined;
    const overview = await getFinanceOverview(brand);
    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    console.warn('[finance] Could not build overview.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت نمای کلی.' },
      { status: 500 },
    );
  }
}
