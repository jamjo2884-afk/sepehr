import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramConnector, telegramError } from './telegram';
import { HttpError } from './utils';
import type { SocialAccount } from '@/types/social';

/**
 * Network-mocked tests — no real calls to api.telegram.org.
 *
 * The former "live" variant hit the real Bot API with an invalid token to
 * prove the full code path. It was flaky: dependent on network reachability,
 * firewalls and Telegram's real 401 latency (30s timeout). The same full
 * path (URL building → fetch → JSON parse → HttpError → telegramError) is
 * covered here by stubbing global fetch with fake Telegram responses,
 * following the instagram.test.ts pattern (vi.stubGlobal + vi.unstubAllGlobals
 * in afterEach).
 */

const INVALID_TOKEN = '123456:INVALID_TOKEN_FOR_TESTS';

function tgAccount(): SocialAccount {
  return {
    id: 'test-account',
    brand: 'test',
    platform: 'telegram',
    username: 'fasle_11',
    displayName: null,
    url: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as SocialAccount;
}

/** A fake Bot API response envelope with a real HTTP status. */
function telegramResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TelegramConnector — verifyConnection (mocked network)', () => {
  it('maps a real-shaped 401 to invalid_credential and never leaks the token', async () => {
    const fetchMock = vi.fn(async () =>
      telegramResponse(
        { ok: false, error_code: 401, description: 'Unauthorized' },
        401,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TelegramConnector().verifyConnection({
      credential: {
        platform: 'telegram',
        kind: 'bot-token',
        secret: INVALID_TOKEN,
      },
      account: tgAccount(),
      now: new Date(),
    });

    // Must be a failure mapped to the structured, safe code by telegramError().
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('invalid_credential');
    expect(result.errorMessage).toBe('توکن ربات نامعتبر است.');
    // The raw message must never contain the token itself.
    expect(result.errorMessage).not.toContain(INVALID_TOKEN);
  });

  it('hits getMe with the token in the URL path and never retries a 401', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) =>
      telegramResponse(
        { ok: false, error_code: 401, description: 'Unauthorized' },
        401,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new TelegramConnector().verifyConnection({
      credential: {
        platform: 'telegram',
        kind: 'bot-token',
        secret: INVALID_TOKEN,
      },
      account: tgAccount(),
      now: new Date(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // 401 is non-retryable → no backoff loop
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`https://api.telegram.org/bot${INVALID_TOKEN}/getMe`);
  });

  it('maps a 400 "chat not found" envelope to bot_not_in_chat', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/getMe')
        ? telegramResponse({
            ok: true,
            result: { id: 42, username: 'test_bot', first_name: 'Test' },
          })
        : telegramResponse(
            {
              ok: false,
              error_code: 400,
              description: 'Bad Request: chat not found',
            },
            200,
          ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new TelegramConnector().verifyConnection({
      credential: {
        platform: 'telegram',
        kind: 'bot-token',
        secret: '123456:ok',
      },
      account: tgAccount(),
      now: new Date(),
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('bot_not_in_chat');
    expect(result.errorMessage).toContain('ربات');
  });
});

describe('TelegramConnector — normalization (mocked network)', () => {
  it('fetchAccountInfo maps getChat to the normalized account', async () => {
    const fetchMock = vi.fn(async () =>
      telegramResponse({
        ok: true,
        result: {
          id: 987654,
          type: 'channel',
          title: 'کانال تست',
          username: 'fasle_11',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const info = await new TelegramConnector().fetchAccountInfo({
      credential: {
        platform: 'telegram',
        kind: 'bot-token',
        secret: '123456:ok',
      },
      account: tgAccount(),
      now: new Date(),
    });

    expect(info.platform).toBe('telegram');
    expect(info.externalId).toBe('987654');
    expect(info.username).toBe('fasle_11');
    expect(info.displayName).toBe('کانال تست');
    expect(info.url).toBe('https://t.me/fasle_11');
  });

  it('fetchAccountMetrics maps getChatMemberCount to followers + channelMembers only', async () => {
    const fetchMock = vi.fn(async () =>
      telegramResponse({ ok: true, result: { count: 4321 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await new TelegramConnector().fetchAccountMetrics(
      {
        credential: {
          platform: 'telegram',
          kind: 'bot-token',
          secret: '123456:ok',
        },
        account: tgAccount(),
        now: new Date('2026-08-14T12:00:00Z'),
      },
      'daily',
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0].period).toBe('daily');
    expect(metrics[0].periodLabel).toBeTruthy();
    expect(metrics[0].values.followers).toBe(4321);
    expect(metrics[0].values.channelMembers).toBe(4321);
    // Honest capabilities: only the columns the Bot API can genuinely fill
    // are ever emitted — never guessed zeros or nulls for the rest.
    expect(Object.keys(metrics[0].values).sort()).toEqual([
      'channelMembers',
      'followers',
    ]);
  });
});

describe('telegramError — structured error mapping (pure)', () => {
  it('maps 401 to invalid_credential', () => {
    const result = telegramError(new HttpError(401, 'HTTP 401'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('invalid_credential');
  });

  it('maps a 400 chat-not-found error to bot_not_in_chat', () => {
    const result = telegramError(
      new HttpError(400, 'Bad Request: chat not found'),
    );
    expect(result.errorCode).toBe('bot_not_in_chat');
  });

  it('maps unknown statuses to a generic http_* code and non-Error throws to unknown', () => {
    expect(telegramError(new HttpError(500, 'HTTP 500')).errorCode).toBe(
      'http_500',
    );
    expect(telegramError('boom').errorCode).toBe('unknown');
  });
});
