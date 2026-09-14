import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { getSupabase, isTableAvailable } from '@/lib/db';
import { prisma } from '@/lib/flowboard/db';
import { resolveBrandNames } from '@/services/brand.service';
import { computeProfileCompleteness } from '@/services/brand-status.service';
import type { BrandStatusProfileInput } from '@/types/brand-status';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brands/summary
 *
 * Returns per-brand summary stats: content count, task count, campaign count,
 * total expenses. Used by the /brands page to show a quick overview.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  const summary: Record<
    string,
    {
      contentCount: number;
      taskCount: number;
      campaignCount: number;
      totalExpenses: number;
      /** Fill state of the managerial status profile (null = none saved). */
      statusProfile: {
        filledCount: number;
        totalCount: number;
        percent: number;
      } | null;
    }
  > = {};

  try {
    const supabase = await getSupabase();

    // Content counts per brand
    if (await isTableAvailable('contents')) {
      const { data: contentRows } = await supabase
        .from('contents')
        .select('brand_id')
        .eq('workspace_id', ws.workspaceId);
      if (contentRows) {
        for (const row of contentRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = {
              contentCount: 0,
              taskCount: 0,
              campaignCount: 0,
              totalExpenses: 0,
              statusProfile: null,
            };
          }
          summary[bid].contentCount++;
        }
      }
    }

    // Campaign counts per brand
    if (await isTableAvailable('finance_campaigns')) {
      const { data: campaignRows } = await supabase
        .from('finance_campaigns')
        .select('brand_id')
        .eq('workspace_id', ws.workspaceId);
      if (campaignRows) {
        for (const row of campaignRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = {
              contentCount: 0,
              taskCount: 0,
              campaignCount: 0,
              totalExpenses: 0,
              statusProfile: null,
            };
          }
          summary[bid].campaignCount++;
        }
      }
    }

    // Expense totals per brand
    if (await isTableAvailable('finance_expenses')) {
      const { data: expenseRows } = await supabase
        .from('finance_expenses')
        .select('brand_id, amount')
        .eq('workspace_id', ws.workspaceId);
      if (expenseRows) {
        for (const row of expenseRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          const amt = (row as { amount: number }).amount;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = {
              contentCount: 0,
              taskCount: 0,
              campaignCount: 0,
              totalExpenses: 0,
              statusProfile: null,
            };
          }
          summary[bid].totalExpenses += Number(amt);
        }
      }
    }

    // Task counts per brand (from flow_cards)
    const taskCards = await prisma.flowCard.findMany({
      where: { brandId: { not: null } },
      select: { brandId: true },
    });
    for (const card of taskCards) {
      if (!card.brandId) continue;
      if (!summary[card.brandId]) {
        summary[card.brandId] = {
          contentCount: 0,
          taskCount: 0,
          campaignCount: 0,
          totalExpenses: 0,
          statusProfile: null,
        };
      }
      summary[card.brandId].taskCount++;
    }

    // Status-profile completeness per brand (صورت وضعیت برند). Only the
    // editable text columns are needed to compute the fill ratio.
    if (await isTableAvailable('brand_status_profiles')) {
      const { data: profileRows } = await supabase
        .from('brand_status_profiles')
        .select(
          'brand_id, brand_definition, brand_mission, brand_audience, brand_position, brand_strengths, brand_weaknesses, content_status, content_formats, content_weaknesses, content_needs, content_staffing_needs, publishing_status, publishing_discipline, publishing_channels, distribution_issues, distribution_opportunities, monetization_topics, ad_capacity, active_campaigns, ad_opportunities, ad_needs, top_need, urgent_needs, midterm_needs, management_suggestions',
        );
      if (profileRows && profileRows.length > 0) {
        // Mirror under the brand name too — the brands list page looks
        // summaries up by name while rows reference brands by id.
        const profileBrandIds = [
          ...new Set(
            profileRows.map((r) => (r as { brand_id: string | null }).brand_id),
          ),
        ].filter((id): id is string => !!id);
        const idToName = await resolveBrandNames(profileBrandIds);

        const camel: Record<string, keyof BrandStatusProfileInput> = {
          brand_definition: 'brandDefinition',
          brand_mission: 'brandMission',
          brand_audience: 'brandAudience',
          brand_position: 'brandPosition',
          brand_strengths: 'brandStrengths',
          brand_weaknesses: 'brandWeaknesses',
          content_status: 'contentStatus',
          content_formats: 'contentFormats',
          content_weaknesses: 'contentWeaknesses',
          content_needs: 'contentNeeds',
          content_staffing_needs: 'contentStaffingNeeds',
          publishing_status: 'publishingStatus',
          publishing_discipline: 'publishingDiscipline',
          publishing_channels: 'publishingChannels',
          distribution_issues: 'distributionIssues',
          distribution_opportunities: 'distributionOpportunities',
          monetization_topics: 'monetizationTopics',
          ad_capacity: 'adCapacity',
          active_campaigns: 'activeCampaigns',
          ad_opportunities: 'adOpportunities',
          ad_needs: 'adNeeds',
          top_need: 'topNeed',
          urgent_needs: 'urgentNeeds',
          midterm_needs: 'midtermNeeds',
          management_suggestions: 'managementSuggestions',
        };

        for (const row of profileRows as Array<
          Record<string, string | null> & { brand_id: string }
        >) {
          const bid = row.brand_id;
          if (!bid) continue;
          const input: BrandStatusProfileInput = {};
          for (const [snake, camelKey] of Object.entries(camel)) {
            const v = row[snake];
            if (typeof v === 'string') input[camelKey] = v;
          }
          const completeness = computeProfileCompleteness(input);

          if (!summary[bid]) {
            summary[bid] = {
              contentCount: 0,
              taskCount: 0,
              campaignCount: 0,
              totalExpenses: 0,
              statusProfile: null,
            };
          }
          summary[bid].statusProfile = completeness;

          const name = idToName.get(bid);
          if (name) {
            if (!summary[name]) {
              summary[name] = {
                contentCount: 0,
                taskCount: 0,
                campaignCount: 0,
                totalExpenses: 0,
                statusProfile: null,
              };
            }
            summary[name].statusProfile = completeness;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.warn('[api/brands/summary] Error:', err);
    return NextResponse.json({ ok: true, summary: {} });
  }
}
