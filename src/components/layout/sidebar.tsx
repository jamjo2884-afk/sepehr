'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  EXTRA_SECTIONS_STORAGE_KEY,
  getVisibleNavItems,
  isActivePath,
} from '@/lib/sidebar-sections';
import { sectionTintVar } from '@/config/navigation.config';
import { Logo } from '@/components/common/logo';
import { useUIStore } from '@/stores/ui.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { TOGGLE_SIDEBAR_LABEL } from '@/constants/ui.constants';
import {
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const [showExtra, setShowExtra] = useState(false);

  useEffect(() => {
    try {
      setShowExtra(localStorage.getItem(EXTRA_SECTIONS_STORAGE_KEY) === 'true');
    } catch {
      // Keep the default hidden state when browser storage is unavailable.
    }
  }, []);

  const toggleExtraSections = () => {
    const nextVisible = !showExtra;
    setShowExtra(nextVisible);
    try {
      localStorage.setItem(EXTRA_SECTIONS_STORAGE_KEY, String(nextVisible));
    } catch {
      // The toggle still works for this session if storage is blocked.
    }
  };
  const extraSectionsLabel = showExtra
    ? 'پنهان کردن بخش‌های بیشتر'
    : 'نمایش بخش‌های بیشتر';
  // A stable icon so the collapsed rail and mobile drawer do not "jump"
  // when toggling; the change is communicated by the list itself.
  const ExtraSectionsIcon = MoreHorizontal;
  const visibleNavItems = getVisibleNavItems(showExtra, pathname);

  // Keep the desktop default open without exposing the full sidebar on the
  // first mobile render. This only runs when the breakpoint changes, so a
  // manually opened drawer is not immediately closed again.
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);

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
          // Do not leave a translated fixed drawer in the scrollable overflow
          // area while it is closed on mobile. It must be removed from layout
          // until the menu is opened.
          hidden && 'hidden',
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
            {visibleNavItems.map((item) => {
              const active = isActivePath(pathname, item.href);
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
                        className="absolute inset-0 -z-10 rounded-lg border bg-[color-mix(in_srgb,var(--tint)_16%,transparent)]"
                        style={{
                          // v2: active nav glows in the section's own hue.
                          ['--tint' as string]: sectionTintVar[item.section],
                          borderColor:
                            'color-mix(in srgb, var(--tint) 30%, transparent)',
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                        active ? 'icon-chip' : 'bg-transparent',
                      )}
                      style={{
                        ['--tint' as string]: sectionTintVar[item.section],
                      }}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0 transition-colors duration-200',
                          active
                            ? ''
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                    </span>
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={toggleExtraSections}
                aria-expanded={showExtra}
                aria-label={extraSectionsLabel}
                title={collapsed ? extraSectionsLabel : undefined}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground',
                  collapsed && 'justify-center',
                )}
              >
                <ExtraSectionsIcon
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
                />
                {!collapsed ? <span>{extraSectionsLabel}</span> : null}
              </button>
            </li>
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
