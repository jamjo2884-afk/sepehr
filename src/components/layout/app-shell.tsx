'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useUIStore } from '@/stores/ui.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useUIStore();
  const isMobile = useIsMobile();
  const collapsed = !sidebarOpen && !isMobile;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pr-[76px]' : 'lg:pr-72',
        )}
      >
        <Header />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
