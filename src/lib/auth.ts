/**
 * Server-side authentication helper.
 *
 * When Supabase is configured, extracts the authenticated user from
 * the request via the shared Supabase client. When NOT configured
 * (demo mode), returns a synthetic demo user.
 */

import { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  email: string;
}

const DEMO_USER: AuthUser = {
  id: 'demo-user-000',
  email: 'demo@mediadeck.local',
};

function hasSupabaseConfig(): boolean {
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
    // No Supabase configured or demo mode — synthetic user (in-memory only)
    return DEMO_USER;
  }

  try {
    // Server client reads the sb-*-auth-token cookie from the request so
    // the authenticated Supabase user is resolved server-side (RLS-aware).
    const { createSupabaseServerClient } = await import('@/lib/supabase-server');
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Supabase is configured but no valid session → unauthorized.
      // Do NOT fall back to DEMO_USER.
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
 *   const auth = await requireAuth();
 *   if ('error' in auth) return auth.error;
 *   // auth is AuthUser
 */
export async function requireAuth(): Promise<
  AuthUser | { error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      ),
    };
  }
  return user;
}
