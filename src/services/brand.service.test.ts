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
} from '@/services/brand.service';

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
});
