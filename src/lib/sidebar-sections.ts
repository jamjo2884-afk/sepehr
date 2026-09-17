import { navItems } from '@/config/navigation.config';

/**
 * Sidebar "extra sections" visibility.
 *
 * The nav list is split into a compact set of daily-use items (always
 * visible) and ten secondary sections that can be hidden or shown with
 * a single toggle. The hidden-by-default behavior is intentional: the
 * first load without a stored preference shows only the core nav.
 */

export const EXTRA_SECTION_IDS = [
  'content',
  'assets',
  'campaigns',
  'distribution',
  'audience',
  'analytics',
  'intelligence',
  'automation',
  'knowledge',
  'notifications',
] as const;

export type ExtraSectionId = (typeof EXTRA_SECTION_IDS)[number];

export const EXTRA_SECTIONS_STORAGE_KEY = 'sidebar-extra-sections-visible';

export function isExtraSection(id: string): id is ExtraSectionId {
  return (EXTRA_SECTION_IDS as readonly string[]).includes(id);
}

/**
 * Whether `pathname` points at `href` itself or at a nested route under
 * it. Shared by the sidebar so the active styling and the "keep the
 * active page visible" logic can never disagree.
 */
export function isActivePath(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Returns the nav items that should currently render.
 * `showExtra === false` (the default) hides exactly the ten extra
 * sections; every other nav item is always visible regardless.
 *
 * Exception: when the current page belongs to a hidden extra section,
 * that one section stays visible so the page the user is on never
 * disappears from the navigation (collapsed rail and mobile drawer
 * included).
 */
export function getVisibleNavItems(
  showExtra: boolean,
  pathname?: string | null,
) {
  return navItems.filter(
    (item) => showExtra || !isExtraSection(item.id) || isActivePath(pathname, item.href),
  );
}
