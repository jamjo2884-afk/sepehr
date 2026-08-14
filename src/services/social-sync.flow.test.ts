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
 */

const { state } = vi.hoisted(() => ({
  state: {
    account: null as Record<string, unknown> | null,
    existingMetric: null as Record<string, unknown> | null,
    metricSingleData: null as Record<string, unknown> | null,
    insertedLogs: [] as Array<Record<string, unknown>>,
    accountUpdates: [] as Array<Record<string, unknown>>,
    upsertCalls: [] as Array<{ rows: unknown; options: unknown }>,
  },
}));

vi.mock('@/lib/supabase', () => {
  function chain(table: string) {
    const q: Record<string, (...a: unknown[]) => unknown> = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      in: () => q,
      range: () => q,
    };
    q.maybeSingle = async () => {
      if (table === 'social_accounts')
        return { data: state.account, error: null };
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

import { syncSocialAccount } from '@/services/social-sync.service';
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
  state.existingMetric = null;
  state.metricSingleData = null;
  state.insertedLogs = [];
  state.accountUpdates = [];
  state.upsertCalls = [];
  delete process.env.SOCIAL_TELEGRAM_BOT_TOKEN;
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
