'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Route guard. While auth is loading it shows a spinner; unauthenticated
 * users are redirected to /login (except when already on an auth page);
 * authenticated users get the app shell content.
 */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  const isAuthPage = AUTH_PAGES.includes(pathname);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' && !isAuthPage) {
      router.replace('/login');
    } else if (status === 'authenticated' && isAuthPage) {
      router.replace('/command-center');
    }
  }, [status, isAuthPage, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
