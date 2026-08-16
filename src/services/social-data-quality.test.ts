import { describe, expect, it, vi } from 'vitest';
import {
  analyzeSocialDataQuality,
  getSocialDataQuality,
  SOCIAL_DATA_QUALITY_SEVERITY_LABELS,
} from '@/services/social-data-quality.service';
import { periodLabelForDate } from '@/services/social-metrics';
import type {
  SocialAccount,
  SocialMetric,
  SocialDataQualityReport,
} from '@/types/social';

/**
 * Data-quality analyzer tests.
 *
 * The analyzer is pure: `now` is injected, so every case is deterministic.
 * Timezone note: labels are always produced with the same utilities the
 * app itself uses (periodLabelForDate), so expectations hold in any
 * timezone the suite runs in.
 */

const NOW = new Date('2026-08-16T10:00:00.000Z');

const currentMonthly = periodLabelForDate(NOW, 'monthly');
/** A monthly label ~4 months before NOW (always > 60 days old). */
const staleMonthly = periodLabelForDate(
  new Date(NOW.getTime() - 120 * 86_400_000),
  'monthly',
);
/** A monthly label ~40 days after NOW (always in a future month). */
const futureMonthly = periodLabelForDate(
  new Date(NOW.getTime() + 40 * 86_400_000),
  'monthly',
);

let seq = 0;

