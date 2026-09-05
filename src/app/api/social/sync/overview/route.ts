import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/route-auth';
import { getSyncOverview } from '@/services/social-sync.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/social/sync/overview
 *
 * Returns everything the sync control center needs in one call:
 * per-platform account/connection summary + credential config state,
 * sync health, the latest sync logs, and the latest log per account.
 * Never includes credentials or raw API secrets.
 */
export const GET = requireAuth(async (): Promise<NextResponse> => {
  try {
    const overview = await getSyncOverview();
    return NextResponse.json(overview);
  } catch (err) {
    console.warn('[sync] Could not build sync overview.', err);
    return NextResponse.json(
      { error: 'دریافت وضعیت همگام‌سازی ممکن نشد.' },
      { status: 500 },
    );
  }
});
