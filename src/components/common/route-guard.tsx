'use client';

import type { ReactNode } from 'react';

/**
 * Route guard. Auth is currently bypassed for the demo workspace (see
 * auth.store), so this simply renders children unconditionally. Kept as a
 * named export `RouteGuard` so that app/layout.tsx can import it without
 * changes.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