function makeAccount(
  id: string,
  overrides: Partial<SocialAccount> = {},
): SocialAccount {
  return {
    id,
    brand: 'برند آزمون',
    platform: 'instagram',
    username: `user-${id}`,
    displayName: null,
    url: null,
    externalId: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMetric(
  accountId: string,
  overrides: Partial<SocialMetric> = {},
): SocialMetric {
  seq += 1;
  return {
    id: String(seq),
    accountId,
    period: 'monthly',
    periodLabel: currentMonthly,
    // Legacy-imported rows have no period_start/end; sorting falls back to
    // the label, which is what the temporal rules rely on.
    periodStart: null,
    periodEnd: null,
    followers: 100,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** An Instagram account that records its platform-specific field → healthy. */
function healthyInstagramAccount(): {
  account: SocialAccount;
  metrics: SocialMetric[];
} {
  const account = makeAccount('acc-instagram');
  const metrics = [
    makeMetric(account.id, { storyViews: 5000 }),
    makeMetric(account.id, {
      periodLabel: prevMonthly(currentMonthly),
      storyViews: 4500,
    }),
  ];
  return { account, metrics };
}

/** Previous Jalali month label for a 'YYYY-MM' label. */
function prevMonthly(label: string): string {
  const [jy, jm] = label.split('-').map(Number);
  if (jm === 1) return `${jy - 1}-12`;
  return `${jy}-${String(jm - 1).padStart(2, '0')}`;
}

function analyze(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): SocialDataQualityReport {
  return analyzeSocialDataQuality(accounts, metrics, NOW);
}

describe('analyzeSocialDataQuality', () => {
  it('1. healthy data produces no issues and healthy statuses', () => {
    const { account, metrics } = healthyInstagramAccount();
    const report = analyze([account], metrics);

    expect(report.issues).toEqual([]);
    expect(report.summary).toEqual({
      totalAccounts: 1,
      healthyAccounts: 1,
      warningAccounts: 0,
      criticalAccounts: 0,
      totalIssues: 0,
    });
    expect(report.accounts[0].status).toBe('healthy');
  });

  it('2. account without metrics is a warning', () => {
    const account = makeAccount('acc-empty');
    const report = analyze([account], []);

    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue.type).toBe('account_without_metrics');
    expect(issue.severity).toBe('warning');
    expect(issue.accountId).toBe(account.id);
    // No metric exists → the durable review identity has no metricId.
    expect(issue.metricId).toBeNull();
    expect(report.accounts[0].status).toBe('warning');
    expect(report.summary.warningAccounts).toBe(1);
  });

  it('3. stale account (older than SOCIAL_DATA_STALE_DAYS) is a warning', () => {
    const account = makeAccount('acc-stale');
    const metrics = [makeMetric(account.id, { periodLabel: staleMonthly })];
    const report = analyze([account], metrics);

    const issue = report.issues.find((i) => i.type === 'stale_account');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.metricDate).toBe(staleMonthly);
    // The stale issue is tied to the specific latest metric row.
    expect(issue!.metricId).toBe(String(metrics[0].id));
    expect(report.accounts[0].status).toBe('warning');
  });

  it('4. negative counts are critical and point at the exact field', () => {
    const account = makeAccount('acc-negative');
    const metrics = [
      makeMetric(account.id, { followers: -5 }),
      makeMetric(account.id, {
        periodLabel: prevMonthly(currentMonthly),
        likes: -1,
      }),
    ];
    const report = analyze([account], metrics);

    const negative = report.issues.filter((i) => i.type === 'negative_metric');
    expect(negative).toHaveLength(2);
    expect(negative[0].severity).toBe('critical');
    expect(negative[0].field).toBe('followers');
    expect(negative[0].details).toEqual({ storedValue: -5 });
    expect(negative[0].metricId).toBe(String(metrics[0].id));
    expect(negative[1].field).toBe('likes');
    expect(negative[1].metricId).toBe(String(metrics[1].id));
    expect(report.accounts[0].status).toBe('critical');
  });

  it('5. future-dated metric is a warning', () => {
    const account = makeAccount('acc-future');
    const metrics = [makeMetric(account.id, { periodLabel: futureMonthly })];
    const report = analyze([account], metrics);

    const issue = report.issues.find((i) => i.type === 'future_metric');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.metricDate).toBe(futureMonthly);
  });

  it('6. duplicate of the business key is a critical invariant guard', () => {
    const account = makeAccount('acc-dupe');
    const metrics = [
      makeMetric(account.id, { storyViews: 10 }),
      makeMetric(account.id, { storyViews: 10 }), // same (account, period, label)
    ];
    const report = analyze([account], metrics);

    const dupe = report.issues.filter((i) => i.type === 'duplicate_metric');
    expect(dupe).toHaveLength(1);
    expect(dupe[0].severity).toBe('critical');
    expect(dupe[0].details).toMatchObject({ count: 2 });
    expect(report.accounts[0].status).toBe('critical');
  });

  it('7. orphan metric (no matching account) is critical', () => {
    const metrics = [makeMetric('missing-account', { followers: 5 })];
    const report = analyze([], metrics);

    const orphan = report.issues.filter((i) => i.type === 'orphan_metric');
    expect(orphan).toHaveLength(1);
    expect(orphan[0].severity).toBe('critical');
    expect(orphan[0].accountId).toBe('missing-account');
    // The orphan metric row exists, so it carries its real metric id.
    expect(orphan[0].metricId).toBe(String(metrics[0].id));
    // Orphans have no account row, so they never count as a critical account.
    expect(report.summary.criticalAccounts).toBe(0);
    expect(report.summary.totalIssues).toBe(1);
  });

  it('8. NULL metric values are valid and never coerced to 0', () => {
    const account = makeAccount('acc-null');
    const metrics = [
      makeMetric(account.id, {
        followers: 100,
        likes: null,
        views: null,
        comments: null,
        engagementRate: null,
        storyViews: 500,
      }),
    ];
    const report = analyze([account], metrics);

    // NULL ≠ 0: no negative/zero-related issue, and no critical at all.
    expect(report.issues.some((i) => i.severity === 'critical')).toBe(false);
    expect(report.issues.filter((i) => i.type === 'negative_metric')).toEqual(
      [],
    );
    expect(report.accounts[0].status).toBe('healthy');

    // Explicit zero is also fine — 0 is a valid stored value, not NULL.
    const zero = analyze(
      [account],
      [makeMetric(account.id, { likes: 0, storyViews: 500 })],
    );
    expect(
      zero.issues.some(
        (i) => i.type === 'negative_metric' && i.field === 'likes',
      ),
    ).toBe(false);
  });

  it('9. optional NULL (platform-specific field) is info, never critical', () => {
    const account = makeAccount('acc-no-story');
    // Instagram account that never records storyViews.
    const metrics = [makeMetric(account.id, { followers: 100 })];
    const report = analyze([account], metrics);

    const info = report.issues.filter(
      (i) => i.type === 'missing_optional_field',
    );
    expect(info).toHaveLength(1);
    expect(info[0].severity).toBe('info');
    expect(info[0].field).toBe('storyViews');
    // Account-level absence — no metric row to reference.
    expect(info[0].metricId).toBeNull();
    expect(report.issues.some((i) => i.severity === 'critical')).toBe(false);
    // Info-only account stays healthy.
    expect(report.accounts[0].status).toBe('healthy');
    expect(report.summary.healthyAccounts).toBe(1);
  });

  it('10. multiple issues on one account are all reported with counts', () => {
    const account = makeAccount('acc-multi');
    const metrics = [
      makeMetric(account.id, {
        followers: -1,
        periodLabel: staleMonthly,
        storyViews: 5, // avoids the unrelated info issue
      }),
    ];
    const report = analyze([account], metrics);

    const negative = report.issues.find((i) => i.type === 'negative_metric');
    const stale = report.issues.find((i) => i.type === 'stale_account');
    expect(negative).toBeDefined();
    expect(stale).toBeDefined();
    expect(report.issues).toHaveLength(2);

    const status = report.accounts[0];
    expect(status.status).toBe('critical'); // critical wins over warning
    expect(status.criticalCount).toBe(1);
    expect(status.warningCount).toBe(1);
    expect(status.issueCount).toBe(2);
  });

  it('11. severity classification prioritizes critical > warning > healthy', () => {
    const critical = makeAccount('acc-c');
    const warning = makeAccount('acc-w');
    const healthy = makeAccount('acc-h', { platform: 'telegram' });
    const accounts = [critical, warning, healthy];
    const metrics = [
      makeMetric(critical.id, { followers: -1, storyViews: 5 }), // critical
      makeMetric(warning.id, {
        periodLabel: staleMonthly,
        storyViews: 5,
      }), // warning
      makeMetric(healthy.id, {
        period: 'monthly',
        periodLabel: currentMonthly,
        followers: 50,
        channelMembers: 20,
      }),
    ];
    const report = analyze(accounts, metrics);

    expect(report.summary).toEqual({
      totalAccounts: 3,
      healthyAccounts: 1,
      warningAccounts: 1,
      criticalAccounts: 1,
      totalIssues: 2,
    });
    const byId = new Map(report.accounts.map((a) => [a.accountId, a]));
    expect(byId.get('acc-c')!.status).toBe('critical');
    expect(byId.get('acc-w')!.status).toBe('warning');
    expect(byId.get('acc-h')!.status).toBe('healthy');
  });

  it('12. empty dataset produces an empty, valid report', () => {
    const report = analyze([], []);

    expect(report.summary).toEqual({
      totalAccounts: 0,
      healthyAccounts: 0,
      warningAccounts: 0,
      criticalAccounts: 0,
      totalIssues: 0,
    });
    expect(report.issues).toEqual([]);
    expect(report.accounts).toEqual([]);
  });

  it('13. platform-specific metrics are only checked for their own platform', () => {
    const youtube = makeAccount('acc-yt', { platform: 'youtube' });
    const telegram = makeAccount('acc-tg', { platform: 'telegram' });
    const instaBad = makeAccount('acc-ig-bad');
    const accounts = [youtube, telegram, instaBad];
    const metrics = [
      // YouTube: subscribers recorded → no info for subscribers.
      makeMetric(youtube.id, { followers: 10, subscribers: 200 }),
      // Telegram: channelMembers never recorded → info.
      makeMetric(telegram.id, { followers: 10 }),
      // Instagram: storyViews recorded but negative → critical on the
      // platform-specific field.
      makeMetric(instaBad.id, { followers: 10, storyViews: -3 }),
    ];
    const report = analyze(accounts, metrics);

    const missing = report.issues.filter(
      (i) => i.type === 'missing_optional_field',
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].field).toBe('channelMembers');
    expect(missing[0].accountId).toBe(telegram.id);

    const negativeStory = report.issues.find(
      (i) => i.type === 'negative_metric' && i.field === 'storyViews',
    );
    expect(negativeStory).toBeDefined();
    expect(negativeStory!.severity).toBe('critical');
    // Only the Instagram field is reported; YouTube/Telegram are untouched.
    expect(
      report.issues.some(
        (i) => i.type === 'missing_optional_field' && i.field === 'subscribers',
      ),
    ).toBe(false);
  });

  it('temporal gap: consecutive monthly labels with a missing month', () => {
    const account = makeAccount('acc-gap');
    const metrics = [
      makeMetric(account.id, { periodLabel: '1405-01' }),
      makeMetric(account.id, { periodLabel: '1405-03' }), // 1405-02 missing
    ];
    const report = analyze([account], metrics);

    const gap = report.issues.filter((i) => i.type === 'temporal_gap');
    expect(gap).toHaveLength(1);
    expect(gap[0].severity).toBe('warning');
    expect(gap[0].details).toMatchObject({
      gapMonths: 1,
      fromLabel: '1405-01',
      toLabel: '1405-03',
    });
    expect(report.accounts[0].status).toBe('warning');

    // Consecutive months → no gap.
    const ok = analyze(
      [account],
      [
        makeMetric(account.id, { periodLabel: '1405-01' }),
        makeMetric(account.id, { periodLabel: '1405-02' }),
      ],
    );
    expect(ok.issues.some((i) => i.type === 'temporal_gap')).toBe(false);
  });

  it('engagement rate outside 0..100 is critical (same rule as the sync validator)', () => {
    const account = makeAccount('acc-er');
    const metrics = [
      makeMetric(account.id, { engagementRate: 150, storyViews: 10 }),
    ];
    const report = analyze([account], metrics);

    const issue = report.issues.find(
      (i) => i.type === 'invalid_engagement_rate',
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('critical');
    expect(issue!.field).toBe('engagementRate');
  });

  it('garbage period labels are ignored, never crash, never flagged as future', () => {
    const account = makeAccount('acc-garbage');
    const metrics = [makeMetric(account.id, { periodLabel: 'garbage' })];
    const report = analyze([account], metrics);

    expect(report.issues.some((i) => i.type === 'future_metric')).toBe(false);
    // The garbage label is not stale either (ageOfPeriodLabelDays → null).
    expect(report.issues.some((i) => i.type === 'stale_account')).toBe(false);
    expect(report.accounts[0].status).toBe('healthy');
  });

  it('severity labels are centralized (UI must not invent strings)', () => {
    expect(SOCIAL_DATA_QUALITY_SEVERITY_LABELS).toEqual({
      critical: 'مشکل جدی',
      warning: 'نیازمند بررسی',
      info: 'اطلاعات',
    });
  });
});

describe('getSocialDataQuality', () => {
  /** Minimal fake Supabase client: accounts + paginated metrics. */
  function makeSupabaseMock(opts: {
    accounts?: unknown[];
    metrics?: unknown[];
    accountError?: unknown;
  }) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'social_accounts') {
          return {
            select: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: opts.accounts ?? [],
                    error: opts.accountError ?? null,
                  }),
              }),
            }),
          };
        }
        if (table === 'social_metrics') {
          const rows = opts.metrics ?? [];
          return {
            select: () => ({
              order: () => ({
                range: (from: number, to: number) =>
                  Promise.resolve({
                    data: rows.slice(from, to + 1),
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
  }

  function accountRow(id: string): Record<string, unknown> {
    return {
      id,
      brand: 'برند',
      platform: 'instagram',
      username: 'user',
      display_name: null,
      url: null,
      external_id: null,
      status: 'active',
      connection_status: 'disconnected',
      last_sync_at: null,
      last_sync_status: null,
      last_successful_sync_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
  }

  function metricRow(accountId: string): Record<string, unknown> {
    // Current month label (relative to the real run time) so the report is
    // deterministic: not future, not stale.
    const label = periodLabelForDate(new Date(), 'monthly');
    return {
      id: 1,
      account_id: accountId,
      period: 'monthly',
      period_label: label,
      period_start: null,
      period_end: null,
      followers: 100,
      following: null,
      posts: null,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      reach: null,
      impressions: null,
      engagement_rate: null,
      story_views: 50,
      channel_members: null,
      retweets: null,
      subscribers: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
  }

  it('reads real tables (no snapshot fallback) and builds the report', async () => {
    const supabase = makeSupabaseMock({
      accounts: [accountRow('acc-1')],
      metrics: [metricRow('acc-1')],
    });
    const report = await getSocialDataQuality({
      supabase:
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
    });

    expect(report.summary.totalAccounts).toBe(1);
    expect(report.summary.healthyAccounts).toBe(1);
    expect(report.issues).toEqual([]);
    expect(report.accounts[0].accountId).toBe('acc-1');
    expect(supabase.from).toHaveBeenCalledWith('social_accounts');
    expect(supabase.from).toHaveBeenCalledWith('social_metrics');
  });

  it('propagates Supabase errors instead of falling back to mock data', async () => {
    const supabase = makeSupabaseMock({
      accounts: [],
      accountError: new Error('backend down'),
    });
    await expect(
      getSocialDataQuality({
        supabase:
          supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
      }),
    ).rejects.toThrow('backend down');
  });
});
