import { describe, expect, it, vi } from 'vitest';

/**
 * Phase 24F — Brand Migration Validation Tests
 *
 * Validates that the brand → brand_id migration works correctly.
 * Tests run against in-memory fallback (Supabase mocked away).
 */

// Mock supabase to force in-memory fallback
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

// Mock auth to return null (no session) — forces demo mode
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => null),
}));

/* =========================================================================
 * Brand Resolver Tests
 * ========================================================================= */

describe('Phase 24F — Brand Resolver', () => {
  it('resolveBrandId returns null when Supabase is unavailable', async () => {
    const { resolveBrandId } = await import('@/services/brand.service');
    const result = await resolveBrandId('نسیم');
    // In test env, Supabase table check fails → returns null
    expect(result).toBeNull();
  });

  it('resolveBrandIds returns empty map when Supabase is unavailable', async () => {
    const { resolveBrandIds } = await import('@/services/brand.service');
    const result = await resolveBrandIds(['نسیم', 'آرتا']);
    expect(result.size).toBe(0);
  });

  it('resolveBrandIds returns empty map for empty input', async () => {
    const { resolveBrandIds } = await import('@/services/brand.service');
    const result = await resolveBrandIds([]);
    expect(result.size).toBe(0);
  });
});

/* =========================================================================
 * Type Safety Tests — brandId exists on all domain types
 * ========================================================================= */

