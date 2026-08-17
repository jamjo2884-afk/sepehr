'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { navItems } from '@/config/navigation.config';
import { Logo } from '@/components/common/logo';
import { useUIStore } from '@/stores/ui.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { TOGGLE_SIDEBAR_LABEL } from '@/constants/ui.constants';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();

  const collapsed = !sidebarOpen && !isMobile;
  const hidden = isMobile && !sidebarOpen;

  return (
    <>
      {isMobile && sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border bg-surface transition-[width,transform] duration-300 ease-out',
          collapsed ? 'w-[76px]' : 'w-72',
          hidden && 'translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? <Logo showText={false} /> : <Logo />}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={TOGGLE_SIDEBAR_LABEL}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                      collapsed && 'justify-center',
                      active
                        ? 'text-foreground'
                        : 'border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 -z-10 rounded-lg border border-primary/25 bg-primary/10"
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors duration-200',
                        active
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p
            className={cn(
              'text-[10px] text-muted-foreground',
              collapsed && 'text-center',
            )}
          >
            {collapsed ? '۰.۱' : 'نسخه ۰.۱ — آزمایشی'}
          </p>
        </div>
      </aside>
    </>
  );
}
