/**
 * API Route Auth Wrapper
 *
 * Wraps Next.js API route handlers with authentication and workspace context.
 * In demo mode (no Supabase config), allows all requests with demo workspace.
 * When Supabase is configured, requires valid session + workspace membership.
 */

import { NextResponse } from 'next/server';
import { getAuthUser, type AuthUser } from '@/lib/auth';
import {
  getCurrentWorkspace,
  type WorkspaceContext,
} from '@/lib/workspace';

export type AuthenticatedRequest = {
  user: AuthUser;
  workspace: WorkspaceContext;
};

type RouteHandler = (
  req: Request,
  auth: AuthenticatedRequest,
) => Promise<NextResponse> | NextResponse;

type AuthOnlyHandler = (
  req: Request,
  auth: { user: AuthUser },
) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * Require authentication only (no workspace check).
 * Use for routes that need auth but don't require workspace context.
 */
export function requireAuth(handler: AuthOnlyHandler) {
  return async (req: Request): Promise<NextResponse | Response> => {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      );
    }
    return handler(req, { user });
  };
}

export function withAuth(handler: RouteHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      );
    }

    const workspace = await getCurrentWorkspace();
    if (!workspace) {
      return NextResponse.json(
        { ok: false, error: 'فضای کاری یافت نشد.' },
        { status: 403 },
      );
    }

    return handler(req, { user, workspace });
  };
}
