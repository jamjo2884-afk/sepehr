import type { ID, Timestamp } from '@/types/index';
import type { SocialPlatform } from '@/types/domain';

/* =========================================================================
 * Brand Status Profile (صورت وضعیت برند)
 * ========================================================================= */

/**
 * Editable managerial profile for one brand. One row per brand
 * (`brand_id` UNIQUE). All fields are free-form managerial notes.
 *
 * Follower counts / social numbers deliberately do NOT live here —
 * they are always read live from `social_accounts` + `social_metrics`
 * (single source of truth; no duplicated data).
 */
export interface BrandStatusProfile {
  id: ID;
  workspaceId: ID;
  brandId: ID;

  // هویت و جایگاه برند
  brandDefinition: string;
  brandMission: string;
  brandAudience: string;
  brandPosition: string;
  brandStrengths: string;
  brandWeaknesses: string;

  // وضعیت تولید محتوا
  contentStatus: string;
  contentFormats: string;
  contentWeaknesses: string;
  contentNeeds: string;
  contentStaffingNeeds: string;

  // وضعیت انتشار و توزیع
  publishingStatus: string;
  publishingDiscipline: string;
  publishingChannels: string;
  distributionIssues: string;
  distributionOpportunities: string;

  // وضعیت جریان‌سازی و تبلیغات
  monetizationTopics: string;
  adCapacity: string;
  activeCampaigns: string;
  adOpportunities: string;
  adNeeds: string;

  // نیازهای برند
  topNeed: string;
  urgentNeeds: string;
  midtermNeeds: string;
  managementSuggestions: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Editable fields of a brand status profile (everything but ids/timestamps). */
export type BrandStatusProfileInput = Partial<
  Omit<BrandStatusProfile, 'id' | 'workspaceId' | 'brandId' | 'createdAt' | 'updatedAt'>
>;

/* =========================================================================
 * Social snapshot (read-only, derived from social_accounts + social_metrics)
 * ========================================================================= */

/** Availability of the audience number for one platform row. */
export type BrandSocialMetricAvailability =
  | 'ok'            // metric found — real number shown
  | 'no-metrics'    // account exists but has no metrics at all
  | 'no-account';   // no social account for this brand × platform

/** One row of the brand's social status table. */
export interface BrandSocialPlatformStatus {
  platform: SocialPlatform;
  /** Persian platform label (from SOCIAL_PLATFORM_LABELS). */
  platformLabel: string;
  /** How to interpret `audience`: real value vs. unavailable. */
  availability: BrandSocialMetricAvailability;
  /**
   * Latest known audience count (followers / members / subscribers —
   * the canonical `followers` column of social_metrics). Only meaningful
   * when `availability === 'ok'`.
   */
  audience: number | null;
  /** Period label of the latest metric (e.g. '1404-08'), when available. */
  latestPeriodLabel: string | null;
  /** Account handle / username, when an account exists. */
  username: string | null;
  /** Public web URL of the account, when available. */
  url: string | null;
  /** Connection status of the account (connected/disconnected/…). */
  connectionStatus: string | null;
  /** Last sync timestamp (ISO), when the account has been synced. */
  lastSyncAt: string | null;
}

/** Summary of the brand's social status (header card). */
export interface BrandSocialSummary {
  /** Platforms that have at least one active account. */
  activePlatformCount: number;
  /** Sum of latest audience counts across platforms with a valid metric. */
  totalAudience: number;
  /** Number of platforms where a valid metric is missing. */
  incompleteCount: number;
  /** Newest metric timestamp across the brand's accounts (ISO), or null. */
  latestUpdateAt: string | null;
}

/** GET /api/brands/[id]/status response body. */
export interface BrandStatusPayload {
  brand: {
    id: ID;
    workspaceId: ID;
    name: string;
    slug: string;
    status: 'active' | 'inactive';
    logoUrl: string | null;
    color: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
  /** Saved profile, or null when the brand has no profile yet. */
  profile: BrandStatusProfile | null;
  /** Per-platform social status rows (all supported platforms of the workspace data). */
  socialPlatforms: BrandSocialPlatformStatus[];
  socialSummary: BrandSocialSummary;
}

/** PUT /api/brands/[id]/status request body — partial profile update. */
export type BrandStatusProfilePutBody = BrandStatusProfileInput;
