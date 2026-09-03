import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection middleware.
 *
 * Demo mode (Supabase not configured, or DEMO_MODE=true) allows all traffic
 * through so the app stays fully functional without backend auth.
 *
 * Auth mode (Supabase configured and DEMO_MODE unset):
 *  - Public/auth paths and static assets are always allowed.
 *  - A server client validates the session with supabase.auth.getUser() and
 *    refreshes it when needed (writing refreshed cookies back to the
 *    response). A valid user is required past the public paths.
 *  - Page routes without a valid session redirect to /login?next=…
 *  - API routes without a valid session return 401.
 *
 * Route handlers remain the source of truth: services call getAuthUser()
 * and never silently substitute a demo user outside demo mode.
 */
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const AUTH_API_PATHS = ['/api/auth'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === '/api/health' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    AUTH_API_PATHS.some((p) => pathname.startsWith(p))
  );
}

function hasSupabaseConfig(): boolean {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co'
  );
}

/**
 * Demo mode is active when Supabase is not configured or when DEMO_MODE=true
 * is set — mirrors isDemoMode() in src/lib/auth.ts.
 */
function isDemoMode(): boolean {
  return !hasSupabaseConfig() || process.env.DEMO_MODE === 'true';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths and static assets are always allowed.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Demo mode: allow everything so the app works without backend auth.
  if (isDemoMode()) {
    return NextResponse.next();
  }

  // Auth mode — validate the real Supabase session.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: nothing should run between createServerClient and getUser() —
  // otherwise the client may refresh the session and set cookies mid-request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Page routes: redirect to /login when there is no valid session.
  if (!pathname.startsWith('/api/')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // API routes: reject requests without a valid session.
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
