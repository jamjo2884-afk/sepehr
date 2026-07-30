import type {
  SocialAccount,
  SocialPlatform,
  SocialTrendSeries,
} from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import {
  mockSocialAccounts,
  mockSocialTrends,
} from '@/features/mock-data';

/**
 * Social-media data service.
 *
 * Today this layer returns deterministic mock data so the dashboard can be
 * developed and demoed without credentials. The async signatures and return
 * shapes are stable: when real sources are wired up (Google Sheets, Telegram
 * Bot API, Instagram Graph API, …) only the bodies of these functions change.
 */

export interface SocialSummary {
  /** Sum of followers/members across all connected accounts. */
  totalFollowers: number;
  /** Sum of average engagement per post across all accounts. */
  totalEngagement: number;
  /** Mean engagement rate across accounts (0–100). */
  avgEngagementRate: number;
  /** Mean followers growth over 30 days (percentage, 0–100). */
  avgFollowersGrowth: number;
  /** Platform with the largest audience. */
  topPlatform: SocialPlatform;
}

export interface SocialOverview {
  accounts: SocialAccount[];
  trends: SocialTrendSeries[];
  summary: SocialSummary;
}

/** Compute aggregated KPIs from a list of accounts. */
export function summarizeAccounts(accounts: SocialAccount[]): SocialSummary {
  if (accounts.length === 0) {
    return {
      totalFollowers: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
      avgFollowersGrowth: 0,
      topPlatform: 'instagram',
    };
  }

  const totalFollowers = accounts.reduce((sum, a) => sum + a.followers, 0);
  const totalEngagement = accounts.reduce((sum, a) => sum + a.avgEngagement, 0);
  const avgEngagementRate =
    accounts.reduce((sum, a) => sum + a.engagementRate, 0) / accounts.length;
  const avgFollowersGrowth =
    accounts.reduce((sum, a) => sum + a.followersGrowth, 0) / accounts.length;
  const top = accounts.reduce((best, a) =>
    a.followers > best.followers ? a : best,
  );

  return {
    totalFollowers,
    totalEngagement,
    avgEngagementRate,
    avgFollowersGrowth,
    topPlatform: top.platform,
  };
}

/**
 * Fetch the full social overview (accounts + trends + summary).
 *
 * Replace the mock reads below with real fetches when sources are available.
 */
export async function getSocialOverview(): Promise<SocialOverview> {
  const accounts = mockSocialAccounts;
  const trends = mockSocialTrends;
  const summary = summarizeAccounts(accounts);
  return { accounts, trends, summary };
}

/** Human label helper used by the UI to avoid repeated lookups. */
export function platformLabel(platform: SocialPlatform): string {
  return SOCIAL_PLATFORM_LABELS[platform];
}
