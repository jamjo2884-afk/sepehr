import { describe, expect, it, vi } from 'vitest';

/**
 * Brand Status service tests.
 *
 * Covers the pure social snapshot builder (no I/O) and the in-memory
 * profile CRUD fallback (no Supabase in the test environment).
 *
 * Network isolation (same pattern as command-center.service.test.ts):
 * the service reaches Supabase through the db.ts wrapper; with the real
 * placeholder client some fetches hang instead of failing fast, tripping
 * the per-test timeout. Mocking db.ts forces the in-memory fallback path.
 */

vi.mock('@/lib/db', () => ({
  getSupabase: vi.fn(async () => ({})),
  isTableAvailable: vi.fn(async () => false),
}));

import {
  buildBrandSocialStatus,
  getBrandStatusProfile,
  upsertBrandStatusProfile,
} from '@/services/brand-status.service';
import type { SocialAccount, SocialMetric } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';

function makeAccount(
  id: string,
  platform: SocialPlatform,
  overrides: Partial<SocialAccount> = {},
): SocialAccount {
  const now = new Date().toISOString();
  return {
    id,
    brand: 'برند آزمون',
    brandId: 'brand-1',
    platform,
    username: `handle_${id}`,
    displayName: null,
    url: null,
    externalId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    connectionStatus: 'connected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    ...overrides,
  };
}

function makeMetric(
  id: string,
  accountId: string,
  periodLabel: string,
  followers: number,
  overrides: Partial<SocialMetric> = {},
): SocialMetric {
  const now = new Date().toISOString();
  return {
    id,
    accountId,
    period: 'monthly',
    periodLabel,
    periodStart: null,
    periodEnd: null,
    followers,
    following: null,
    posts: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    impressions: null,
    engagementRate: null,
    storyViews: null,
    channelMembers: null,
    retweets: null,
    subscribers: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('buildBrandSocialStatus', () => {
  it('reports ok with the latest metric audience per platform', () => {
    const ig = makeAccount('a1', 'instagram');
    const tg = makeAccount('a2', 'telegram');
    const metrics = [
      makeMetric('m1', 'a1', '1404-06', 10000),
      makeMetric('m2', 'a1', '1404-07', 12450),
      makeMetric('m3', 'a2', '1404-07', 8320),
    ];

    const { socialPlatforms, socialSummary } = buildBrandSocialStatus(
      [ig, tg],
      metrics,
    );

    expect(socialPlatforms).toHaveLength(2);
    const igRow = socialPlatforms.find((r) => r.platform === 'instagram')!;
    expect(igRow.availability).toBe('ok');
    expect(igRow.audience).toBe(12450);
    expect(igRow.latestPeriodLabel).toBe('1404-07');

    const tgRow = socialPlatforms.find((r) => r.platform === 'telegram')!;
    expect(tgRow.availability).toBe('ok');
    expect(tgRow.audience).toBe(8320);

    expect(socialSummary.totalAudience).toBe(12450 + 8320);
    expect(socialSummary.activePlatformCount).toBe(2);
    expect(socialSummary.incompleteCount).toBe(0);
    expect(socialSummary.latestUpdateAt).not.toBeNull();
  });

  it('marks connected accounts without metrics as no-metrics (never a fake number)', () => {
    const yt = makeAccount('a1', 'youtube');

    const { socialPlatforms, socialSummary } = buildBrandSocialStatus([yt], []);

    expect(socialPlatforms).toHaveLength(1);
    expect(socialPlatforms[0].availability).toBe('no-metrics');
    expect(socialPlatforms[0].audience).toBeNull();
    expect(socialSummary.totalAudience).toBe(0);
    expect(socialSummary.incompleteCount).toBe(1);
    expect(socialSummary.latestUpdateAt).toBeNull();
  });

  it('uses channelMembers as fallback audience when followers is 0', () => {
    const tg = makeAccount('a1', 'telegram');
    const metrics = [makeMetric('m1', 'a1', '1404-07', 0, { channelMembers: 5400 })];

    const { socialPlatforms } = buildBrandSocialStatus([tg], metrics);
    expect(socialPlatforms[0].audience).toBe(5400);
  });

  it('sums multiple accounts of the same platform by picking the newest metric', () => {
    const igA = makeAccount('a1', 'instagram');
    const igB = makeAccount('a2', 'instagram', { username: 'other' });
    const metrics = [
      makeMetric('m1', 'a1', '1404-06', 1000),
      makeMetric('m2', 'a2', '1404-07', 2000),
    ];

    const { socialPlatforms, socialSummary } = buildBrandSocialStatus(
      [igA, igB],
      metrics,
    );

    expect(socialPlatforms).toHaveLength(1);
    expect(socialSummary.totalAudience).toBe(2000); // newest wins, no double counting
  });

  it('does not fabricate platforms that have no accounts', () => {
    const { socialPlatforms } = buildBrandSocialStatus([], []);
    expect(socialPlatforms).toHaveLength(0);
  });
});

describe('brand status profile (in-memory fallback)', () => {
  it('returns null when no profile exists', async () => {
    const p = await getBrandStatusProfile('brand-nonexistent');
    expect(p).toBeNull();
  });

  it('upsert creates then updates the same profile', async () => {
    const brandId = `brand-mem-${Date.now()}`;
    const created = await upsertBrandStatusProfile(brandId, 'ws-1', {
      brandDefinition: 'تعریف اولیه',
      topNeed: 'نیروی تولید محتوا',
    });
    expect(created).not.toBeNull();
    expect(created!.brandId).toBe(brandId);
    expect(created!.brandDefinition).toBe('تعریف اولیه');

    const updated = await upsertBrandStatusProfile(brandId, 'ws-1', {
      topNeed: 'کمپین تبلیغاتی',
    });
    expect(updated!.id).toBe(created!.id);
    expect(updated!.topNeed).toBe('کمپین تبلیغاتی');
    // Untouched field stays intact.
    expect(updated!.brandDefinition).toBe('تعریف اولیه');

    const fetched = await getBrandStatusProfile(brandId);
    expect(fetched!.topNeed).toBe('کمپین تبلیغاتی');
  });

  it('upsert with an empty patch is a no-op read', async () => {
    const brandId = `brand-mem2-${Date.now()}`;
    const created = await upsertBrandStatusProfile(brandId, 'ws-1', {
      brandMission: 'مأموریت',
    });
    const again = await upsertBrandStatusProfile(brandId, 'ws-1', {});
    expect(again!.id).toBe(created!.id);
    expect(again!.brandMission).toBe('مأموریت');
  });
});
