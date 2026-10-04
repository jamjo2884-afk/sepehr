import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-auth';
import { listWorkspaceMembers } from '@/services/workspace-members.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/members
 *
 * The member roster with each person's role and permission matrix.
 *
 * Open to EVERY member of the workspace (withAuth, no requireRole): seeing
 * who else is on the team is an ordinary need, and the list is already scoped
 * to the caller's own workspace by RLS. Changing anything about those members
 * is gated separately on PATCH/DELETE below.
 */
export const GET = withAuth(async (_req, { workspace }) => {
  const result = await listWorkspaceMembers(workspace.workspaceId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
      { status: statusForRead(result.errorCode) },
    );
  }
  return NextResponse.json({ ok: true, members: result.data });
});

function statusForRead(code: string): number {
  if (code === 'forbidden') return 403;
  if (code === 'not_configured') return 501;
  return 500;
}
