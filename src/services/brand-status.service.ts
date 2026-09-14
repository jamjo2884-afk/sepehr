/**
 * Brand Status Profile Service (صورت وضعیت برند)
 *
 * Two responsibilities:
 *
 * 1. **Profile CRUD** — the editable managerial profile, one row per brand
 *    in `brand_status_profiles` (Supabase, workspace-scoped RLS). Falls
 *    back to an in-memory store when Supabase tables are unavailable
 *    (demo/test), matching the pattern of `brand.service.ts`.
 *
 * 2. **Social snapshot** — read-only view derived from the EXISTING
 *    `social_accounts` + `social_metrics` tables. Never stores or invents
 *    follower numbers: when a platform has no metric, availability is
 *    reported as 'no-metrics' / 'no-account' and the UI shows
 *    «اطلاعات موجود نیست».
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import type {
  BrandSocialPlatformStatus,
  BrandSocialSummary,
  BrandStatusProfile,
  BrandStatusProfileInput,
} from '@/types/brand-status';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { latestMetric } from '@/services/social-metrics';
import { socialAccountUrl } from '@/services/social.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';

/* =========================================================================
 * Row mapping
 * ========================================================================= */

interface BrandStatusProfileRow {
  id: string;
  workspace_id: string;
  brand_id: string;
  brand_definition: string | null;
  brand_mission: string | null;
  brand_audience: string | null;
  brand_position: string | null;
  brand_strengths: string | null;
  brand_weaknesses: string | null;
  content_status: string | null;
  content_formats: string | null;
  content_weaknesses: string | null;
  content_needs: string | null;
  content_staffing_needs: string | null;
  publishing_status: string | null;
  publishing_discipline: string | null;
  publishing_channels: string | null;
  distribution_issues: string | null;
  distribution_opportunities: string | null;
  monetization_topics: string | null;
  ad_capacity: string | null;
  active_campaigns: string | null;
  ad_opportunities: string | null;
  ad_needs: string | null;
  top_need: string | null;
  urgent_needs: string | null;
  midterm_needs: string | null;
  management_suggestions: string | null;
  created_at: string;
  updated_at: string;
}

/** snake_case column for every editable camelCase key (single source of truth). */
const COLUMN_BY_KEY: Record<keyof BrandStatusProfileInput, string> = {
  brandDefinition: 'brand_definition',
  brandMission: 'brand_mission',
  brandAudience: 'brand_audience',
  brandPosition: 'brand_position',
  brandStrengths: 'brand_strengths',
  brandWeaknesses: 'brand_weaknesses',
  contentStatus: 'content_status',
  contentFormats: 'content_formats',
  contentWeaknesses: 'content_weaknesses',
  contentNeeds: 'content_needs',
  contentStaffingNeeds: 'content_staffing_needs',
  publishingStatus: 'publishing_status',
  publishingDiscipline: 'publishing_discipline',
  publishingChannels: 'publishing_channels',
  distributionIssues: 'distribution_issues',
  distributionOpportunities: 'distribution_opportunities',
  monetizationTopics: 'monetization_topics',
  adCapacity: 'ad_capacity',
  activeCampaigns: 'active_campaigns',
  adOpportunities: 'ad_opportunities',
  adNeeds: 'ad_needs',
  topNeed: 'top_need',
  urgentNeeds: 'urgent_needs',
  midtermNeeds: 'midterm_needs',
  managementSuggestions: 'management_suggestions',
};

