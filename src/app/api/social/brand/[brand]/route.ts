import { NextResponse } from 'next/server';
import { isSyntheticUser, requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { canView } from '@/lib/permissions';
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

  // Workspace gate (PRD Dev Rule 4): legacy requireAuth only checks the
  // session — membership is enforced here, like withAuth does for the
  // wrapper-based routes.
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  // Module gate: the social module must be viewable by this member.
  if (!canView(ws, 'social')) {
    return NextResponse.json(
      { ok: false, error: 'دسترسی شما برای این بخش کافی نیست.' },
      { status: 403 },
    );
  }

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
