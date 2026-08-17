import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import type {
  NormalizedSocialMetric,
  SocialAccount,
  SocialMetricPeriod,
} from '@/types/social';

/**
 * Social connector architecture.
 *
 * A connector is the ONLY code that knows how to talk to one platform's
 * external API: its auth scheme, endpoint shapes, field names, date
 * formats and pagination. Everything the connector returns is already
 * normalized to Media Deck types (`NormalizedSocialMetric`,
 * `SocialConnectorAccount`), so the sync service and the UI never see
 * platform-specific JSON.
 *
 * Not every platform supports every capability — `capabilities` declares
 * what the connector can really do, and the sync service / UI branch on it
 * instead of assuming.
 */

/** How a platform authenticates. */
export type SocialCredentialKind = 'bot-token' | 'oauth' | 'api-key';

/**
 * A resolved credential. Never serialized to the client, never logged,
 * never stored in a database — the sync route resolves it from server-side
 * environment variables only.
 */
export interface SocialCredential {
  platform: SocialPlatform;
  kind: SocialCredentialKind;
  /** The secret value (bot token / access token / API key). */
  secret: string;
}

/** What a platform API can actually do (declared, not guessed). */
export interface SocialPlatformCapabilities {
  /** Supported auth kinds; empty means the connector cannot authenticate. */
  auth: SocialCredentialKind[];
  /** Can fetch account profile info (username / display name / url). */
  accountInfo: boolean;
  /** Can fetch account-level metrics (followers, views, ...). */
  accountMetrics: boolean;
  /** Can fetch content items (posts / videos). */
  content: boolean;
  /** Can fetch per-content metrics (views/likes per post). */
  contentMetrics: boolean;
  /**
   * Which normalized metric fields the platform can fill. The connector
   * only ever emits these keys; everything else stays null.
   */
  metricFields: SocialMetricFieldKey[];
  /** Pagination style the API uses, or 'none'. */
  pagination: 'none' | 'cursor' | 'offset';
  /** Whether the API enforces rate limits we must respect. */
  rateLimited: boolean;
}

/** Context passed to every connector call. */
export interface SocialConnectorContext {
  credential: SocialCredential;
  account: SocialAccount;
  /** Injectable clock (for tests / consistent labels). */
  now?: Date;
}

/** Normalized account info from the external platform. */
export interface SocialConnectorAccount {
  platform: SocialPlatform;
  /** Platform's own account id — never guessed. */
  externalId: string;
  username: string;
  displayName: string | null;
  url: string | null;
}

/** Result of a connection verification. */
export interface SocialConnectionVerification {
  ok: boolean;
  account?: SocialConnectorAccount;
  errorCode?: string;
  errorMessage?: string;
}

/** One page of a paginated API response (connector-internal). */
export interface SocialPage<T> {
  items: T[];
  /** Next cursor / offset token, null when this is the last page. */
  next?: string | null;
}

/**
 * Abstraction over one social platform's API. Implementations normalize
 * everything to Media Deck types; no platform-specific JSON escapes a
 * connector.
 */
export interface SocialPlatformConnector {
  platform: SocialPlatform;
  capabilities: SocialPlatformCapabilities;

  /** Verify the credential works and fetch account info. */
  verifyConnection(
    ctx: SocialConnectorContext,
  ): Promise<SocialConnectionVerification>;

  /**
   * Fetch account-level metrics for one period (or the latest period when
   * `period` is omitted). The connector decides how many points to return
   * and maps external dates to Media Deck period labels.
   */
  fetchAccountMetrics(
    ctx: SocialConnectorContext,
    period?: SocialMetricPeriod,
  ): Promise<NormalizedSocialMetric[]>;

  /** Fetch the account's content items (only when capabilities.content). */
  fetchContent?(
    ctx: SocialConnectorContext,
    pageToken?: string | null,
  ): Promise<SocialPage<unknown>>;

  /** Fetch per-content metrics (only when capabilities.contentMetrics). */
  fetchContentMetrics?(
    ctx: SocialConnectorContext,
    contentId: string,
  ): Promise<NormalizedSocialMetric[]>;
}

/** Registry: platform id → connector implementation. */
export type SocialConnectorRegistry = Map<
  SocialPlatform,
  SocialPlatformConnector
>;
