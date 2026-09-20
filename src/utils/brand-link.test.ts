import { describe, expect, it } from 'vitest';
import { brandDetailHref } from '@/utils/brand-link';

/**
 * Regression tests for the brand detail link (2026-09-20).
 *
 * Cards whose social accounts were never backfilled (brand_id NULL — e.g.
 * «کبریت», «سینه فیلیا», «دیده بان دولت», «صد درجه», «فصل 11», «کف خیابون»,
 * «مردمک», «نسیم آنلاین» in production) used to link /brands/<name>, which
 * the UUID-based detail APIs cannot serve. Every resolvable brand must link
 * by its brands-table UUID; the name fallback stays only for social-only
 * brands without any brands row.
 */
describe('brandDetailHref', () => {
  it('links by UUID when the brand row is resolvable (کبریت case)', () => {
    const href = brandDetailHref(
      'کبریت',
      'eef31f2e-9e3b-4abd-a233-fbdfef0b7692',
    );
    expect(href).toBe('/brands/eef31f2e-9e3b-4abd-a233-fbdfef0b7692');
  });

  it('prefers the RLS-scoped map id over the account-derived one', () => {
    const href = brandDetailHref(
      'نود اقتصادی',
      '67d690c3-0e6d-4d34-bab1-0ad9339ddd13',
    );
    expect(href).toBe('/brands/67d690c3-0e6d-4d34-bab1-0ad9339ddd13');
  });

  it('falls back to the encoded name for social-only brands (no brands row)', () => {
    expect(brandDetailHref('برند اجتماعی تنها', null)).toBe(
      `/brands/${encodeURIComponent('برند اجتماعی تنها')}`,
    );
    expect(brandDetailHref('برند اجتماعی تنها')).toBe(
      `/brands/${encodeURIComponent('برند اجتماعی تنها')}`,
    );
  });

  it('never leaks an unencoded Persian name into the URL', () => {
    const href = brandDetailHref('سینه فیلیا', null);
    expect(href).not.toContain('سینه');
    expect(href).toMatch(/^\/brands\/[A-Za-z0-9%._~-]+$/);
  });
});
