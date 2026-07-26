'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/theme-context';
import { QueryProvider } from '@/contexts/query-context';
import { AuthProvider } from '@/contexts/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
