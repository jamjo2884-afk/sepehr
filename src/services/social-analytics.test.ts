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
import { buildBrandTrends, filterAccounts } from '@/services/social-analytics';
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
