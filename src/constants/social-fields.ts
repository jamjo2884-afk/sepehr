import type { SocialPlatform } from '@/types/domain';

/**
 * Central configuration for the social-metrics form.
 *
 * One source of truth mapping every platform to the metric columns it can
 * record (from `social_metrics`). The dynamic form renders exactly these
 * fields, so platform-specific logic lives here instead of scattered
 * `if (platform === ...)` branches across components.
 */

export type SocialMetricFieldKey =
  | 'followers'
  | 'following'
  | 'posts'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'reach'
  | 'impressions'
  | 'engagementRate'
  | 'storyViews'
  | 'channelMembers'
  | 'retweets'
  | 'subscribers';

export interface SocialMetricFieldSpec {
  key: SocialMetricFieldKey;
  /** Persian label shown in the form. */
  label: string;
  /**
   * 'count' → non-negative integer column (bigint).
   * 'percent' → 0–100 (numeric(6,3) in the schema, stored as a percentage).
   */
  kind: 'count' | 'percent';
  /** Exclusive upper bound for 'percent' fields (100). */
  max?: number;
}

export const SOCIAL_METRIC_FIELDS: Record<
  SocialMetricFieldKey,
  SocialMetricFieldSpec
> = {
  followers: { key: 'followers', label: 'دنبال‌کنندگان', kind: 'count' },
  following: { key: 'following', label: 'دنبال‌شوندگان', kind: 'count' },
  posts: { key: 'posts', label: 'محتوا', kind: 'count' },
  views: { key: 'views', label: 'بازدید', kind: 'count' },
  likes: { key: 'likes', label: 'لایک', kind: 'count' },
  comments: { key: 'comments', label: 'نظر', kind: 'count' },
  shares: { key: 'shares', label: 'اشتراک‌گذاری', kind: 'count' },
  saves: { key: 'saves', label: 'ذخیره', kind: 'count' },
  reach: { key: 'reach', label: 'دسترسی', kind: 'count' },
  impressions: { key: 'impressions', label: 'نمایش', kind: 'count' },
  engagementRate: {
    key: 'engagementRate',
    label: 'نرخ تعامل (٪)',
    kind: 'percent',
    max: 100,
  },
  storyViews: { key: 'storyViews', label: 'بازدید استوری', kind: 'count' },
  channelMembers: {
    key: 'channelMembers',
    label: 'اعضای کانال',
    kind: 'count',
  },
  retweets: { key: 'retweets', label: 'بازتوییت', kind: 'count' },
  subscribers: { key: 'subscribers', label: 'مشترکین', kind: 'count' },
};

/**
 * Platform-aware label for the primary audience metric.
 * YouTube → سابسکرایبرها, channel-based → اعضای کانال, others → دنبال‌کنندگان.
 */
export function platformFollowersLabel(platform: SocialPlatform): string {
  if (platform === 'youtube') return 'سابسکرایبرها';
  if (PLATFORM_METRIC_FIELDS[platform].includes('channelMembers'))
    return 'اعضای کانال';
  return 'دنبال‌کنندگان';
}

/**
 * Canonical audience metric field for a platform.
 * Used by the import parser to remap the generic "followers" column.
 *
 * YouTube → subscribers
 * Channel-based platforms (telegram, bale, eita, …) → channelMembers
 * Others → followers
 */
export function platformAudienceField(
  platform: SocialPlatform,
): SocialMetricFieldKey {
  if (platform === 'youtube') return 'subscribers';
  if (PLATFORM_METRIC_FIELDS[platform].includes('channelMembers'))
    return 'channelMembers';
  return 'followers';
}

/**
 * The metric fields each platform can record, in display order. Everything
 * the dynamic form renders for a platform comes from this table.
 */
export const PLATFORM_METRIC_FIELDS: Record<
  SocialPlatform,
  SocialMetricFieldKey[]
> = {
  instagram: [
    'followers',
    'following',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'saves',
    'reach',
    'impressions',
    'engagementRate',
    'storyViews',
  ],
  telegram: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  youtube: ['subscribers', 'views', 'likes', 'comments', 'posts'],
  twitter: [
    'followers',
    'following',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'retweets',
  ],
  bale: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  eita: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  rubika: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  soroushplus: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  aparat: [
    'followers',
    'views',
    'likes',
    'comments',
    'posts',
  ],
  threads: [
    'followers',
    'following',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  shad: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  igap: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  site: [
    'followers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'reach',
    'impressions',
    'engagementRate',
  ],
  gap: [
    'followers',
    'channelMembers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
  virasty: [
    'followers',
    'posts',
    'views',
    'likes',
    'comments',
    'shares',
    'engagementRate',
  ],
};

/**
 * The metric columns that exist ONLY for one platform (a subset of
 * `PLATFORM_METRIC_FIELDS`). Used by data quality to report platform
 * fields that were never recorded, without inventing new metrics.
 */
export const PLATFORM_SPECIFIC_METRIC_FIELDS: Record<
  SocialPlatform,
  SocialMetricFieldKey[]
> = {
  instagram: ['storyViews'],
  telegram: ['channelMembers'],
  youtube: ['subscribers'],
  twitter: ['retweets'],
  bale: ['channelMembers'],
  eita: ['channelMembers'],
  rubika: ['channelMembers'],
  soroushplus: ['channelMembers'],
  aparat: [],
  threads: [],
  shad: ['channelMembers'],
  igap: ['channelMembers'],
  site: [],
  gap: ['channelMembers'],
  virasty: [],
};
