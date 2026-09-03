'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/flowboard/context';

const NAV_ITEMS = [
  { href: '/tasks/dashboard', key: 'nav.dashboard' },
  { href: '/tasks/boards', key: 'nav.boards' },
  { href: '/tasks/calendar', key: 'nav.calendar' },
  { href: '/tasks/table', key: 'nav.table' },
  { href: '/tasks/my-work', key: 'nav.myWork' },
  { href: '/tasks/templates', key: 'nav.templates' },
] as const;

/**
 * Shared sub-navigation for the FlowBoard section of Media Deck.
 * Persian-first, RTL, dark-theme tokens — native Media Deck look.
 */
export function TasksNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav
      dir="rtl"
      aria-label="مدیریت کارها"
      className="sticky top-16 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card px-3 sm:px-6"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-11 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(item.key as (typeof item)['key'])}
          </Link>
        );
      })}
    </nav>
  );
}