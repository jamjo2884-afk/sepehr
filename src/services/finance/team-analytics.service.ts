/**
 * Team Analytics Service
 *
 * Computes human resource cost by brand from team_members + allocations.
 * Joins with social_metrics for cost-per-follower analytics.
 *
 * Key principle: Human cost is COMPUTED, never stored in finance_expenses.
 */

import type { SocialAccount, SocialMetric } from '@/types/social';
import type {
  BrandHumanCost,
  BrandTotalCost,
  TeamKpis,
} from '@/types/team';
import type { FinanceBrandCost } from '@/types/finance';
import { sortMetricsByPeriod } from '@/services/social-metrics';
import { getTeamMembers } from '@/services/finance/team.service';

/* =========================================================================
 * Human Cost by Brand
 * ========================================================================= */

export async function getHumanCostByBrand(): Promise<BrandHumanCost[]> {
  const members = await getTeamMembers();
  const costByBrand = new Map<string, number>();
  const membersByBrand = new Map<string, number>();

  for (const member of members) {
    if (member.status !== 'active') continue;
    for (const alloc of member.allocations) {
      const cost = member.monthlyCost * (alloc.allocationPercentage / 100);
      costByBrand.set(alloc.brand, (costByBrand.get(alloc.brand) ?? 0) + cost);
      membersByBrand.set(
        alloc.brand,
        (membersByBrand.get(alloc.brand) ?? 0) + 1,
      );
    }
  }

  return [...costByBrand.entries()]
    .map(([brand, humanCost]) => ({
      brand,
      humanCost: Math.round(humanCost),
      memberCount: membersByBrand.get(brand) ?? 0,
    }))
    .sort((a, b) => b.humanCost - a.humanCost);
}

/* =========================================================================
 * Team KPIs
 * ========================================================================= */

export async function getTeamKpis(): Promise<TeamKpis> {
  const members = await getTeamMembers();
  return {
    totalMembers: members.length,
    fullTimeCount: members.filter((m) => m.employmentType === 'full_time')
      .length,
    partTimeCount: members.filter((m) => m.employmentType === 'part_time')
      .length,
    projectCount: members.filter((m) => m.employmentType === 'project')
      .length,
    internCount: members.filter((m) => m.employmentType === 'intern').length,
    activeCount: members.filter((m) => m.status === 'active').length,
    monthlyHumanCostTotal: members
      .filter((m) => m.status === 'active')
      .reduce((sum, m) => sum + m.monthlyCost, 0),
  };
}

/* =========================================================================
 * Brand Total Cost (Operational + Human)
 * ========================================================================= */

export async function getBrandTotalCosts(
  operationalCosts: FinanceBrandCost[],
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): Promise<BrandTotalCost[]> {
  const humanCosts = await getHumanCostByBrand();
  const humanCostByBrand = new Map<string, number>();
  for (const hc of humanCosts) {
    humanCostByBrand.set(hc.brand, hc.humanCost);
  }

  // Collect all brands
  const allBrands = new Set<string>();
  for (const c of operationalCosts) allBrands.add(c.brand);
  for (const hc of humanCosts) allBrands.add(hc.brand);

  // Compute follower growth per brand
  const sortedMetrics = sortMetricsByPeriod(metrics);
  const accountsByBrand = new Map<string, SocialAccount[]>();
  for (const account of accounts) {
    const list = accountsByBrand.get(account.brand) ?? [];
    list.push(account);
    accountsByBrand.set(account.brand, list);
  }

  const growthByBrand = new Map<string, number>();
  for (const [brand, brandAccounts] of accountsByBrand) {
    const accountIds = new Set(brandAccounts.map((a) => a.id));
    const brandMetrics = sortedMetrics.filter((m) =>
      accountIds.has(m.accountId),
    );
    const latest = brandMetrics[brandMetrics.length - 1];
    const first = brandMetrics[0];
    if (latest && first && latest.periodLabel !== first.periodLabel) {
      growthByBrand.set(
        brand,
        (growthByBrand.get(brand) ?? 0) +
          (latest.followers - first.followers),
      );
    }
  }

  return [...allBrands].map((brand) => {
    const operationalCost =
      operationalCosts.find((c) => c.brand === brand)?.totalSpend ?? 0;
    const humanCost = humanCostByBrand.get(brand) ?? 0;
    const totalCost = operationalCost + humanCost;
    const growth = growthByBrand.get(brand) ?? 0;

    let growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
    let operationalCostPerFollower: number | null = null;
    let humanCostPerFollower: number | null = null;
    let totalCostPerFollower: number | null = null;

    if (growth > 0) {
      growthStatus = 'positive';
      operationalCostPerFollower =
        operationalCost > 0 ? operationalCost / growth : null;
      humanCostPerFollower = humanCost > 0 ? humanCost / growth : null;
      totalCostPerFollower = totalCost / growth;
    } else if (growth < 0) {
      growthStatus = 'negative';
    } else if (totalCost > 0) {
      growthStatus = 'zero';
    } else {
      growthStatus = 'no_data';
    }

    return {
      brand,
      operationalCost,
      humanCost,
      totalCost,
      followerGrowth: growth,
      costPerNewFollower:
        operationalCostPerFollower !== null
          ? Math.round(operationalCostPerFollower)
          : null,
      humanCostPerNewFollower:
        humanCostPerFollower !== null ? Math.round(humanCostPerFollower) : null,
      totalCostPerNewFollower:
        totalCostPerFollower !== null ? Math.round(totalCostPerFollower) : null,
      growthStatus,
    };
  });
}
