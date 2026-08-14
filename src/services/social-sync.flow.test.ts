import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedSocialMetric, SocialAccount } from '@/types/social';
import type {
  SocialCredential,
  SocialPlatformConnector,
} from '@/services/connectors/types';

/**
 * Sync-flow tests. `@/lib/supabase` is mocked with an in-memory fake so the
 * full `syncSocialAccount` pipeline (account read → verify → fetch →
 * validate → upsert → log → account state) can be exercised without a live
 * database. The connector + credential are injected via the options
 * parameter, so no env vars or real API calls are involved.
 */ const { state } = vi.hoisted(() => ({
  state: {
    account: null as Record<string, unknown> | null,
    accountsList: [] as Array<Record<string, unknown>>,
    logsList: [] as Array<Record<string, unknown>>,
    existingMetric: null as Record<string, unknown> | null,
    metricSingleData: null as Record<string, unknown> | null,
    insertedLogs: [] as Array<Record<string, unknown>>,
    accountUpdates: [] as Array<Record<string, unknown>>,
    upsertCalls: [] as Array<{ rows: unknown; options: unknown }>,
  },
}));

vi.mock('@/lib/supabase', () => {
  function chain(table: string) {
    const filters: Array<{ col: string; val: unknown }> = [];
    const q: Record<string, (...a: unknown[]) => unknown> = {
      select: () => q,
      order: () => q,
      in: () => q,
      range: () => q,
    };
    q.eq = (col: unknown, val: unknown) => {
      filters.push({ col: String(col), val });
      return q;
    };
    q.limit = async () => {
      if (table === 'social_accounts')
        return { data: state.accountsList, error: null };
      if (table === 'social_sync_logs')
        return { data: state.logsList, error: null };
      return { data: [], error: null };
    };
    q.maybeSingle = async () => {
      if (process.env.DEBUG_MOCK) {
        console.log('MOCK maybeSingle', table, JSON.stringify(filters));
      }
      if (table === 'social_accounts') {
        const idFilter = filters.find((f) => f.col === 'id');
        if (idFilter && state.accountsList.length > 0) {
          const found = state.accountsList.find((a) => a.id === idFilter.val);
          if (found) return { data: found, error: null };
        }
        // Single-sync tests use `state.account`; sync-all uses the list.
        return { data: state.account, error: null };
      }
      if (table === 'social_metrics')
        return { data: state.existingMetric, error: null };
      return { data: null, error: null };
    };
    q.single = async () => ({ data: state.metricSingleData, error: null });
    q.insert = (row: unknown) => {
      state.insertedLogs.push(row as Record<string, unknown>);
      return {
        select: () => ({
          single: async () => ({ data: state.metricSingleData, error: null }),
        }),
      };
    };
    q.update = (patch: unknown) => {
      state.accountUpdates.push(patch as Record<string, unknown>);
      return {
        eq: () => ({
          select: () => ({
            single: async () => ({ data: state.account, error: null }),
          }),
        }),
      };
    };
    q.upsert = (rows: unknown, options: unknown) => {
      state.upsertCalls.push({ rows, options });
      return {
        select: () => ({
          single: async () => ({
            data:
              state.metricSingleData ?? (Array.isArray(rows) ? rows[0] : rows),
            error: null,
          }),
        }),
      };
    };
    return q;
  }
  return { supabase: { from: (table: string) => chain(table) } };
});

import {
  calculateSyncHealth,
  formatSyncDuration,
  getLatestSyncLogs,
  getSyncOverview,
  SYNC_ALL_CONCURRENCY,
  syncAllConnectedAccounts,
  syncSocialAccount,
} from '@/services/social-sync.service';
import { recordSocialMetrics } from '@/services/social.service';

