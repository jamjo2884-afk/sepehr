/**
 * API Route Auth Wrapper
 *
 * Wraps Next.js API route handlers with authentication.
 * In demo mode (no Supabase config), allows all requests.
 * When Supabase is configured, requires valid session.
 */

import { NextResponse } from 'next/server';
import { getAuthUser, type AuthUser } from '@/lib/auth';

type RouteHandler = (
  req: Request,
  user: AuthUser,
) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: RouteHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      );
    }
    return handler(req, user);
  };
}
