import { NextResponse } from 'next/server';
import { getCommandCenterData } from '@/services/command-center.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/command-center
 *
 * Real KPI aggregates for the /command-center dashboard, scoped to the
 * caller's workspace (resolved by withAuth). No mock data is ever
 * produced here — sources with no rows return honest zeros/empty.
 */
export const GET = withAuth(async (_req, auth) => {
  try {
    const data = await getCommandCenterData({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.warn('[api/command-center] Could not build dashboard.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت نمای کلی.' },
      { status: 500 },
    );
  }
});