import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Brand CRUD Service tests.
 *
 * Tests the in-memory fallback path (no Supabase required).
 * The brand service falls back to in-memory when Supabase tables
 * are not available, which is what happens in the test environment.
 */

// Mock the dynamic import of supabase to force in-memory fallback
vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

// Import after mock — the service will detect no Supabase table and use memory
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandByName,
  getOrCreateBrand,
  getBrandNames,
  getBrandById,
} from '@/services/brand.service';

describe('getBrandById identity resolution (regression 2026-09-20)', () => {
  it('resolves a NON-UUID segment by brand name (legacy name link)', async () => {
    // Unique name — in-memory duplicates resolve to the first match.
    await createBrand({ name: 'کبریت-لینک-۹' });
    // The detail page may receive the raw NAME segment (legacy cards).
    // getBrandById must resolve it instead of 404ing/erroring.
    const found = await getBrandById('کبریت-لینک-۹');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('کبریت-لینک-۹');
  });

  it('resolves a double-encoded name segment', async () => {
    await createBrand({ name: 'سینه-فیلیا-لینک-۹' });
    const encoded = encodeURIComponent(encodeURIComponent('سینه-فیلیا-لینک-۹'));
    const found = await getBrandById(encoded);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('سینه-فیلیا-لینک-۹');
  });

  it('returns null for an unknown UUID without name fallback', async () => {
    const found = await getBrandById('00000000-0000-4000-8000-000000000000');
    expect(found).toBeNull();
  });

  it('returns null for an unknown name segment', async () => {
    const found = await getBrandById('برند-ناموجود-۹۹');
    expect(found).toBeNull();
  });
});

