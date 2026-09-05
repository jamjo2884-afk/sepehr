import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Tests for src/lib/db.ts — tests-as-contract.
 *
 * Verifies:
 * 1. getSupabase() returns the Supabase client
 * 2. isTableAvailable() caches per-table results
 * 3. isTableAvailable() returns true when table exists
 * 4. isTableAvailable() returns false on PGRST205
 * 5. isTableAvailable() returns false on network error
 * 6. resetTableCache() clears cache for re-probing
 */

// ── Mock: @/lib/supabase ──────────────────────────────────────────────────
// Use Proxy so the vi.mock factory doesn't need to reference hoisted variables.

const mockLimit = vi.fn();
const mockSelect = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'from') return mockFrom;
        return undefined;
      },
    },
  ),
}));

// ── Import under test ──────────────────────────────────────────────────────

import { getSupabase, isTableAvailable, resetTableCache } from '@/lib/db';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('db.ts — getSupabase()', () => {
  beforeEach(() => {
    resetTableCache();
    vi.clearAllMocks();
  });

  it('returns a client with from() method', async () => {
    const client = await getSupabase();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('returns the same instance on repeated calls', async () => {
    const a = await getSupabase();
    const b = await getSupabase();
    expect(a).toBe(b);
  });
});

describe('db.ts — isTableAvailable()', () => {
  beforeEach(() => {
    resetTableCache();
    vi.clearAllMocks();
  });

  it('returns true when table exists (no error)', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });

    const result = await isTableAvailable('brands');
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('brands');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('returns false when table does not exist (PGRST205)', async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: 'relation does not exist' },
    });

    expect(await isTableAvailable('missing_table')).toBe(false);
  });

  it('returns true for non-PGRST205 errors (table exists, other issue)', async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'permission denied' },
    });

    expect(await isTableAvailable('brands')).toBe(true);
  });

  it('returns false on network/throw error', async () => {
    mockLimit.mockRejectedValue(new Error('fetch failed'));
    expect(await isTableAvailable('brands')).toBe(false);
  });

  it('caches — does not re-probe same table', async () => {
    mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });

    await isTableAvailable('brands');
    await isTableAvailable('brands');

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('caches independently per table name', async () => {
    mockLimit
      .mockResolvedValueOnce({ data: [{ id: '1' }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST205', message: 'not found' },
      });

    expect(await isTableAvailable('brands')).toBe(true);
    expect(await isTableAvailable('finance_budgets')).toBe(false);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('caches false — second probe for missing table also returns false', async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: 'not found' },
    });

    expect(await isTableAvailable('missing')).toBe(false);
    expect(await isTableAvailable('missing')).toBe(false);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('resetTableCache clears cache for re-probing', async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: 'not found' },
    });
    expect(await isTableAvailable('brands')).toBe(false);

    resetTableCache();

    mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null });
    expect(await isTableAvailable('brands')).toBe(true);
  });
});
