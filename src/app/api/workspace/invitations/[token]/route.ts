import { NextResponse } from 'next/server';
import { requireRole, type RouteContext } from '@/lib/route-auth';
import { revokeWorkspaceInvitation } from '@/services/workspace-members.service';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/workspace/invitations/[token]
 *
 * Revoke a pending invitation. Addressed by the share token (what the owner
 * has in hand), resolved to an invitation id server-side — the revocation RPC
 * keys on the id and re-checks owner/admin inside the database.
 */
export const DELETE = requireRole('owner', 'admin')(
  async (_req, _auth, ctx: RouteContext) => {
    const params = (await ctx.params) ?? {};
    const token = params.token ?? '';

    const result = await revokeWorkspaceInvitation(token);
    if (!result.ok) {
      const status =
        result.errorCode === 'invalid_input'
          ? 400
          : result.errorCode === 'forbidden'
            ? 403
            : result.errorCode === 'not_found'
              ? 404
              : result.errorCode === 'not_configured'
                ? 501
                : 500;
      return NextResponse.json(
        { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
        { status },
      );
    }

    return NextResponse.json({ ok: true });
  },
);
