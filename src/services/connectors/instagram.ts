import type { SocialPlatform } from '@/types/domain';
import type {
  NormalizedSocialMetric,
  SocialMetricPeriod,
} from '@/types/social';
import { periodLabelForDate } from '@/services/social-metrics';
import type {
  SocialConnectorContext,
  SocialConnectionVerification,
  SocialPage,
  SocialPlatformConnector,
} from './types';
import { fetchAllPages, fetchWithRetry, HttpError } from './utils';

/**
 * Instagram connector — official Instagram Graph API (Meta).
 *
 * Requirements (declared honestly, from the official docs):
 * - The account must be an Instagram **Business or Creator** profile
 *   linked to a Facebook Page.
 * - Access token: Facebook User token / System User token with
 *   `instagram_basic` + `instagram_manage_insights` (+ `pages_read_engagement`)
 *   permissions; app must be Live.
 * - Host: graph.facebook.com (v25.0).
 *
 * What the API really provides (2026):
 * - GET /{ig-user-id} → followers_count, follows_count, media_count
 * - GET /{ig-user-id}/insights (period=day, total_value) → reach, views,
 *   likes, comments, shares, saves, accounts_engaged, ...
 *   (`impressions` is DEPRECATED as of v22.0/April 2025 — replaced by
 *   `views`. It is deliberately NOT emitted here.)
 * - GET /{ig-user-id}/media → cursor pagination
 * - GET /{media-id}/insights → per-content likes/comments/shares/saved/...
 *
 * Everything returned is normalized; the numeric Instagram user id is
 * NEVER guessed — it comes from the API (me/accounts →
 * instagram_business_account) or from the stored `social_accounts.external_id`.
 */

const GRAPH_HOST = 'https://graph.facebook.com';
const GRAPH_VERSION = 'v25.0';

/** Capabilities of the Instagram Graph API (declared, not guessed). */
export const instagramCapabilities: SocialPlatformConnector['capabilities'] = {
  auth: ['oauth'],
  accountInfo: true,
  accountMetrics: true,
  content: true,
  contentMetrics: true,
  metricFields: [
    'followers',
    'following',
    'posts',
    'views',
    'reach',
    'likes',
    'comments',
    'shares',
    'saves',
  ],
  pagination: 'cursor',
  rateLimited: true,
};

interface InstagramUser {
  id: string;
  username?: string;
  name?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

interface InstagramBusinessAccount {
  id: string;
  username?: string;
}

interface InstagramPage {
  id: string;
  instagram_business_account?: InstagramBusinessAccount;
}

interface InstagramPageList {
  data?: InstagramPage[];
  paging?: { next?: string; cursors?: { after?: string } };
}

interface InstagramInsightValue {
  value: number;
}

interface InstagramInsightEntry {
  name?: string;
  total_value?: InstagramInsightValue;
  values?: Array<{ value: number }>;
}

interface InstagramInsightsResponse {
  data?: InstagramInsightEntry[];
  error?: { message?: string; code?: number; type?: string };
}

interface InstagramMediaItem {
  id: string;
  media_type?: string;
  timestamp?: string;
  permalink?: string;
}

interface InstagramMediaResponse {
  data?: InstagramMediaItem[];
  paging?: { next?: string; cursors?: { after?: string } };
}

function graphUrl(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `${GRAPH_HOST}/${GRAPH_VERSION}/${path}?${query.toString()}`;
}

async function graphGet<T>(
  token: string,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const res = await fetchWithRetry(() =>
    fetch(graphUrl(path, { ...params, access_token: token })),
  );
  const body = (await res.json()) as T & {
    error?: { message?: string; code?: number; type?: string };
  };
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    throw new HttpError(
      body.error.code ?? res.status,
      body.error.message ?? 'Instagram API error',
    );
  }
  return body;
}

export class InstagramConnector implements SocialPlatformConnector {
  platform: SocialPlatform = 'instagram';
  capabilities = instagramCapabilities;

  /**
   * Resolve the numeric Instagram user id. Prefers the stored
   * `external_id`; otherwise asks the API (`/me/accounts →
   * instagram_business_account`) — never guesses.
   */
  async resolveIgUserId(ctx: SocialConnectorContext): Promise<string | null> {
    if (ctx.account.externalId) return ctx.account.externalId;
    try {
      const pages = await graphGet<InstagramPageList>(
        ctx.credential.secret,
        'me/accounts',
        {
          fields: 'instagram_business_account{id,username}',
        },
      );
      const ig = pages.data?.find(
        (p) => p.instagram_business_account,
      )?.instagram_business_account;
      return ig?.id ?? null;
    } catch {
      return null;
    }
  }

  async verifyConnection(
    ctx: SocialConnectorContext,
  ): Promise<SocialConnectionVerification> {
    try {
      // /me proves the token is valid (result unused — failure throws).
      await graphGet<{ id: string }>(ctx.credential.secret, 'me', {
        fields: 'id',
      });
      const igId = await this.resolveIgUserId(ctx);
      if (!igId) {
        return {
          ok: false,
          errorCode: 'no_business_account',
          errorMessage:
            'این توکن به حساب تجاری (Business/Creator) اینستاگرام متصل نیست.',
        };
      }
      const user = await graphGet<InstagramUser>(ctx.credential.secret, igId, {
        fields: 'id,username,name,followers_count',
      });
      return {
        ok: true,
        account: {
          platform: 'instagram',
          externalId: user.id,
          username: user.username ?? ctx.account.username,
          displayName: user.name ?? null,
          url: user.username ? `https://instagram.com/${user.username}` : null,
        },
        errorMessage: undefined,
      };
    } catch (err) {
      return instagramError(err);
    }
  }