function telegramAccount(): SocialAccount {
  return {
    id: 'acc-tg-1',
    brand: 'تست',
    platform: 'telegram',
    username: 'test_channel',
    displayName: null,
    url: null,
    externalId: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function credential(): SocialCredential {
  return {
    platform: 'telegram',
    kind: 'bot-token',
    secret: '123456:TEST-SECRET',
  };
}

function metric(
  overrides: Partial<NormalizedSocialMetric> = {},
): NormalizedSocialMetric {
  return {
    period: 'daily',
    periodLabel: '1405-05-24',
    periodStart: null,
    periodEnd: null,
    values: { followers: 1000, channelMembers: 1000 },
    ...overrides,
  };
}

function accountRow(id: string, connected: boolean): Record<string, unknown> {
  return {
    id,
    brand: 'تست',
    platform: 'telegram',
    username: id,
    display_name: null,
    url: null,
    external_id: null,
    status: 'active',
    connection_status: connected ? 'connected' : 'disconnected',
    last_sync_at: null,
    last_sync_status: null,
    last_successful_sync_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeConnector(
  overrides: Partial<SocialPlatformConnector> = {},
): SocialPlatformConnector {
  return {
    platform: 'telegram',
    capabilities: {
      auth: ['bot-token'],
      accountInfo: true,
      accountMetrics: true,
      content: false,
      contentMetrics: false,
      metricFields: ['followers', 'channelMembers'],
      pagination: 'none',
      rateLimited: true,
    },
    verifyConnection: async () => ({
      ok: true,
      account: {
        platform: 'telegram',
        externalId: 'chat-98765',
        username: 'test_channel',
        displayName: null,
        url: 'https://t.me/test_channel',
      },
    }),
    fetchAccountMetrics: async () => [metric()],
    fetchContent: async () => ({ items: [], next: null }),
    fetchContentMetrics: async () => [],
    ...overrides,
  };
}

beforeEach(() => {
  state.account = null;
  state.accountsList = [];
  state.logsList = [];
  state.existingMetric = null;
  state.metricSingleData = null;
  state.insertedLogs = [];
  state.accountUpdates = [];
  state.upsertCalls = [];
  delete process.env.SOCIAL_TELEGRAM_BOT_TOKEN;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
});

describe('syncSocialAccount — failure paths', () => {
  it('credential missing → credential_not_configured, honest error', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    const result = await syncSocialAccount('acc-tg-1', { credential: null });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('credential_not_configured');
    expect(result.errorMessage).toContain('اعتبارنامه');
    // A log row was written with the error.
    expect(state.insertedLogs.length).toBe(1);
    expect(state.insertedLogs[0].status).toBe('error');
    expect(state.insertedLogs[0].error_code).toBe('credential_not_configured');
    // Account state marked error + disconnected.
    const last = state.accountUpdates[state.accountUpdates.length - 1];
    expect(last?.last_sync_status).toBe('error');
    expect(last?.connection_status).toBe('disconnected');
  });

  it('bot has no access → bot_not_in_chat with a Persian UI message', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    const connector = makeConnector({
      verifyConnection: async () => ({
        ok: false,
        errorCode: 'bot_not_in_chat',
        errorMessage: 'ربات به این کانال دسترسی ندارد.',
      }),
    });
    const result = await syncSocialAccount('acc-tg-1', {
      connector,
      credential: credential(),
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('bot_not_in_chat');
    expect(result.errorMessage).toContain('ربات به این کانال دسترسی ندارد');
    expect(state.insertedLogs[0].status).toBe('error');
    expect(state.accountUpdates[0].connection_status).toBe('error');
  });

  it('invalid credential → error path with no secret in any message', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    const connector = makeConnector({
      verifyConnection: async () => ({
        ok: false,
        errorCode: 'invalid_credential',
        errorMessage: 'توکن ربات نامعتبر است.',
      }),
    });
    const secret = '123456:TEST-SECRET';
    const result = await syncSocialAccount('acc-tg-1', {
      connector,
      credential: credential(),
    });
    expect(result.ok).toBe(false);
    const allText = JSON.stringify({
      result,
      logs: state.insertedLogs,
      updates: state.accountUpdates,
    });
    expect(allText).not.toContain(secret);
    expect(result.errorMessage).toContain('نامعتبر');
  });

  it('account not found → account_not_found', async () => {
    const result = await syncSocialAccount('missing-id', { credential: null });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('account_not_found');
  });
});

describe('syncSocialAccount — success path', () => {
  it('successful sync: fetches, validates, upserts, logs, marks connected', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    const result = await syncSocialAccount('acc-tg-1', {
      connector: makeConnector(),
      credential: credential(),
    });
    expect(result.ok).toBe(true);
    expect(result.recordsFetched).toBe(1);
    expect(result.recordsWritten).toBe(1);

    // The connector's verified external id is persisted (never guessed).
    expect(
      state.accountUpdates.some((u) => u.external_id === 'chat-98765'),
    ).toBe(true);

    // Log row written as success with counts.
    const log = state.insertedLogs.find((l) => l.status === 'success');
    expect(log?.records_fetched).toBe(1);
    expect(log?.records_written).toBe(1);

    // Account state: connected + success + last_successful_sync_at set.
    const last = state.accountUpdates[state.accountUpdates.length - 1];
    expect(last?.connection_status).toBe('connected');
    expect(last?.last_sync_status).toBe('success');
    expect(last?.last_successful_sync_at).toBeTruthy();
  });

  it('invalid metric rows are dropped but the sync still succeeds', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    const connector = makeConnector({
      fetchAccountMetrics: async () => [
        metric(),
        metric({ values: { followers: -5, channelMembers: 10 } }),
      ],
    });
    const result = await syncSocialAccount('acc-tg-1', {
      connector,
      credential: credential(),
    });
    expect(result.ok).toBe(true);
    expect(result.recordsFetched).toBe(2);
    expect(result.recordsWritten).toBe(1);
    expect(result.errorCode).toBe('partial_validation');
  });
});

describe('syncSocialAccount — concurrent run prevention', () => {
  it('rejects a second sync while one is in flight', async () => {
    state.account = telegramAccount() as unknown as Record<string, unknown>;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const connector = makeConnector({
      verifyConnection: async () => {
        await gate;
        return {
          ok: true,
          account: {
            platform: 'telegram',
            externalId: 'chat-1',
            username: 'test_channel',
            displayName: null,
            url: null,
          },
        };
      },
      fetchAccountMetrics: async () => [metric()],
    });
    const first = syncSocialAccount('acc-tg-1', {
      connector,
      credential: credential(),
    });
    // Let the first run acquire the in-flight lock.
    await new Promise((r) => setTimeout(r, 10));
    const second = await syncSocialAccount('acc-tg-1', {
      connector,
      credential: credential(),
    });
    expect(second.ok).toBe(false);
    expect(second.errorCode).toBe('already_running');
    expect(second.errorMessage).toContain('در حال انجام');
    release();
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
  });
});

describe('syncAllConnectedAccounts — concurrency & partial failure', () => {
  it('syncs only connected accounts with bounded concurrency', async () => {
    state.accountsList = [
      accountRow('a1', true),
      accountRow('a2', true),
      accountRow('a3', true),
      accountRow('a4', true),
      accountRow('a5', true),
      accountRow('a6', false),
    ];
    let active = 0;
    let maxActive = 0;
    const connector = makeConnector({
      verifyConnection: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
        return {
          ok: true,
          account: {
            platform: 'telegram',
            externalId: 'chat-x',
            username: 'x',
            displayName: null,
            url: null,
          },
        };
      },
      fetchAccountMetrics: async () => [metric()],
    });
    const result = await syncAllConnectedAccounts({
      connector,
      credential: credential(),
    });
    expect(result.success).toBe(5);
    expect(result.failed).toBe(0);
    // The disconnected account is skipped, never attempted.
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(6);
    // Bounded concurrency: never more than SYNC_ALL_CONCURRENCY at once.
    expect(maxActive).toBeLessThanOrEqual(SYNC_ALL_CONCURRENCY);
    expect(maxActive).toBe(SYNC_ALL_CONCURRENCY);
  });

  it('reports partial failure without failing the whole run', async () => {
    state.accountsList = [accountRow('a1', true), accountRow('a2', true)];
    let calls = 0;
    const connector = makeConnector({
      verifyConnection: async () => {
        calls += 1;
        if (calls === 2) {
          return {
            ok: false,
            errorCode: 'invalid_credential',
            errorMessage: 'اعتبار اتصال نامعتبر است.',
          };
        }
        return {
          ok: true,
          account: {
            platform: 'telegram',
            externalId: 'chat-x',
            username: 'x',
            displayName: null,
            url: null,
          },
        };
      },
      fetchAccountMetrics: async () => [metric()],
    });
    const result = await syncAllConnectedAccounts({
      connector,
      credential: credential(),
    });
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(
      result.results.some((r) => !r.ok && r.errorCode === 'invalid_credential'),
    ).toBe(true);
  });
});

