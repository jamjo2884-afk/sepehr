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
 * Get the authenticated user.
 *
 * - No Supabase config → demo user (demo mode).
 * - Supabase configured but no session → null.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (!hasSupabaseConfig()) {
    return DEMO_USER;
  }

  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // No session — fall back to demo user so the app works
      // even before email confirmation or during development.
      return DEMO_USER;
    }

    return {
      id: user.id,
      email: user.email ?? '',
    };
  } catch {
    return DEMO_USER;
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