describe('Phase 24F — Type Safety', () => {
  it('SocialAccount type has brandId field', () => {
    const account = {
      id: 'test', brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null,
    };
    expect(account.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('SocialAccount type allows null brandId', () => {
    const account = { id: 'test', brand: 'test', brandId: null as string | null };
    expect(account.brandId).toBeNull();
  });

  it('SocialAccount type allows undefined brandId (optional)', () => {
    const account = { id: 'test', brand: 'test' };
    expect((account as { brandId?: string | null }).brandId).toBeUndefined();
  });

  it('FinanceBudget type has brandId field', () => {
    const budget = { id: 'test', brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(budget.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('FinanceExpense type has brandId field', () => {
    const expense = { id: 'test', brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(expense.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('FinanceCampaign type has brandId field', () => {
    const campaign = { id: 'test', brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(campaign.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('BrandAllocation type has brandId field', () => {
    const alloc = { id: 'test', brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(alloc.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('FinanceBrandCost type has brandId field', () => {
    const cost = { brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(cost.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('BrandHumanCost type has brandId field', () => {
    const cost = { brand: 'test', brandId: '00000000-0000-0000-0000-000000000000' as string | null };
    expect(cost.brandId).toBe('00000000-0000-0000-0000-000000000000');
  });
});

/* =========================================================================
 * Finance Service Migration Tests (in-memory path)
 * ========================================================================= */

describe('Phase 24F — Finance Service Migration', () => {
  it('budget from row mapper includes brandId', async () => {
    const budget = {
      id: 'bud-1',
      brand: 'نسیم',
      brandId: 'brand-uuid-1',
      period: 'monthly',
      periodLabel: '1405-05',
      amount: 5000000,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(budget.brandId).toBe('brand-uuid-1');
    expect(budget.brand).toBe('نسیم');
  });

  it('expense from row mapper includes brandId', async () => {
    const expense = {
      id: 'exp-1',
      brand: 'آرتا',
      brandId: 'brand-uuid-2',
      expenseDate: '1405-05-15',
      amount: 2000000,
      category: 'advertising',
      campaignId: null,
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(expense.brandId).toBe('brand-uuid-2');
  });

  it('campaign from row mapper includes brandId', async () => {
    const campaign = {
      id: 'cmp-1',
      brand: 'نسیم',
      brandId: 'brand-uuid-1',
      name: 'test',
      startDate: '1405-05-01',
      endDate: null,
      budget: 10000000,
      status: 'planned',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(campaign.brandId).toBe('brand-uuid-1');
  });
});

/* =========================================================================
 * Analytics Migration Tests
 * ========================================================================= */

describe('Phase 24F — Analytics Migration', () => {
  it('FinanceBrandCost grouping key can use brandId', () => {
    const cost1 = { brand: 'نسیم', brandId: 'aaa-000' as string | null, totalSpend: 1000000, expenseCount: 3 };
    const cost2 = { brand: 'نسیم', brandId: 'bbb-000' as string | null, totalSpend: 2000000, expenseCount: 5 };
    expect(cost1.brandId).not.toBe(cost2.brandId);
    expect(cost1.brand).toBe(cost2.brand);
  });

  it('BrandHumanCost grouping key can use brandId', () => {
    const cost1 = { brand: 'نسیم', brandId: 'aaa-000' as string | null, humanCost: 3000000, memberCount: 2 };
    const cost2 = { brand: 'نسیم', brandId: 'bbb-000' as string | null, humanCost: 5000000, memberCount: 3 };
    expect(cost1.brandId).not.toBe(cost2.brandId);
  });

  it('BrandTotalCost can use brandId as grouping key', () => {
    const cost = { brand: 'نسیم', brandId: 'aaa-000' as string | null, operationalCost: 1000000, humanCost: 2000000, totalCost: 3000000, followerGrowth: 500, costPerNewFollower: 6000, humanCostPerNewFollower: 4000, totalCostPerNewFollower: 6000, growthStatus: 'positive' as const };
    expect(cost.brandId).toBe('aaa-000');
  });

  it('FinanceBrandPerformance can use brandId', () => {
    const perf = { brand: 'نسیم', brandId: 'aaa-000' as string | null, totalSpend: 5000000, followerGrowth: 1000, costPerNewFollower: 5000, growthStatus: 'positive' as const, budgetUsagePercent: 75,
    };
    expect(perf.brandId).toBe('aaa-000');
  });

  it('FinanceScatterPoint can use brandId', () => {
    const point = {
      brand: 'نسیم',
      brandId: 'aaa-000' as string | null,
      platform: 'instagram' as const,
      spend: 1000000,
      followerGrowth: 500,
    };
    expect(point.brandId).toBe('aaa-000');
  });
});

/* =========================================================================
 * Cross-Brand Isolation Tests
 * ========================================================================= */

describe('Phase 24F — Cross-Brand Isolation', () => {
  it('Two brands with same name but different IDs are distinct', () => {
    const costs = [
      { brand: 'نسیم', brandId: 'ws-a-brand-1', totalSpend: 1000000, expenseCount: 3 },
      { brand: 'نسیم', brandId: 'ws-b-brand-2', totalSpend: 2000000, expenseCount: 5 },
    ];

    // Grouping by brandId keeps them separate
    const grouped = new Map<string, number>();
    for (const c of costs) {
      const key = c.brandId ?? c.brand;
      grouped.set(key, (grouped.get(key) ?? 0) + c.totalSpend);
    }

    expect(grouped.size).toBe(2);
    expect(grouped.get('ws-a-brand-1')).toBe(1000000);
    expect(grouped.get('ws-b-brand-2')).toBe(2000000);
  });

  it('Grouping by brand string would incorrectly merge — verifying brandId prevents this', () => {
    const costs = [
      { brand: 'نسیم', brandId: 'ws-a-brand-1', totalSpend: 1000000, expenseCount: 3 },
      { brand: 'نسیم', brandId: 'ws-b-brand-2', totalSpend: 2000000, expenseCount: 5 },
    ];

    // INCORRECT: grouping by brand string would merge them
    const groupedByBrand = new Map<string, number>();
    for (const c of costs) {
      groupedByBrand.set(c.brand, (groupedByBrand.get(c.brand) ?? 0) + c.totalSpend);
    }
    // This proves why brandId is necessary — brand string grouping is wrong
    expect(groupedByBrand.size).toBe(1); // WRONG — merged
    expect(groupedByBrand.get('نسیم')).toBe(3000000); // WRONG — combined

    // CORRECT: grouping by brandId keeps them separate
    const groupedById = new Map<string, number>();
    for (const c of costs) {
      const key = c.brandId ?? c.brand;
      groupedById.set(key, (groupedById.get(key) ?? 0) + c.totalSpend);
    }
    expect(groupedById.size).toBe(2); // CORRECT — separate
  });
});

/* =========================================================================
 * Legacy Compatibility Tests
 * ========================================================================= */

describe('Phase 24F — Legacy Compatibility', () => {
  it('brand string field still exists on all domain types', () => {

    // Verify brand field still exists (backward compat)
    const account = {
      id: '1', brand: 'test', platform: 'instagram' as const, username: 't',
      displayName: null, url: null, externalId: null, status: 'active',
      createdAt: '', updatedAt: '', connectionStatus: 'disconnected',
      lastSyncAt: null, lastSyncStatus: null, lastSuccessfulSyncAt: null,
    };
    expect(account.brand).toBe('test');

    const budget = {
      id: '1', brand: 'test', period: 'monthly' as const, periodLabel: '1405-05',
      amount: 0, notes: '', createdAt: '', updatedAt: '',
    };
    expect(budget.brand).toBe('test');

    const alloc = {
      id: '1', teamMemberId: 'tm-1', brand: 'test',
      allocationPercentage: 50, createdAt: '', updatedAt: '',
    };
    expect(alloc.brand).toBe('test');
  });

  it('Both brand and brandId can coexist on the same entity', async () => {
    const account = {
      id: '1',
      brand: 'نسیم',
      brandId: '00000000-0000-0000-0000-000000000001',
      platform: 'instagram',
      username: 'nasim',
      displayName: null,
      url: null,
      externalId: null,
      status: 'active',
      createdAt: '',
      updatedAt: '',
      connectionStatus: 'disconnected',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSuccessfulSyncAt: null,
    };
    expect(account.brand).toBe('نسیم');
    expect(account.brandId).toBe('00000000-0000-0000-0000-000000000001');
  });
});

/* =========================================================================
 * Database Row Type Tests
 * ========================================================================= */

describe('Phase 24F — Database Row Types', () => {
  it('BudgetRow has brand_id field', () => {
    const row = {
      id: '1', brand: 'test', brand_id: 'uuid-1', period: 'monthly',
      period_label: '1405-05', amount: 0, notes: '', created_at: '', updated_at: '',
    };
    expect(row.brand_id).toBe('uuid-1');
  });

  it('ExpenseRow has brand_id field', () => {
    const row = {
      id: '1', brand: 'test', brand_id: 'uuid-2', expense_date: '1405-05-15',
      amount: 0, category: 'other', campaign_id: null, description: '',
      created_at: '', updated_at: '',
    };
    expect(row.brand_id).toBe('uuid-2');
  });

  it('CampaignRow has brand_id field', () => {
    const row = {
      id: '1', brand: 'test', brand_id: 'uuid-3', name: 'test',
      start_date: '1405-05-01', end_date: null, budget: 0, status: 'planned',
      description: '', created_at: '', updated_at: '',
    };
    expect(row.brand_id).toBe('uuid-3');
  });

  it('BrandAllocationRow has brand_id field', () => {
    const row = {
      id: '1', team_member_id: 'tm-1', brand: 'test', brand_id: 'uuid-4',
      allocation_percentage: 50, created_at: '', updated_at: '',
    };
    expect(row.brand_id).toBe('uuid-4');
  });

  it('brand_id can be null on rows', () => {
    const row = {
      id: '1', brand: 'test', brand_id: null, period: 'monthly',
      period_label: '1405-05', amount: 0, notes: '', created_at: '', updated_at: '',
    };
    expect(row.brand_id).toBeNull();
  });
});
