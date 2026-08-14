'use client';

import type { ReactNode } from 'react';

/**
 * Auth is currently bypassed so the project preview works without a
 * configured Supabase backend. See auth.store for the demo session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}