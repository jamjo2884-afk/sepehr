import { toLatinDigits } from '@/utils/persian';
import { PERSIAN_MONTHS } from '@/constants/ui.constants';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricPeriod } from '@/types/social';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';

/**
 * Normalization helpers for the bulk-import pipeline.
 *
 * Files written by Persian users routinely mix Latin / Persian / Arabic
 * digits, stray whitespace, leading '@' signs and thousands separators.
 * Every raw string from a file passes through here before validation so a
 * single representation reaches the validator and the storage layer.
 */

/** Strip thousands separators (',', '،', space, NBSP) and normalize digits. */
export function normalizeNumericString(raw: string): string {
  return toLatinDigits(raw)
    .replace(/[،,]/g, '')
    .replace(/[\s\u00A0\u200C]/g, '')
    .trim();
}

/**
 * Parse a numeric cell into a non-negative finite number.
 * Returns null for an empty cell (NULL = "not provided").
 * Throws a human-readable error when the cell is not a valid number.
 */
export function parseImportNumber(raw: string): number | null {
  const normalized = normalizeNumericString(raw);
  if (normalized === '') return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    throw new Error('عدد نامعتبر است.');
  }
  if (n < 0) {
    throw new Error('عدد نمی‌تواند منفی باشد.');
  }
  return n;
}

/** Normalize a platform cell (Persian or Latin name, case-insensitive). */
export function normalizePlatform(raw: string): SocialPlatform | null {
  const value = raw.trim().toLowerCase().replace(/[\s@]/g, '');
  if (value === '') return null;
  // Latin aliases.
  const latin: Record<string, SocialPlatform> = {
    instagram: 'instagram',
    insta: 'instagram',
    ig: 'instagram',
    telegram: 'telegram',
    tg: 'telegram',
    t: 'telegram',
    youtube: 'youtube',
    yt: 'youtube',
    twitter: 'twitter',
    x: 'twitter',
    tweet: 'twitter',
    bale: 'bale',
    ble: 'bale',
    eita: 'eita',
    eitaa: 'eita',
    rubika: 'rubika',
    soroushplus: 'soroushplus',
    soroush: 'soroushplus',
    sapp: 'soroushplus',
  };
  if (value in latin) return latin[value];
  // Persian labels from the app's own config.
  const fa = Object.entries(SOCIAL_PLATFORM_LABELS).find(
    ([, label]) => label.replace(/[\s]/g, '') === value,
  );
  if (fa) return fa[0] as SocialPlatform;
  return null;
}

/** Normalize a period cell (Latin or Persian name). */
export function normalizePeriod(raw: string): SocialMetricPeriod | null {
  const value = raw.trim().toLowerCase();
  const aliases: Record<string, SocialMetricPeriod> = {
    daily: 'daily',
    day: 'daily',
    روزانه: 'daily',
    weekly: 'weekly',
    week: 'weekly',
    هفتگی: 'weekly',
    monthly: 'monthly',
    month: 'monthly',
    ماهانه: 'monthly',
  };
  return aliases[value] ?? null;
}

const MONTHLY_LABEL_RE = /^(\d{4})-(\d{2})$/;
const DAILY_LABEL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKLY_LABEL_RE = /^(\d{4})-W(\d{2})$/;

/**
 * Normalize a period label cell into the canonical MediaOS format:
 * - monthly: '1405-05' (accepts '1405-05' or 'مرداد ۱۴۰۵' / 'مرداد 1405')
 * - daily:   '1405-05-23'
 * - weekly:  '1405-W33'
 * Returns null when the label is empty or unparsable.
 * Throws a human-readable error for a malformed label.
 */
