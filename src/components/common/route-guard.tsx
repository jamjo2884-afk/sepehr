'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'loading') return;
    const publicRoute = isPublicRoute(pathname);
    if (status === 'unauthenticated' && !publicRoute) {
      router.replace('/login');
    }
    if (status === 'authenticated' && publicRoute) {
      router.replace('/command-center');
    }
  }, [status, pathname, router]);

  // While loading, render nothing to avoid flashing protected content.
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">
            در حال بارگذاری…
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
