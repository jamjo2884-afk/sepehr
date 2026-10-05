import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
} from '@/services/workspace-members.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspace/invitations
 *
 * Create an invitation. Body: { email, role?, permissions? }
 *
 * This project has NO mail transport (no SMTP provider, no mail SDK, no mail
 * env vars), so the response carries the accept link for the owner to copy and
 * send manually. The invitation itself is a DB row created by the SECURITY
 * DEFINER create_workspace_invitation() RPC — the client has no INSERT policy.
 *
 * The accept link is built SERVER-side from NEXT_PUBLIC_APP_URL and returned on
 * the invitation record. It is deliberately not assembled in the browser from
 * window.location.origin: an owner viewing a preview deployment would otherwise
 * copy a preview URL that Vercel Deployment Protection gates behind a login.
 *
 * Returns 501 not_configured if NEXT_PUBLIC_APP_URL is unset — the service
 * refuses before creating the row, so no unredeemable invitation is left behind.
 */
export const POST = requireRole('owner', 'admin')(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: 'bad_request', errorMessage: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const { email, role, permissions } = (body ?? {}) as Record<string, unknown>;

  const result = await createWorkspaceInvitation({ email, role, permissions });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
      { status: statusFor(result.errorCode) },
    );
  }

  return NextResponse.json(
    { ok: true, invitation: result.data.invitation },
    { status: 201 },
  );
});

/**
 * GET /api/workspace/invitations
 *
 * Pending (and historical) invitations for the workspace, owner/admin only —
 * open invitations reveal member email addresses.
 */
export const GET = requireRole('owner', 'admin')(async (_req, { workspace }) => {
  const result = await listWorkspaceInvitations(workspace.workspaceId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage },
      { status: statusFor(result.errorCode) },
    );
  }
  return NextResponse.json({ ok: true, invitations: result.data });
});

function statusFor(code: string): number {
  if (code === 'invalid_input') return 400;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'not_configured') return 501;
  return 500;
}
