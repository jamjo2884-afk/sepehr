import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Brand Performance Service tests (in-memory path).
 *
 * Verifies the brand join (social + finance + content) uses real module
 * data with honest zeros for empty sources and never leaks across brands.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('@/services/social.service', () => ({
  getSocialAccounts: vi.fn(async () => [
    {
      id: 'acc-1',
      brand: 'ازما',
      brandId: 'b1',
      platform: 'instagram',
      username: 'azma',
      displayName: null,
      url: null,
      externalId: null,
      status: 'active',
      connectionStatus: 'disconnected',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSuccessfulSyncAt: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'acc-2',
      brand: 'نسیم',
      brandId: 'b2',
      platform: 'telegram',
      username: 'nasim',
      displayName: null,
      url: null,
      externalId: null,
      status: 'active',
      connectionStatus: 'disconnected',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSuccessfulSyncAt: null,
      createdAt: '',
      updatedAt: '',
    },
  ]),
  getBrandMetrics: vi.fn(async (brand: string) =>
    brand === 'b1'
      ? [
          {
            id: 'm1',
            accountId: 'acc-1',
            period: 'monthly' as const,
            periodLabel: 'مرداد ۱۴۰۵',
            periodStart: null,
            periodEnd: null,
            followers: 120_000,
            views: 450_000,
            likes: 12_000,
            comments: 800,
            following: null,
            posts: null,
            shares: null,
            saves: null,
            reach: null,
            impressions: null,
            engagementRate: null,
            storyViews: null,
            channelMembers: null,
            retweets: null,
            subscribers: null,
            createdAt: '',
            updatedAt: '',
          },
        ]
      : [],
  ),
  latestMetricsByAccount: vi.fn((metrics: Array<{ accountId: string }>) => {
    const map = new Map<string, (typeof metrics)[number]>();
    for (const m of metrics) map.set(m.accountId, m);
    return map;
  }),
}));

vi.mock('@/services/finance/finance.service', () => ({
  getBudgets: vi.fn(async (brandId?: string) =>
    brandId === 'b1'
      ? [{ id: 'bud1', brand: 'ازما', brandId: 'b1', period: 'monthly' as const, periodLabel: 'مرداد ۱۴۰۵', amount: 100, notes: '', createdAt: '', updatedAt: '' }]
      : [],
  ),
  getExpenses: vi.fn(async (brandId?: string) =>
    brandId === 'b1'
      ? [{ id: 'exp1', brand: 'ازما', brandId: 'b1', expenseDate: '2026-08-15', amount: 30, category: 'ads' as const, campaignId: null, description: '', createdAt: '', updatedAt: '' }]
      : [],
  ),
}));

import { getBrandPerformance } from '@/services/brand-performance.service';
import { createContent } from '@/services/content.service';

const WS = 'ws-perf';

describe('getBrandPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. joins social + finance + content for the brand with real values', async () => {
    const perf = await getBrandPerformance('b1', WS);
    expect(perf).not.toBeNull();
    expect(perf!.social.accountCount).toBe(1);
    expect(perf!.social.totalFollowers).toBe(120_000);
    expect(perf!.social.latestViews).toBe(450_000);
    expect(perf!.finance.totalBudget).toBe(100);
    expect(perf!.finance.totalSpent).toBe(30);
    expect(perf!.finance.remainingBudget).toBe(70);
    expect(perf!.finance.budgetUsagePercent).toBeCloseTo(30, 5);
    expect(perf!.content.total).toBe(0);
    expect(perf!.content.byStatus.draft).toBe(0);
  });

  it('2. includes the brand contents in the pipeline counts', async () => {
    await createContent({ title: 'محتوای برند', brandId: 'b1' }, WS, 'u1');

    const perf = await getBrandPerformance('b1', WS);
    expect(perf!.content.total).toBe(1);
    expect(perf!.content.byStatus.draft).toBe(1);
  });

  it('3. other-brand contents never leak into this brand', async () => {
    await createContent({ title: 'محتوای برند دیگر', brandId: 'b2' }, WS, 'u1');

    const perf = await getBrandPerformance('b1', WS);
    expect(perf!.content.total).toBe(0);
  });

  it('4. a brand with no data anywhere yields honest zeros', async () => {
    const perf = await getBrandPerformance('b-empty', WS);
    expect(perf).not.toBeNull();
    expect(perf!.social.accountCount).toBe(0);
    expect(perf!.social.totalFollowers).toBe(0);
    expect(perf!.finance.totalBudget).toBe(0);
    expect(perf!.finance.totalSpent).toBe(0);
    expect(perf!.content.total).toBe(0);
  });
});
