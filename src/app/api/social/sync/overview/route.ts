import { NextResponse } from 'next/server';
import { getSyncOverview } from '@/services/social-sync.service';

/**
 * GET /api/social/sync/overview
 *
 * Returns everything the sync control center needs in one call:
 * per-platform account/connection summary + credential config state,
 * sync health, the latest sync logs, and the latest log per account.
 * Never includes credentials or raw API secrets.
 */
export async function GET(): Promise<NextResponse> {
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
}
