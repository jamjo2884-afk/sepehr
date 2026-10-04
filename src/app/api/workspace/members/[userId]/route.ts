import { NextResponse } from 'next/server';
import { requireRole, type RouteContext } from '@/lib/route-auth';
import {
  removeWorkspaceMember,
  updateMemberAccess,
} from '@/services/workspace-members.service';

export const dynamic = 'force-dynamic';

async function targetUserId(ctx: RouteContext): Promise<string> {
  const params = (await ctx.params) ?? {};
  return params.userId ?? '';
}

/**
 * PATCH /api/workspace/members/[userId]
 *
 * Change a member's role and/or permission matrix. Body: { role?, permissions? }
 *
 * Two-layered authorization, matching the guest-mode pattern:
 *   1. requireRole('owner','admin') here.
 *   2. update_member_access() re-checks inside the database (SECURITY DEFINER)
 *      and additionally refuses owner targets, self-targets and admin->owner
 *      promotion. There is no client-writable policy on workspace_members, so
 *      this RPC is the only way the row can change at all.
 */
export const PATCH = requireRole('owner', 'admin')(
  async (req, _auth, ctx) => {
    const userId = await targetUserId(ctx);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, errorCode: 'bad_request', errorMessage: 'درخواست نامعتبر است.' },
        { status: 400 },
      );
    }

    const { role, permissions } = (body ?? {}) as Record<string, unknown>;

    const result = await updateMemberAccess(userId, { role, permissions });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
        { status: statusForMutation(result.errorCode) },
      );
    }

    return NextResponse.json({ ok: true, changed: result.data.changed });
  },
);

/**
 * DELETE /api/workspace/members/[userId]
 *
 * Remove a member from the workspace. The RPC refuses owner targets for
 * non-owners, refuses self-removal, and refuses removing the last owner.
 */
export const DELETE = requireRole('owner', 'admin')(
  async (_req, _auth, ctx) => {
    const userId = await targetUserId(ctx);

    const result = await removeWorkspaceMember(userId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
        { status: statusForMutation(result.errorCode) },
      );
    }

    return NextResponse.json({ ok: true });
  },
);

function statusForMutation(code: string): number {
  if (code === 'invalid_input') return 400;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'not_configured') return 501;
  return 500;
}