  /** Account-level snapshot: profile counts + daily account insights. */
  async fetchAccountMetrics(
    ctx: SocialConnectorContext,
    period: SocialMetricPeriod = 'daily',
  ): Promise<NormalizedSocialMetric[]> {
    const igId = await this.resolveIgUserId(ctx);
    if (!igId) {
      throw new HttpError(404, 'Instagram account id could not be resolved');
    }

    const [user, insights] = await Promise.all([
      graphGet<InstagramUser>(ctx.credential.secret, igId, {
        fields: 'followers_count,follows_count,media_count',
      }),
      graphGet<InstagramInsightsResponse>(
        ctx.credential.secret,
        `${igId}/insights`,
        {
          metric: 'reach,views,likes,comments,shares,saves',
          period: 'day',
          metric_type: 'total_value',
        },
      ),
    ]);

    const values: Record<string, number | null> = {
      followers: user.followers_count ?? null,
      following: user.follows_count ?? null,
      posts: user.media_count ?? null,
      reach: null,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
    };

    // Insights may be an empty data set when unavailable — keep null, never 0.
    for (const entry of insights.data ?? []) {
      const name = entry.name;
      if (!name || !(name in values)) continue;
      const raw = entry.total_value?.value ?? entry.values?.[0]?.value;
      if (typeof raw === 'number') values[name] = raw;
    }

    const now = ctx.now ?? new Date();
    return [
      {
        period,
        periodLabel: periodLabelForDate(now, period),
        periodStart: null,
        periodEnd: null,
        values,
      },
    ];
  }

  /** Recent media of the account (cursor pagination). */
  async fetchContent(
    ctx: SocialConnectorContext,
    pageToken?: string | null,
  ): Promise<SocialPage<unknown>> {
    const igId = await this.resolveIgUserId(ctx);
    if (!igId) return { items: [], next: null };
    const params: Record<string, string> = {
      fields: 'id,media_type,timestamp,permalink',
      limit: '25',
    };
    if (pageToken) params.after = pageToken;
    const res = await graphGet<InstagramMediaResponse>(
      ctx.credential.secret,
      `${igId}/media`,
      params,
    );
    return {
      items: res.data ?? [],
      next: res.paging?.next ? (res.paging.cursors?.after ?? null) : null,
    };
  }

  /** Per-content insights for one media id. */
  async fetchContentMetrics(
    ctx: SocialConnectorContext,
    contentId: string,
  ): Promise<NormalizedSocialMetric[]> {
    const res = await graphGet<InstagramInsightsResponse>(
      ctx.credential.secret,
      `${contentId}/insights`,
      {
        metric: 'likes,comments,shares,saved,reach,views',
        metric_type: 'total_value',
      },
    );
    const values: Record<string, number | null> = {
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      reach: null,
      views: null,
    };
    for (const entry of res.data ?? []) {
      const name = entry.name;
      if (!name || !(name in values)) continue;
      const raw = entry.total_value?.value ?? entry.values?.[0]?.value;
      if (typeof raw === 'number') values[name] = raw;
    }
    const now = ctx.now ?? new Date();
    return [
      {
        period: 'daily',
        periodLabel: periodLabelForDate(now, 'daily'),
        periodStart: null,
        periodEnd: null,
        values,
      },
    ];
  }

  /** Utility for tests / future cursor-paginated reads. */
  async paginateMedia(
    ctx: SocialConnectorContext,
    pageFn: (token: string | null) => Promise<SocialPage<unknown>>,
  ): Promise<unknown[]> {
    void ctx;
    return fetchAllPages(pageFn);
  }
}

/** Map a Graph API failure to a structured code + safe Persian message. */
export function instagramError(err: unknown): SocialConnectionVerification {
  const status = err instanceof HttpError ? err.status : null;
  const detail = err instanceof Error ? err.message : 'Instagram API error';
  // 190 = token expired.
  if (status === 190 || /expired/i.test(detail)) {
    return {
      ok: false,
      errorCode: 'token_expired',
      errorMessage:
        'نشست دسترسی اینستاگرام منقضی شده است. لطفاً دوباره اتصال برقرار کنید.',
    };
  }
  // 400 + OAuthException / invalid token.
  if (status === 400 || /OAuth|invalid.*token|unauthori/i.test(detail)) {
    return {
      ok: false,
      errorCode: 'invalid_credential',
      errorMessage: 'اعتبارنامهٔ اینستاگرام نامعتبر است.',
    };
  }
  if (status === 10 || /permission/i.test(detail)) {
    return {
      ok: false,
      errorCode: 'permission_denied',
      errorMessage: 'دسترسی لازم برای این حساب اینستاگرام تأیید نشده است.',
    };
  }
  return {
    ok: false,
    errorCode: status ? `http_${status}` : 'unknown',
    errorMessage: detail,
  };
}
