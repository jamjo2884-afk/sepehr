import { requireAuth } from '@/lib/route-auth';
import { isSyntheticUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/social/analytics
 *
 * Returns pre-fetched social accounts + metrics for analytics pages.
 * Analytics computation stays client-side (pure functions),
 * only data fetching moves server-side.
 *
 * This eliminates the need for client-side Supabase queries
 * and reduces the client bundle size.
 */
export const GET = requireAuth(async (_req, auth): Promise<NextResponse> => {
  try {
    // A synthetic identity (legacy demo user / guest) has no real Supabase
    // session — since the 2026-09-19 RLS fix such readers get ZERO tenant
    // rows. Signal "login required" instead of an empty payload the UI would
    // silently render as "no data".
    if (isSyntheticUser(auth.user)) {
      return NextResponse.json(
        { ok: false, error: 'برای مشاهدهٔ داده‌ها وارد حساب شوید.' },
        { status: 401 },
      );
    }
    const [accounts, metrics] = await Promise.all([
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]);

    return NextResponse.json({
      ok: true,
      accounts,
      metrics,
    });
  } catch (err) {
    console.warn('[social] Could not build analytics data.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت داده‌های تحلیلی.' },
      { status: 500 },
    );
  }
});
