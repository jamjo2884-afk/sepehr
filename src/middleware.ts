import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection middleware.
 *
 * When Supabase is configured (env vars present), unauthenticated users
 * are redirected to /login. When Supabase is NOT configured (demo mode),
 * all routes are allowed through so the app remains functional.
 *
 * Public routes that never need auth:
 *   /login, /register, /forgot-password, /reset-password, /_next/*, /api/health
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const AUTH_API_PATHS = ['/api/auth'];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and static assets
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // If Supabase is not configured, allow everything (demo mode)
  if (!hasSupabaseConfig()) {
    return NextResponse.next();
  }

  // Check for Supabase auth session cookie
  // Supabase stores the session in a cookie named sb-<project-ref>-auth-token
  // We check for any cookie that starts with 'sb-' and contains a JWT
  const cookies = request.cookies;
  const hasSession = cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value,
  );

  if (!hasSession) {
    // API routes get 401, page routes get redirected
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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