function profileFromRow(row: BrandStatusProfileRow): BrandStatusProfile {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id,
    brandDefinition: row.brand_definition ?? '',
    brandMission: row.brand_mission ?? '',
    brandAudience: row.brand_audience ?? '',
    brandPosition: row.brand_position ?? '',
    brandStrengths: row.brand_strengths ?? '',
    brandWeaknesses: row.brand_weaknesses ?? '',
    contentStatus: row.content_status ?? '',
    contentFormats: row.content_formats ?? '',
    contentWeaknesses: row.content_weaknesses ?? '',
    contentNeeds: row.content_needs ?? '',
    contentStaffingNeeds: row.content_staffing_needs ?? '',
    publishingStatus: row.publishing_status ?? '',
    publishingDiscipline: row.publishing_discipline ?? '',
    publishingChannels: row.publishing_channels ?? '',
    distributionIssues: row.distribution_issues ?? '',
    distributionOpportunities: row.distribution_opportunities ?? '',
    monetizationTopics: row.monetization_topics ?? '',
    adCapacity: row.ad_capacity ?? '',
    activeCampaigns: row.active_campaigns ?? '',
    adOpportunities: row.ad_opportunities ?? '',
    adNeeds: row.ad_needs ?? '',
    topNeed: row.top_need ?? '',
    urgentNeeds: row.urgent_needs ?? '',
    midtermNeeds: row.midterm_needs ?? '',
    managementSuggestions: row.management_suggestions ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
 * In-memory fallback (demo / test — no Supabase tables)
 * ========================================================================= */

const _memoryProfiles: BrandStatusProfile[] = [];

/* =========================================================================
 * Profile CRUD
 * ========================================================================= */

/**
 * Get the saved status profile for a brand, or null when none exists yet.
 */
export async function getBrandStatusProfile(
  brandId: string,
): Promise<BrandStatusProfile | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brand_status_profiles')) {
      const { data, error } = await supabase
        .from('brand_status_profiles')
        .select('*')
        .eq('brand_id', brandId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return profileFromRow(data as unknown as BrandStatusProfileRow);
    }
  } catch (err) {
    console.warn('[brand-status] Could not read profile from Supabase.', err);
  }

  // In-memory fallback
  return _memoryProfiles.find((p) => p.brandId === brandId) ?? null;
}

/**
 * Create or update the status profile of a brand (upsert on brand_id).
 * Passing a key with `undefined` leaves that field untouched; an empty
 * string clears it. Returns the stored profile, or null on failure.
 *
 * Workspace scoping: the RLS policies guarantee the caller can only touch
 * rows whose workspace they belong to; the caller must have already
 * verified the brand belongs to their workspace.
 */
