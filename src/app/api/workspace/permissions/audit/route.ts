import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';
import { listPermissionAudit } from '@/services/workspace-members.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/permissions/audit
 *
 * Who changed whose access, what changed, and when — newest first.
 *
 * Owner/admin only: the audit trail names actors and the exact before/after of
 * every access change, which is control-center information rather than team
 * information. `?limit=` is clamped server-side (1..200).
 */
export const GET = requireRole('owner', 'admin')(async (req, { workspace }) => {
  const rawLimit = new URL(req.url).searchParams.get('limit');
  const limit = rawLimit ? Number(rawLimit) : 50;

  const result = await listPermissionAudit(workspace.workspaceId, limit);
  if (!result.ok) {
    const status =
      result.errorCode === 'forbidden'
        ? 403
        : result.errorCode === 'not_configured'
          ? 501
          : 500;
    return NextResponse.json(
      { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
      { status },
    );
  }

  return NextResponse.json({ ok: true, entries: result.data });
});