describe('sync health & duration', () => {
  it('health is null below the minimum sample', () => {
    const h = calculateSyncHealth([
      { status: 'success' as const },
      { status: 'error' as const },
    ]);
    expect(h.rate).toBeNull();
    expect(h.total).toBe(2);
  });

  it('health is the success percentage over recent runs', () => {
    const h = calculateSyncHealth([
      { status: 'success' as const },
      { status: 'success' as const },
      { status: 'success' as const },
      { status: 'error' as const },
    ]);
    expect(h.rate).toBe(75);
    expect(h.success).toBe(3);
    expect(h.failed).toBe(1);
  });

  it('formats durations in Persian', () => {
    expect(formatSyncDuration(2400)).toBe('۲٫۴ ثانیه');
    expect(formatSyncDuration(500)).toBe('۵۰۰ میلی‌ثانیه');
    expect(formatSyncDuration(null)).toBeNull();
    expect(formatSyncDuration(0)).toBe('۰ میلی‌ثانیه');
  });
});

describe('sync overview — platform summary & history', () => {
  it('summarizes accounts per platform with credential state', async () => {
    state.accountsList = [
      { ...accountRow('t1', true), platform: 'telegram' },
      { ...accountRow('t2', false), platform: 'telegram' },
      { ...accountRow('i1', false), platform: 'instagram' },
    ];
    const overview = await getSyncOverview();
    const telegram = overview.platforms.find((p) => p.platform === 'telegram');
    const instagram = overview.platforms.find(
      (p) => p.platform === 'instagram',
    );
    expect(telegram?.accounts).toBe(2);
    expect(telegram?.connected).toBe(1);
    // Credential env is not set in tests ⇒ not-configured accounts counted.
    expect(telegram?.credentialConfigured).toBe(false);
    expect(telegram?.notConfigured).toBe(1);
    expect(instagram?.accounts).toBe(1);
    expect(instagram?.notConfigured).toBe(1);
  });

  it('maps sync history rows with duration', async () => {
    const start = '2026-08-14T12:00:00.000Z';
    state.logsList = [
      {
        id: 1,
        social_account_id: 't1',
        platform: 'telegram',
        started_at: start,
        finished_at: '2026-08-14T12:00:02.400Z',
        status: 'success',
        records_fetched: 2,
        records_written: 2,
        error_code: null,
        error_message: null,
      },
    ];
    const logs = await getLatestSyncLogs(['t1'], 5);
    expect(logs['t1']).toHaveLength(1);
    expect(logs['t1'][0].status).toBe('success');
    expect(logs['t1'][0].recordsFetched).toBe(2);
    expect(logs['t1'][0].durationMs).toBe(2400);
  });
});

