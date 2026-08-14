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
};