export async function upsertBrandStatusProfile(
  brandId: string,
  workspaceId: string,
  input: BrandStatusProfileInput,
): Promise<BrandStatusProfile | null> {
  const patch: Record<string, string> = {};
  for (const key of Object.keys(COLUMN_BY_KEY) as Array<keyof BrandStatusProfileInput>) {
    const value = input[key];
    if (value !== undefined) patch[COLUMN_BY_KEY[key]] = value;
  }
  if (Object.keys(patch).length === 0) {
    return getBrandStatusProfile(brandId);
  }

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brand_status_profiles')) {
      const { data, error } = await supabase
        .from('brand_status_profiles')
        .upsert(
          {
            brand_id: brandId,
            workspace_id: workspaceId,
            ...patch,
          },
          { onConflict: 'brand_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return profileFromRow(data as unknown as BrandStatusProfileRow);
    }
  } catch (err) {
    console.warn('[brand-status] Could not upsert profile into Supabase.', err);
  }

  // In-memory fallback
  const now = new Date().toISOString();
  const existingIdx = _memoryProfiles.findIndex((p) => p.brandId === brandId);
  if (existingIdx >= 0) {
    const updated: BrandStatusProfile = {
      ..._memoryProfiles[existingIdx],
      ...(input as Partial<BrandStatusProfile>),
      updatedAt: now,
    };
    _memoryProfiles[existingIdx] = updated;
    return updated;
  }
  const created: BrandStatusProfile = {
    id: `bsp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    workspaceId,
    brandId,
    brandDefinition: '',
    brandMission: '',
    brandAudience: '',
    brandPosition: '',
    brandStrengths: '',
    brandWeaknesses: '',
    contentStatus: '',
    contentFormats: '',
    contentWeaknesses: '',
    contentNeeds: '',
    contentStaffingNeeds: '',
    publishingStatus: '',
    publishingDiscipline: '',
    publishingChannels: '',
    distributionIssues: '',
    distributionOpportunities: '',
    monetizationTopics: '',
    adCapacity: '',
    activeCampaigns: '',
    adOpportunities: '',
    adNeeds: '',
    topNeed: '',
    urgentNeeds: '',
    midtermNeeds: '',
    managementSuggestions: '',
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  _memoryProfiles.push(created);
  return created;
}

/* =========================================================================
 * Social snapshot (read-only, from social_accounts + social_metrics)
 * ========================================================================= */

/**
 * Build the per-platform social status rows + summary for one brand from
 * its accounts and metrics. Pure function — no I/O — so it is unit-testable
 * and reuse-safe.
 *
 * Audience number = the canonical `followers` column of the LATEST metric
 * per account (all platforms store their audience in `followers`; see
 * `platformAudienceField`). Accounts without any metric are reported as
 * 'no-metrics' — never a fabricated zero.
 */
export function buildBrandSocialStatus(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): {
  socialPlatforms: BrandSocialPlatformStatus[];
  socialSummary: BrandSocialSummary;
} {
  const byAccount = new Map<string, SocialMetric[]>();
  for (const m of metrics) {
    const list = byAccount.get(m.accountId) ?? [];
    list.push(m);
    byAccount.set(m.accountId, list);
  }

  const rows: BrandSocialPlatformStatus[] = [];
  let activePlatformCount = 0;
  let totalAudience = 0;
  let incompleteCount = 0;
  let latestUpdateMs: number | null = null;

  // One row per platform that has at least one account for this brand.
  const platformOrder: SocialPlatform[] = [];
  const accountsByPlatform = new Map<SocialPlatform, SocialAccount[]>();
  for (const account of accounts) {
    if (!accountsByPlatform.has(account.platform)) {
      accountsByPlatform.set(account.platform, []);
      platformOrder.push(account.platform);
    }
    accountsByPlatform.get(account.platform)!.push(account);
  }

  for (const platform of platformOrder) {
    const platformAccounts = accountsByPlatform.get(platform)!;
    // Active accounts only define "connected" rows; if none active, treat
    // the platform as present but the account status still surfaces below.
    const hasActive = platformAccounts.some((a) => a.status === 'active');
    if (hasActive) activePlatformCount++;

    // Pick the account whose LATEST metric is the most recent period
    // (same ordering rules as `sortMetricsByPeriod`: periodStart first,
    // then periodLabel). Accounts without metrics never win over ones
    // with metrics; the first account in input order is the deterministic
    // fallback when no account of the platform has metrics.
    let bestAccount: SocialAccount | null = null;
    let bestMetric: ReturnType<typeof latestMetric> = null;
    const isNewerPeriod = (
      candidate: NonNullable<ReturnType<typeof latestMetric>>,
      incumbent: NonNullable<ReturnType<typeof latestMetric>>,
    ): boolean => {
      if (candidate.periodStart && incumbent.periodStart && candidate.periodStart !== incumbent.periodStart) {
        return candidate.periodStart > incumbent.periodStart;
      }
      return candidate.periodLabel > incumbent.periodLabel;
    };
    for (const account of platformAccounts) {
      const latest = latestMetric(byAccount.get(account.id) ?? []);
      if (latest) {
        if (!bestMetric || isNewerPeriod(latest, bestMetric)) {
          bestAccount = account;
          bestMetric = latest;
        }
      } else if (!bestAccount) {
        bestAccount = account;
      }
    }

    const availability: BrandSocialPlatformStatus['availability'] = bestMetric
      ? 'ok'
      : 'no-metrics';

    if (bestMetric) {
      totalAudience += bestMetric.followers ?? 0;
      const ms = new Date(bestMetric.updatedAt || bestMetric.createdAt).getTime();
      if (Number.isFinite(ms) && (latestUpdateMs === null || ms > latestUpdateMs)) {
        latestUpdateMs = ms;
      }
    } else {
      incompleteCount++;
    }

    const audienceValue =
      bestMetric && bestMetric.channelMembers !== null && bestMetric.followers === 0
        ? bestMetric.channelMembers
        : (bestMetric?.followers ?? null);

    rows.push({
      platform,
      platformLabel: SOCIAL_PLATFORM_LABELS[platform],
      availability,
      audience: availability === 'ok' ? audienceValue : null,
      latestPeriodLabel: bestMetric?.periodLabel ?? null,
      username: bestAccount?.username || null,
      url: bestAccount?.url ?? socialAccountUrl(platform, bestAccount?.username ?? null),
      connectionStatus: bestAccount?.connectionStatus ?? null,
      lastSyncAt: bestAccount?.lastSyncAt ?? null,
    });
  }

  return {
    socialPlatforms: rows,
    socialSummary: {
      activePlatformCount,
      totalAudience,
      incompleteCount,
      latestUpdateAt: latestUpdateMs !== null ? new Date(latestUpdateMs).toISOString() : null,
    },
  };
}