describe('recordSocialMetrics — NULL merge & duplicate prevention', () => {
  it('re-recording a period keeps previously stored values (NULL never overwrites)', async () => {
    state.existingMetric = {
      id: 1,
      account_id: 'acc-tg-1',
      period: 'daily',
      period_label: '1405-05-24',
      followers: 100,
      views: 50,
      channel_members: 20,
      likes: null,
    } as unknown as Record<string, unknown>;
    state.metricSingleData = { ...state.existingMetric } as Record<
      string,
      unknown
    >;

    await recordSocialMetrics(
      'acc-tg-1',
      'daily',
      {
        followers: 120,
        views: null,
        channelMembers: null,
      },
      { periodLabel: '1405-05-24' },
    );

    const upsert = state.upsertCalls[0];
    const payload = upsert.rows as Record<string, unknown>;
    const row = Array.isArray(payload) ? payload[0] : payload;
    // Explicit new values win…
    expect(row.followers).toBe(120);
    // …NULL payload keys keep the stored values (merge behavior).
    expect(row.views).toBe(50);
    expect(row.channel_members).toBe(20);
    // Duplicate prevention: upsert on the unique key.
    expect(upsert.options).toEqual({
      onConflict: 'account_id,period,period_label',
    });
  });

  it('a brand-new row defaults followers to 0 (NOT NULL) and keeps others null', async () => {
    state.existingMetric = null;
    state.metricSingleData = null;
    await recordSocialMetrics(
      'acc-tg-1',
      'daily',
      { channelMembers: 5 },
      { periodLabel: '1405-05-24' },
    );
    const payload = state.upsertCalls[0].rows as Record<string, unknown>;
    const row = Array.isArray(payload) ? payload[0] : payload;
    expect(row.followers).toBe(0);
    expect(row.channel_members).toBe(5);
    expect(row.views).toBeNull();
  });
});