export function normalizePeriodLabel(
  period: SocialMetricPeriod,
  raw: string,
): string | null {
  const value = toLatinDigits(raw).trim();
  if (value === '') return null;
  if (period === 'monthly') {
    const direct = value.match(MONTHLY_LABEL_RE);
    if (direct) return value;
    // 'مرداد ۱۴۰۵' / 'مرداد 1405' → '1405-05'
    const fa = value.match(/^([\u0600-\u06FF]+)\s*(\d{4})$/);
    if (fa) {
      const monthIndex = PERSIAN_MONTHS.findIndex(
        (m) => toLatinDigits(m) === toLatinDigits(fa[1]),
      );
      if (monthIndex >= 0) {
        return `${fa[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
      }
    }
    throw new Error(
      'ماه را به شکل ۱۴۰۵-۰۵ یا نام ماه شمسی (مثلاً «مرداد ۱۴۰۵») وارد کنید.',
    );
  }
  if (period === 'daily') {
    if (!DAILY_LABEL_RE.test(value)) {
      throw new Error('تاریخ را به شکل ۱۴۰۵-۰۵-۲۳ وارد کنید.');
    }
    return value;
  }
  // weekly
  if (!WEEKLY_LABEL_RE.test(value)) {
    throw new Error('هفته را به شکل ۱۴۰۵-W33 وارد کنید.');
  }
  return value;
}

/**
 * Header-name → metric-field mapping. Accepts the snake_case database
 * columns (the documented template), camelCase keys, and the Persian labels
 * shown in the manual form, so a file written by a human maps correctly.
 */
const HEADER_METRIC_ALIASES: Record<string, SocialMetricFieldKey> = {
  followers: 'followers',
  follower: 'followers',
  دنبال_کنندگان: 'followers',
  دنبالکنندگان: 'followers',
  following: 'following',
  دنبال_شوندگان: 'following',
  دنبالشوندگان: 'following',
  posts: 'posts',
  post: 'posts',
  محتوا: 'posts',
  views: 'views',
  view: 'views',
  بازدید: 'views',
  likes: 'likes',
  like: 'likes',
  لایک: 'likes',
  comments: 'comments',
  comment: 'comments',
  نظر: 'comments',
  shares: 'shares',
  share: 'shares',
  اشتراک_گذاری: 'shares',
  اشتراکگذاری: 'shares',
  saves: 'saves',
  save: 'saves',
  ذخیره: 'saves',
  reach: 'reach',
  دسترسی: 'reach',
  impressions: 'impressions',
  impression: 'impressions',
  نمایش: 'impressions',
  engagement_rate: 'engagementRate',
  engagementrate: 'engagementRate',
  engagement: 'engagementRate',
  engagementRate: 'engagementRate',
  نرخ_تعامل: 'engagementRate',
  نرختعامل: 'engagementRate',
  story_views: 'storyViews',
  storyviews: 'storyViews',
  story: 'storyViews',
  بازدید_استوری: 'storyViews',
  بازدیداستوری: 'storyViews',
  channel_members: 'channelMembers',
  channelmembers: 'channelMembers',
  members: 'channelMembers',
  اعضای_کانال: 'channelMembers',
  اعضایکانال: 'channelMembers',
  retweets: 'retweets',
  retweet: 'retweets',
  بازتوییت: 'retweets',
  subscribers: 'subscribers',
  subscriber: 'subscribers',
  مشترکین: 'subscribers',
};

/** Normalize a header cell into a metric field key, or null. */
export function headerToMetricKey(raw: string): SocialMetricFieldKey | null {
  const value = toLatinDigits(raw).trim().toLowerCase();
  if (value === '') return null;
  // Exact Latin key.
  if (value in SOCIAL_METRIC_FIELDS) return value as SocialMetricFieldKey;
  // Alias map (already lowercased keys).
  const alias = HEADER_METRIC_ALIASES[value.replace(/[\s\u00A0]/g, '')];
  return alias ?? null;
}

/** Canonical column header for a metric field (used by the template). */
export function metricColumnHeader(key: SocialMetricFieldKey): string {
  const columnMap: Record<SocialMetricFieldKey, string> = {
    followers: 'followers',
    following: 'following',
    posts: 'posts',
    views: 'views',
    likes: 'likes',
    comments: 'comments',
    shares: 'shares',
    saves: 'saves',
    reach: 'reach',
    impressions: 'impressions',
    engagementRate: 'engagement_rate',
    storyViews: 'story_views',
    channelMembers: 'channel_members',
    retweets: 'retweets',
    subscribers: 'subscribers',
  };
  return columnMap[key];
}
