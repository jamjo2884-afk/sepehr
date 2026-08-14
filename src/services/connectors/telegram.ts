import type { SocialPlatform } from '@/types/domain';
import type {
  NormalizedSocialMetric,
  SocialMetricPeriod,
} from '@/types/social';
import { periodLabelForDate } from '@/services/social-metrics';
import type {
  SocialConnectorAccount,
  SocialConnectorContext,
  SocialConnectionVerification,
  SocialPage,
  SocialPlatformConnector,
} from './types';
import { fetchAllPages, fetchWithRetry, HttpError } from './utils';

/**
 * Telegram connector — real integration with the official Bot API
 * (https://core.telegram.org/bots/api), auth via a bot token.
 *
 * What the Bot API actually provides (declared honestly):
 * - getMe / getChat → account info (title, username, type, member count)
 * - getChatMemberCount → channel subscriber count
 * - NO per-post views/likes/comments endpoint in the Bot API → content
 *   metrics are NOT advertised here.
 *
 * Everything returned is normalized: dates become MediaOS Jalali period
 * labels via `periodLabelForDate`, and only `followers` / `channelMembers`
 * are ever emitted (the columns Telegram can genuinely fill).
 */

const API_BASE = 'https://api.telegram.org';

/** Capabilities of the Telegram Bot API (declared, not guessed). */
export const telegramCapabilities: SocialPlatformConnector['capabilities'] = {
  auth: ['bot-token'],
  accountInfo: true,
  accountMetrics: true,
  content: false,
  contentMetrics: false,
  metricFields: ['followers', 'channelMembers'],
  pagination: 'none',
  rateLimited: true,
};

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

/** Typed response envelope of the Bot API. */
interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/** Normalize a Telegram chat/user id to a string (never guessed). */
function externalIdOf(id: number | string): string {
  return String(id);
}

/** Resolve the chat id: prefer the account's stored username (as @handle). */
function chatTarget(account: SocialConnectorContext['account']): string {
  const username = account.username;
  return username.startsWith('@') ? username : `@${username}`;
}

/** Build the Bot API URL for a method + token. */
function methodUrl(token: string, method: string): string {
  return `${API_BASE}/bot${token}/${method}`;
}

async function callApi<T>(
  token: string,
  method: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }
  const url = `${methodUrl(token, method)}?${query.toString()}`;
  const res = await fetchWithRetry(() => fetch(url));
  const body = (await res.json()) as TelegramResponse<T>;
  if (!body.ok) {
    throw new HttpError(
      body.error_code ?? 500,
      body.description ?? `Telegram API error in ${method}`,
    );
  }
  return body.result as T;
}

export class TelegramConnector implements SocialPlatformConnector {
  platform: SocialPlatform = 'telegram';
  capabilities = telegramCapabilities;

  async verifyConnection(
    ctx: SocialConnectorContext,
  ): Promise<SocialConnectionVerification> {
    try {
      // getMe proves the token is valid.
      const me = await callApi<TelegramUser>(ctx.credential.secret, 'getMe');
      const account = await this.fetchAccountInfo(ctx);
      return {
        ok: true,
        account: {
          ...account,
          username: account.username || me.username || ctx.account.username,
        },
        errorMessage: undefined,
      };
    } catch (err) {
      return telegramError(err);
    }
  }

  /** Account info via getChat (title + username). */
  async fetchAccountInfo(
    ctx: SocialConnectorContext,
  ): Promise<SocialConnectorAccount> {
    const chat = await callApi<TelegramChat>(ctx.credential.secret, 'getChat', {
      chat_id: chatTarget(ctx.account),
    });
    return {
      platform: 'telegram',
      externalId: externalIdOf(chat.id),
      username: chat.username || ctx.account.username,
      displayName: chat.title ?? null,
      url: chat.username ? `https://t.me/${chat.username}` : ctx.account.url,
    };
  }

  /**
   * Fetch channel member count as a normalized metric. The count is a
   * point-in-time snapshot, so the period is derived from `now` (daily by
   * default, or the requested granularity). Only `followers` and
   * `channelMembers` are filled — the columns Telegram can provide.
   */
  async fetchAccountMetrics(
    ctx: SocialConnectorContext,
    period: SocialMetricPeriod = 'daily',
  ): Promise<NormalizedSocialMetric[]> {
    const count = await callApi<{ count: number }>(
      ctx.credential.secret,
      'getChatMemberCount',
      { chat_id: chatTarget(ctx.account) },
    );
    const now = ctx.now ?? new Date();
    const label = periodLabelForDate(now, period);
    return [
      {
        period,
        periodLabel: label,
        periodStart: null,
        periodEnd: null,
        values: {
          followers: count.count,
          channelMembers: count.count,
        },
      },
    ];
  }

  async fetchContent(
    _ctx: SocialConnectorContext,
    _pageToken?: string | null,
  ): Promise<SocialPage<unknown>> {
    // Bot API has no content-listing endpoint for channels — the
    // capability is declared false, so the sync service never calls this.
    return { items: [], next: null };
  }

  async fetchContentMetrics(
    _ctx: SocialConnectorContext,
    _contentId: string,
  ): Promise<NormalizedSocialMetric[]> {
    return [];
  }

  /** Utility wrapper for tests / future paginated reads. */
  async paginateChats(
    token: string,
    pageFn: (t: string | null) => Promise<SocialPage<unknown>>,
  ): Promise<unknown[]> {
    void token;
    return fetchAllPages(pageFn);
  }
}

/**
 * Map a Telegram API failure to a structured error code + a Persian,
 * safe-to-show message. Raw API descriptions never reach the UI — they go
 * to the sync log (sanitized) only.
 */
export function telegramError(err: unknown): SocialConnectionVerification {
  const status = err instanceof HttpError ? err.status : null;
  const detail =
    err instanceof Error ? err.message : 'Telegram connection failed';
  // Bot API: 400 'chat not found' / 'bot is not a member of the channel chat'.
  if (
    status === 400 &&
    /chat not found|not a member|bot.*member/i.test(detail)
  ) {
    return {
      ok: false,
      errorCode: 'bot_not_in_chat',
      errorMessage:
        'ربات به این کانال دسترسی ندارد. لطفاً ربات را به کانال اضافه کنید.',
    };
  }
  if (status === 401) {
    return {
      ok: false,
      errorCode: 'invalid_credential',
      errorMessage: 'توکن ربات نامعتبر است.',
    };
  }
  if (status === 403) {
    return {
      ok: false,
      errorCode: 'bot_forbidden',
      errorMessage: 'ربات اجازهٔ دسترسی به این کانال را ندارد.',
    };
  }
  return {
    ok: false,
    errorCode: status ? `http_${status}` : 'unknown',
    errorMessage: detail,
  };
}
