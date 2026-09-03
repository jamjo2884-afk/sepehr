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
 *  - Page routes without a Supabase session cookie redirect to /login.
 *  - API routes without a session cookie return 401.
 *
 * Route handlers remain the source of truth: services call getAuthUser()
 * and never silently substitute a demo user outside demo mode.
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const AUTH_API_PATHS = ['/api/auth'];

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
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
}

/**
 * Demo mode is active when Supabase is not configured or when DEMO_MODE=true
 * is set — mirrors isDemoMode() in src/lib/auth.ts.
 */
function isDemoMode(): boolean {
  return !hasSupabaseConfig() || process.env.DEMO_MODE === 'true';
}

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value,
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths and static assets are always allowed.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Demo mode: allow everything so the app works without backend auth.
  if (isDemoMode()) {
    return NextResponse.next();
  }

  // Auth mode — a Supabase session cookie is required below.
  const hasSession = hasSessionCookie(request);

  // Page routes: redirect to /login when there is no session.
  if (!pathname.startsWith('/api/')) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // API routes: reject requests without a session.
  if (!hasSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
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
