import { NextResponse } from 'next/server';
import { getTeamWorkload } from '@/services/team-workload.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/workload
 *
 * Team workload for the caller's workspace:
 * - FlowBoard assigned-card counts per member (open / overdue)
 * - Finance brand allocations per team member
 */
export const GET = withAuth(async () => {
  try {
    const workload = await getTeamWorkload();
    return NextResponse.json({ ok: true, workload });
  } catch (err) {
    console.warn('[api/team] Could not build team workload.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت بار کاری تیم.' },
      { status: 500 },
    );
  }
});
