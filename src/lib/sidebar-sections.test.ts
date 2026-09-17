import { describe, expect, it } from 'vitest';
import {
  EXTRA_SECTION_IDS,
  EXTRA_SECTIONS_STORAGE_KEY,
  getVisibleNavItems,
  isActivePath,
  isExtraSection,
} from '@/lib/sidebar-sections';
import { navItems } from '@/config/navigation.config';

/**
 * Sidebar extra-sections regression tests.
 *
 * Feature 1: a single toggle hides/shows exactly ten secondary nav
 * sections. Core nav items must never be filtered out.
 */

const ALWAYS_VISIBLE_IDS = [
  'command-center',
  'tasks',
  'brands',
  'social',
  'finance',
  'settings',
];

describe('sidebar extra sections', () => {
  it('declares exactly the ten agreed extra-section ids', () => {
    expect(EXTRA_SECTION_IDS).toEqual([
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
    ]);
  });

  it('uses the agreed localStorage key', () => {
    expect(EXTRA_SECTIONS_STORAGE_KEY).toBe('sidebar-extra-sections-visible');
  });

  it('hides the ten extra sections by default (showExtra = false)', () => {
    const visible = getVisibleNavItems(false);
    const visibleIds = visible.map((item) => item.id);

    for (const id of EXTRA_SECTION_IDS) {
      expect(visibleIds).not.toContain(id);
    }
  });

  it('shows every nav item when the toggle is on (showExtra = true)', () => {
    const visible = getVisibleNavItems(true);

    expect(visible).toEqual(navItems);
  });

  it('keeps all non-extra nav items visible regardless of the toggle', () => {
    for (const showExtra of [false, true]) {
      const visibleIds = getVisibleNavItems(showExtra).map((item) => item.id);

      for (const id of ALWAYS_VISIBLE_IDS) {
        expect(visibleIds).toContain(id);
      }
    }
  });

  it('preserves the nav config order in both toggle states', () => {
    const allIds = navItems.map((item) => item.id);

    expect(getVisibleNavItems(false).map((item) => item.id)).toEqual(
      allIds.filter((id) => !isExtraSection(id)),
    );
    expect(getVisibleNavItems(true).map((item) => item.id)).toEqual(allIds);
  });

  it('classifies ids with isExtraSection', () => {
    expect(isExtraSection('content')).toBe(true);
    expect(isExtraSection('assets')).toBe(true);
    expect(isExtraSection('campaigns')).toBe(true);
    expect(isExtraSection('distribution')).toBe(true);
    expect(isExtraSection('notifications')).toBe(true);
    expect(isExtraSection('social')).toBe(false);
    expect(isExtraSection('settings')).toBe(false);
    expect(isExtraSection('nonexistent')).toBe(false);
  });

  it('every extra-section id exists in the nav config', () => {
    const navIds = new Set(navItems.map((item) => item.id));

    for (const id of EXTRA_SECTION_IDS) {
      expect(navIds.has(id)).toBe(true);
    }
  });

  describe('isActivePath', () => {
    it('matches the section root itself', () => {
      expect(isActivePath('/analytics', '/analytics')).toBe(true);
    });

    it('matches nested routes under the section', () => {
      expect(isActivePath('/analytics/reports', '/analytics')).toBe(true);
      expect(isActivePath('/campaigns/123/details', '/campaigns')).toBe(true);
    });

    it('does not match unrelated prefixes or other sections', () => {
      expect(isActivePath('/analytics-extra', '/analytics')).toBe(false);
      expect(isActivePath('/finance', '/analytics')).toBe(false);
    });

    it('treats a missing pathname as never active', () => {
      expect(isActivePath(undefined, '/analytics')).toBe(false);
      expect(isActivePath(null, '/analytics')).toBe(false);
      expect(isActivePath('', '/analytics')).toBe(false);
    });
  });

  describe('active extra-section pinning', () => {
    it('keeps the current page visible when its section is hidden', () => {
      const visible = getVisibleNavItems(false, '/analytics/reports');
      const visibleIds = visible.map((item) => item.id);

      expect(visibleIds).toContain('analytics');
      // The other extra sections stay hidden.
      expect(visibleIds).not.toContain('campaigns');
      expect(visibleIds).not.toContain('automation');
    });

    it('does not reveal extra sections when the path matches nothing', () => {
      const visible = getVisibleNavItems(false, '/tasks');
      const visibleIds = visible.map((item) => item.id);

      for (const id of EXTRA_SECTION_IDS) {
        expect(visibleIds).not.toContain(id);
      }
    });

    it('pins only the exact section, not prefix lookalikes', () => {
      const visible = getVisibleNavItems(false, '/analytics-extra');
      const visibleIds = visible.map((item) => item.id);

      expect(visibleIds).not.toContain('analytics');
    });
  });
});
