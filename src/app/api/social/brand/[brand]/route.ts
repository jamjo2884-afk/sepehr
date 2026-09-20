import { NextResponse } from 'next/server';
import { isSyntheticUser, requireAuth } from '@/lib/auth';
import {
  getBrandSocialAnalytics,
  getSocialAccounts,
  getSocialMetrics,
} from '@/services/social.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/social/brand/[brand]
 *
 * Returns brand-specific social analytics plus the full accounts + metrics
 * datasets needed by the brand performance page.
 */
export async function GET(
  _req: Request,
  { params }: { params: { brand: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  // Same gate as /api/social/analytics: a synthetic identity (session-less
  // demo user / guest) reads ZERO tenant rows after the RLS lockdown, so
  // return an explicit 401 instead of a silently-empty payload.
  if (isSyntheticUser(auth)) {
    return NextResponse.json(
      { ok: false, error: 'برای مشاهدهٔ داده‌ها وارد حساب شوید.' },
      { status: 401 },
    );
  }

  try {
    const brand = decodeURIComponent(params.brand);

    const [analytics, accounts, metrics] = await Promise.all([
      getBrandSocialAnalytics(brand),
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]);

    return NextResponse.json({
      ok: true,
      analytics,
      accounts,
      metrics,
    });
  } catch (err) {
    console.warn('[social/brand] Could not build brand analytics.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت تحلیل برند.' },
      { status: 500 },
    );
  }
}