describe('Brand Service (in-memory)', () => {
  beforeEach(async () => {
    // Clear in-memory store by reading all and nothing — the store is module-level
    // We rely on each test creating unique names to avoid collisions
  });

  it('1. createBrand creates a brand with auto-generated id and slug', async () => {
    const brand = await createBrand({ name: 'برند آزمون' });

    expect(brand).not.toBeNull();
    expect(brand!.name).toBe('برند آزمون');
    expect(brand!.id).toMatch(/^brand-/);
    expect(brand!.slug).toBe('برند-آزمون');
    expect(brand!.status).toBe('active');
    expect(brand!.workspaceId).toBe('demo-workspace');
  });

  it('2. createBrand respects custom slug', async () => {
    const brand = await createBrand({
      name: 'Brand Test',
      slug: 'custom-slug',
    });

    expect(brand).not.toBeNull();
    expect(brand!.slug).toBe('custom-slug');
  });

  it('3. getBrands returns all brands', async () => {
    await createBrand({ name: 'لیست-۱' });
    await createBrand({ name: 'لیست-۲' });

    const brands = await getBrands();
    expect(brands.length).toBeGreaterThanOrEqual(2);

    const names = brands.map((b) => b.name);
    expect(names).toContain('لیست-۱');
    expect(names).toContain('لیست-۲');
  });

  it('4. getBrandByName finds a brand by exact name', async () => {
    await createBrand({ name: 'جستجو-تست' });

    const found = await getBrandByName('جستجو-تست');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('جستجو-تست');
  });

  it('5. getBrandByName returns null for unknown name', async () => {
    const found = await getBrandByName('برند-ناموجود-۱۲۳۴۵');
    expect(found).toBeNull();
  });

  it('6. getOrCreateBrand creates when not found', async () => {
    const brand = await getOrCreateBrand('ایجاد-خودکار');
    expect(brand).not.toBeNull();
    expect(brand!.name).toBe('ایجاد-خودکار');
  });

  it('7. getOrCreateBrand returns existing when found', async () => {
    const first = await getOrCreateBrand(' موجود-تست');
    const second = await getOrCreateBrand(' موجود-تست');
    expect(first!.id).toBe(second!.id);
  });

  it('8. updateBrand modifies name and color', async () => {
    const brand = await createBrand({ name: 'ویرایش-تست' });
    expect(brand).not.toBeNull();

    const updated = await updateBrand(brand!.id, {
      name: 'ویرایش-تست-جدید',
      color: '#FF0000',
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('ویرایش-تست-جدید');
    expect(updated!.color).toBe('#FF0000');
  });

  it('9. updateBrand returns null for unknown id', async () => {
    const result = await updateBrand('nonexistent-id', { name: 'test' });
    expect(result).toBeNull();
  });

  it('10. deleteBrand soft-deletes (sets status to inactive)', async () => {
    const brand = await createBrand({ name: 'حذف-تست' });
    expect(brand).not.toBeNull();
    expect(brand!.status).toBe('active');

    const result = await deleteBrand(brand!.id);
    expect(result).toBe(true);

    // Brand should still exist but be inactive
    const deleted = await getBrandByName('حذف-تست');
    expect(deleted).not.toBeNull();
    expect(deleted!.status).toBe('inactive');
  });

  it('11. getBrandNames returns only name strings', async () => {
    await createBrand({ name: 'نام-تست-۱' });
    await createBrand({ name: 'نام-تست-۲' });

    const names = await getBrandNames();
    expect(names).toContain('نام-تست-۱');
    expect(names).toContain('نام-تست-۲');
    // All entries should be strings
    names.forEach((n) => expect(typeof n).toBe('string'));
  });

  it('12. duplicate brand names are allowed in memory (no workspace constraint)', async () => {
    // In-memory mode doesn't enforce UNIQUE(workspace_id, name)
    const b1 = await createBrand({ name: 'تکراری' });
    const b2 = await createBrand({ name: 'تکراری' });
    expect(b1!.id).not.toBe(b2!.id);
  });

  it('13. brand name is trimmed', async () => {
    const brand = await createBrand({ name: '  فاصله  ' });
    expect(brand!.name).toBe('فاصله');
  });

  it('14. createBrand with all optional fields', async () => {
    const brand = await createBrand({
      name: 'کامل',
      slug: 'full-brand',
      status: 'inactive',
      logoUrl: 'https://example.com/logo.png',
      color: '#00FF00',
    });

    expect(brand).not.toBeNull();
    expect(brand!.name).toBe('کامل');
    expect(brand!.slug).toBe('full-brand');
    expect(brand!.status).toBe('inactive');
    expect(brand!.logoUrl).toBe('https://example.com/logo.png');
    expect(brand!.color).toBe('#00FF00');
  });

  describe('getBrandById — Persian name routes (regression: production 404 on /brands/[name])', () => {
    it('resolves a raw Persian name segment', async () => {
      const created = await createBrand({ name: 'رگرسیون-نام-فارسی' });
      expect(created).not.toBeNull();

      const found = await getBrandById('رگرسیون-نام-فارسی');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created!.id);
    });

    it('resolves a single-encoded Persian name segment (production bug: %DA%A9… reached the service)', async () => {
      const created = await createBrand({ name: 'کبریت' });
      expect(created).not.toBeNull();

      // When the client pre-encodes the segment, Next.js hands the route
      // handler a value that still contains one encoding layer; the stored
      // name is the plain Persian string. This is the exact production 404
      // (the log shows this byte sequence double-encoded: %25DA%25A9…).
      const encoded = encodeURIComponent('کبریت');

      const found = await getBrandById(encoded);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created!.id);
    });

    it('resolves a double-encoded Persian name segment (stale client bundle)', async () => {
      // Unique name — in-memory duplicates resolve to the first match.
      const created = await createBrand({ name: 'کبریت-دوم' });
      expect(created).not.toBeNull();

      const doubleEncoded = encodeURIComponent(encodeURIComponent('کبریت-دوم'));
      const found = await getBrandById(doubleEncoded);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created!.id);
    });

    it('resolves the space-containing name فصل 11 (the brand from the failure report)', async () => {
      const created = await createBrand({ name: 'فصل 11' });
      expect(created).not.toBeNull();

      const raw = await getBrandById('فصل 11');
      expect(raw).not.toBeNull();
      expect(raw!.id).toBe(created!.id);

      const encoded = await getBrandById(encodeURIComponent('فصل 11'));
      expect(encoded).not.toBeNull();
      expect(encoded!.id).toBe(created!.id);
    });

    it('still resolves by UUID and never treats a UUID as a name', async () => {
      const created = await createBrand({ name: 'یو-آیدی-تست' });
      expect(created).not.toBeNull();

      const byId = await getBrandById(created!.id);
      expect(byId).not.toBeNull();
      expect(byId!.id).toBe(created!.id);

      // A random UUID must not accidentally match any brand name.
      const missing = await getBrandById(
        '00000000-0000-4000-8000-000000000000',
      );
      expect(missing).toBeNull();
    });
  });
});
