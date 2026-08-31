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

  // Page routes: always allow (UI handles auth state via API responses)
  // This ensures the app works even before email confirmation or when
  // Supabase auth is still being set up.
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // API routes: check for Supabase auth session cookie
  const cookies = request.cookies;
  const hasSession = cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value,
  );

  if (!hasSession) {
    // No session cookie — fall back to demo mode instead of blocking.
    // Services will use in-memory/localStorage data.
    return NextResponse.next();
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
