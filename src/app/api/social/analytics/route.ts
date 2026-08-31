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
export async function GET(): Promise<NextResponse> {
  try {
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
}
