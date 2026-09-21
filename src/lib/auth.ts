/**
 * Server-side authentication helper.
 *
 * When Supabase is configured, extracts the authenticated user from
 * the request via the shared Supabase client. When NOT configured
 * (demo mode), returns a synthetic demo user.
 */

import { NextResponse } from 'next/server';
import {
  GUEST_USER_ID,
  getGuestContext,
  isGuestModeEnabled,
  isWriteMethod,
} from '@/lib/guest-mode';

export interface AuthUser {
  id: string;
  email: string;
}

const DEMO_USER: AuthUser = {
  id: 'demo-user-000',
  email: 'demo@mediadeck.local',
};

/**
 * True when Supabase IS configured (real backend present).
 * Exported for route handlers that must distinguish "no data yet" from
 * "session-less reader that can no longer see tenant rows".
 */
export function hasSupabaseConfig(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
}

/**
 * Check if the app is in Demo Mode.
 * Demo Mode is active when Supabase is NOT configured
 * or when DEMO_MODE=true is set.
 */
export function isDemoMode(): boolean {
  return !hasSupabaseConfig() || process.env.DEMO_MODE === 'true';
}

/**
 * True for the synthetic in-app identities (legacy demo user and the guest).
 * A request authenticated as one of them has NO real Supabase session — after
 * the 2026-09-19 security fix such readers see zero tenant rows, so routes
 * should signal 401 (login required) instead of returning an empty payload
 * that the UI would silently render as "no data".
 */
export function isSyntheticUser(
  user: { id: string } | null | undefined,
): boolean {
  return (
    !!user && (user.id === 'demo-user-000' || user.id === 'guest-user-000')
  );
}

/**
 * Get the authenticated user.
 *
 * Two valid modes:
 * - Demo Mode: No Supabase config → demo user (in-memory only).
 * - Auth Mode: Supabase configured → real session required.
 *
 * In Auth Mode, missing/invalid session returns null (unauthorized).
 * Never silently substitute DEMO_USER when Supabase is configured.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (isDemoMode()) {
    // Demo mode prefers the REAL session when one exists (e.g. a logged-in
    // developer): server requests then run as `authenticated` under RLS and
    // read the caller's own workspace. The legacy blanket anon policies were
    // removed (2026-09-19 security fix), so a session-less demo user can no
    // longer read social tables as anon — the synthetic DEMO_USER remains
    // only for fully session-less/no-Supabase local runs.
    try {
      const { createSupabaseServerClient } =
        await import('@/lib/supabase-server');
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        return { id: user.id, email: user.email ?? '' };
      }
    } catch {
      // No Supabase config / not in request scope → synthetic demo user.
    }
    return DEMO_USER;
  }

  try {
    // Server client reads the sb-*-auth-token cookie from the request so
    // the authenticated Supabase user is resolved server-side (RLS-aware).
    const { createSupabaseServerClient } =
      await import('@/lib/supabase-server');
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Supabase is configured but no valid session → unauthorized.
      // Do NOT fall back to DEMO_USER.
      //
      // Guest mode (explicit runtime opt-in): an unauthenticated visitor gets
      // the synthetic guest identity instead of null. Reads then run as
      // Supabase `anon` under RLS, which only exposes the seeded demo
      // workspace. Writes are rejected separately (route-auth + middleware).
      if (await isGuestModeEnabled()) {
        return getGuestContext();
      }
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? '',
    };
  } catch {
    // On error, deny access (fail closed)
    return null;
  }
}
/**
 * Require authentication — returns user or sends 401 NextResponse.
 *
 * Usage:
 *   const auth = await requireAuth(req);   // legacy call sites: pass req to
 *   if ('error' in auth) return auth.error; // also block guest mutations
 *   // auth is AuthUser
 */

export async function requireAuth(
  req?: Request,
): Promise<AuthUser | { error: NextResponse }> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      ),
    };
  }
  if (req && user.id === GUEST_USER_ID && isWriteMethod(req.method)) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'کاربر مهمان اجازهٔ تغییر داده ندارد.' },
        { status: 403 },
      ),
    };
  }
  return user;
}
