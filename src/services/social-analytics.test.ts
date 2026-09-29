/**
 * Regression tests for the brand identity fix (2026-09-20).
 *
 * After migration 20260916120000 backfilled `brand_id` on every
 * social_accounts row, the legacy UUID-first key (`brandId ?? brand`)
 * stopped matching the NAME-based selections the UI sends: selecting a
 * brand zeroed every KPI, trend series, stat row and score. These tests
 * pin the name-first identity (`brand || brandId`) plus the tolerant
 * matcher in filterAccounts (selection by name OR id must both work).
 */
import { describe, expect, it } from 'vitest';
import {
  buildBrandTrends,
  comparisonCoverage,
  comparisonMonthRange,
  filterAccounts,
  hasComparisonData,
} from '@/services/social-analytics';
import { rankBrandsByScore } from '@/services/social-score';
import type { SocialAccount, SocialMetric } from '@/types/social';

const NOD_ID = '67d690c3-0e6d-4d34-bab1-0ad9339ddd13';
const NOD_NAME = 'نود اقتصادی';
const ROSH_NAME = 'روشنگری';
const ROSH_ID = '11111111-2222-3333-4444-555555555555';

function makeAccount(
  overrides: Partial<SocialAccount> & { id: string },
): SocialAccount {
  return {
    brand: NOD_NAME,
    brandId: NOD_ID,
    platform: 'instagram',
    username: 'nod',
    displayName: 'نود',
    url: null,
    externalId: null,
    status: 'active',
    connectionStatus: 'connected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function makeMetric(
  overrides: Partial<SocialMetric> & { id: string; accountId: string },
): SocialMetric {
  return {
    period: 'monthly',
    periodLabel: '1404-05',
    periodStart: '1404-05-01',
    periodEnd: '1404-05-30',
    followers: 1000,
    following: 100,
    posts: 10,
    views: 5000,
    likes: 400,
    comments: 40,
    shares: 20,
    saves: 5,
    reach: 3000,
    impressions: 4500,
    engagementRate: 2,
    storyViews: null,
    channelMembers: null,
    retweets: null,
    subscribers: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

// Both identity fields populated — the exact production shape after the
// brand_id backfill (verified in the DB: 52/52 accounts have brand_id set).
const accounts: SocialAccount[] = [
  makeAccount({ id: 'nod-1', username: 'nod_1' }),
  makeAccount({ id: 'nod-2', username: 'nod_2' }),
  makeAccount({ id: 'rosh-1', brand: ROSH_NAME, brandId: ROSH_ID }),
  // Legacy row with NO brand_id — name-only matching must keep working.
  makeAccount({ id: 'legacy-1', brand: ROSH_NAME, brandId: null }),
];

const metrics: SocialMetric[] = [
  makeMetric({ id: 'm-1', accountId: 'nod-1' }),
  makeMetric({ id: 'm-2', accountId: 'nod-2' }),
  makeMetric({ id: 'm-3', accountId: 'rosh-1' }),
  makeMetric({ id: 'm-4', accountId: 'legacy-1' }),
];

const range = { start: '1404-01', end: '1404-12' };

describe('brand identity: name-first matching after brand_id backfill', () => {
  it('filterAccounts matches accounts by brand NAME even when brandId is set', () => {
    const filtered = filterAccounts(accounts, [NOD_NAME], []);
    expect(filtered.map((a) => a.id)).toEqual(['nod-1', 'nod-2']);
  });

  it('filterAccounts matches by brandId as well (tolerant matcher)', () => {
    const filtered = filterAccounts(accounts, [NOD_ID], []);
    expect(filtered.map((a) => a.id)).toEqual(['nod-1', 'nod-2']);
  });

  it('filterAccounts keeps matching legacy name-only rows (brandId null)', () => {
    const filtered = filterAccounts(accounts, [ROSH_NAME], []);
    expect(filtered.map((a) => a.id)).toEqual(['rosh-1', 'legacy-1']);
  });

  it('buildBrandTrends keys series by brand NAME so page lookups match', () => {
    const trends = buildBrandTrends(accounts, metrics, range);
    const nod = trends.find((t) => t.brand === NOD_NAME);
    expect(nod).toBeDefined();
    expect(nod?.points.at(0)?.followers).toBe(2000); // nod-1 + nod-2
    // No series may be keyed by the raw UUID anymore.
    expect(trends.some((t) => t.brand === NOD_ID)).toBe(false);
  });

  it('rankBrandsByScore attaches real metrics to name-keyed brand rows', () => {
    const rows = rankBrandsByScore(accounts, metrics);
    const nod = rows.find((r) => r.brand === NOD_NAME);
    expect(nod).toBeDefined();
    expect(nod?.followers).toBe(2000); // metrics actually matched
    expect(nod?.score).not.toBeNull();
  });
});

describe('comparisonMonthRange (مبنای مقایسه‌ی KPI)', () => {
  it('previous-month basis: exactly the single month before range.end', () => {
    expect(
      comparisonMonthRange({ start: '1404-01', end: '1404-12' }, 'previous-month'),
    ).toEqual({ start: '1404-11', end: '1404-11' });
  });

  it('previous-month basis rolls across the Jalali year boundary', () => {
    expect(
      comparisonMonthRange({ start: '1404-01', end: '1404-01' }, 'previous-month'),
    ).toEqual({ start: '1403-12', end: '1403-12' });
  });

  it('previous-month basis on a 24-month window is ONE month, not 24', () => {
    // The whole point: a 24m range must not compare against another empty
    // 24-month window.
    const range = { start: '1403-05', end: '1405-04' };
    const prev = comparisonMonthRange(range, 'previous-month');
    expect(prev).toEqual({ start: '1405-03', end: '1405-03' });
  });

  it('previous-length basis: window of the same length right before', () => {
    expect(
      comparisonMonthRange({ start: '1404-01', end: '1404-03' }, 'previous-length'),
    ).toEqual({ start: '1403-10', end: '1403-12' });
  });

  it('same-month-last-year basis: shifts the whole range back 12 months', () => {
    expect(
      comparisonMonthRange({ start: '1404-01', end: '1404-03' }, 'same-month-last-year'),
    ).toEqual({ start: '1403-01', end: '1403-03' });
  });

  it('same-month-last-year basis rolls back across the year boundary', () => {
    expect(
      comparisonMonthRange({ start: '1404-02', end: '1404-04' }, 'same-month-last-year'),
    ).toEqual({ start: '1403-02', end: '1403-04' });
  });
});

describe('hasComparisonData (شرط «داده‌ی مقایسه موجود نیست»)', () => {
  it('is false when the comparison window has no metrics at all', () => {
    const emptyWindow = { start: '1400-01', end: '1400-02' };
    expect(hasComparisonData(metrics, emptyWindow)).toBe(false);
  });

  it('is true when any account has a metric in the window', () => {
    expect(hasComparisonData(metrics, { start: '1404-05', end: '1404-05' })).toBe(true);
  });

  it('respects the account filter: data for OTHER accounts does not count', () => {
    const onlyNod = new Set(['nod-1', 'nod-2']);
    const metricsOnlyRosh = metrics.filter((m) => m.accountId === 'rosh-1');
    expect(
      hasComparisonData(metricsOnlyRosh, { start: '1404-05', end: '1404-05' }, onlyNod),
    ).toBe(false);
    expect(
      hasComparisonData(metrics, { start: '1404-05', end: '1404-05' }, onlyNod),
    ).toBe(true);
  });

  it('an empty account filter (all accounts) counts every row', () => {
    expect(
      hasComparisonData(metrics, { start: '1404-05', end: '1404-05' }, undefined),
    ).toBe(true);
  });
});

describe('comparisonCoverage (پوشش بازه‌ی مبنا برای هشدار «داده‌ی ناقص»)', () => {
  it('counts every month of the basis window as covered when data exists in all of them', () => {
    // Fixture metrics all live in 1404-05; window of exactly that month.
    expect(
      comparisonCoverage(metrics, { start: '1404-05', end: '1404-05' }),
    ).toEqual({ covered: 1, total: 1 });
  });

  it('is partial when the basis window reaches back before the first import', () => {
    // Data only in 1404-05; the 3-month window keeps 2 empty months.
    expect(
      comparisonCoverage(metrics, { start: '1404-03', end: '1404-05' }),
    ).toEqual({ covered: 1, total: 3 });
  });

  it('multiple rows inside one month count once — coverage is about months, not rows', () => {
    expect(
      comparisonCoverage(metrics, { start: '1404-04', end: '1404-05' }),
    ).toEqual({ covered: 1, total: 2 });
  });

  it('respects the account filter: months only covered by OTHER accounts do not count', () => {
    const onlyNod = new Set(['nod-1', 'nod-2']);
    const metricsOnlyRosh = metrics.filter((m) => m.accountId === 'rosh-1');
    expect(
      comparisonCoverage(metricsOnlyRosh, { start: '1404-05', end: '1404-05' }, onlyNod),
    ).toEqual({ covered: 0, total: 1 });
    expect(
      comparisonCoverage(metrics, { start: '1404-05', end: '1404-05' }, onlyNod),
    ).toEqual({ covered: 1, total: 1 });
  });

  it('handles the year boundary of the same-month-last-year basis', () => {
    // Data in 1404-05 → shifted window 1403-05..1404-04 is fully empty.
    expect(
      comparisonCoverage(metrics, { start: '1403-05', end: '1404-04' }),
    ).toEqual({ covered: 0, total: 12 });
  });

  it('is covered for a single month even across the Jalali year end', () => {
    const decMetric = makeMetric({ id: 'm-esfand', accountId: 'nod-1', periodLabel: '1403-12' });
    expect(
      comparisonCoverage([decMetric], { start: '1403-12', end: '1403-12' }),
    ).toEqual({ covered: 1, total: 1 });
  });
});
