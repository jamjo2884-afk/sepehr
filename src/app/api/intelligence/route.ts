import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-auth';
import { getExpenses, getBudgets } from '@/services/finance/finance.service';
import { getHumanCostByBrand } from '@/services/finance/team-analytics.service';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';

export const dynamic = 'force-dynamic';

/**
 * Cross-domain intelligence data returned by this endpoint.
 */
interface BrandIntelligence {
  brand: string;
  brandId: string | null;
  // Financial
  totalSpend: number;
  totalBudget: number;
  budgetUtilization: number; // percentage
  // Social
  totalFollowers: number;
  followerGrowth: number;
  growthRate: number; // percentage
  // Combined
  costPerFollower: number;
  costPerNewFollower: number | null;
  // Breakdown
  operationalCost: number;
  humanCost: number;
  totalCost: number;
}

/**
 * GET /api/intelligence
 *
 * Cross-domain intelligence: combines Finance + Social + Team data
 * to provide brand-level ROI and efficiency metrics.
 *
 * Returns an array of BrandIntelligence objects sorted by cost efficiency.
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brandFilter = searchParams.get('brandId') || undefined;

    const [expenses, budgets, accounts, metrics, humanCosts] =
      await Promise.all([
        getExpenses(brandFilter),
        getBudgets(brandFilter),
        getSocialAccounts(),
        getSocialMetrics(undefined, 'monthly'),
        getHumanCostByBrand(),
      ]);

    // Group expenses by brand (prefer brandId)
    const spendByBrand = new Map<
      string,
      { brand: string; brandId: string | null; amount: number }
    >();
    for (const e of expenses) {
      const key = e.brandId ?? e.brand;
      const existing = spendByBrand.get(key);
      if (existing) existing.amount += e.amount;
      else
        spendByBrand.set(key, {
          brand: e.brand,
          brandId: e.brandId ?? null,
          amount: e.amount,
        });
    }

    // Group budgets by brand
    const budgetByBrand = new Map<string, number>();
    for (const b of budgets) {
      const key = b.brandId ?? b.brand;
      budgetByBrand.set(key, (budgetByBrand.get(key) ?? 0) + b.amount);
    }

    // Group human costs by brand
    const humanCostByBrand = new Map<
      string,
      { brand: string; brandId: string | null; cost: number }
    >();
    for (const hc of humanCosts) {
      const key = hc.brandId ?? hc.brand;
      humanCostByBrand.set(key, {
        brand: hc.brand,
        brandId: hc.brandId ?? null,
        cost: hc.humanCost,
      });
    }

    // Group accounts by brand
    const accountsByBrand = new Map<string, string[]>(); // brandKey → accountIds
    for (const account of accounts) {
      const key = account.brandId ?? account.brand;
      const list = accountsByBrand.get(key) ?? [];
      list.push(account.id);
      accountsByBrand.set(key, list);
    }

    // Sort metrics by period for growth calculation
    const sortedMetrics = [...metrics].sort((a, b) =>
      a.periodLabel.localeCompare(b.periodLabel),
    );

    // Build intelligence for each brand
    const brandIntelligence: BrandIntelligence[] = [];
    const allBrandKeys = new Set([
      ...spendByBrand.keys(),
      ...budgetByBrand.keys(),
      ...humanCostByBrand.keys(),
      ...accountsByBrand.keys(),
    ]);

    for (const brandKey of allBrandKeys) {
      const spend = spendByBrand.get(brandKey);
      const budget = budgetByBrand.get(brandKey) ?? 0;
      const humanCost = humanCostByBrand.get(brandKey);
      const accountIds = accountsByBrand.get(brandKey) ?? [];

      // Calculate follower metrics
      let totalFollowers = 0;
      let followerGrowth = 0;

      if (accountIds.length > 0) {
        const accountSet = new Set(accountIds);
        const brandMetrics = sortedMetrics.filter((m) =>
          accountSet.has(m.accountId),
        );

        // Get latest followers per account
        const latestByAccount = new Map<string, number>();
        const firstByAccount = new Map<string, number>();
        for (const m of brandMetrics) {
          if (!latestByAccount.has(m.accountId)) {
            firstByAccount.set(m.accountId, m.followers);
          }
          latestByAccount.set(m.accountId, m.followers);
        }

        for (const [, followers] of latestByAccount) {
          totalFollowers += followers;
        }
        for (const [accountId, firstFollowers] of firstByAccount) {
          const latestFollowers = latestByAccount.get(accountId) ?? 0;
          followerGrowth += latestFollowers - firstFollowers;
        }
      }

      const operationalCost = spend?.amount ?? 0;
      const totalHumanCost = humanCost?.cost ?? 0;
      const totalCost = operationalCost + totalHumanCost;

      const costPerFollower =
        totalFollowers > 0 ? totalCost / totalFollowers : 0;
      const costPerNewFollower =
        followerGrowth > 0 ? totalCost / followerGrowth : null;
      const growthRate =
        totalFollowers > 0 ? (followerGrowth / totalFollowers) * 100 : 0;
      const budgetUtilization =
        budget > 0 ? (operationalCost / budget) * 100 : 0;

      brandIntelligence.push({
        brand: spend?.brand ?? humanCost?.brand ?? '—',
        brandId: spend?.brandId ?? humanCost?.brandId ?? null,
        totalSpend: operationalCost,
        totalBudget: budget,
        budgetUtilization,
        totalFollowers,
        followerGrowth,
        growthRate,
        costPerFollower,
        costPerNewFollower,
        operationalCost,
        humanCost: totalHumanCost,
        totalCost,
      });
    }

    // Sort by cost efficiency (lowest cost per follower first)
    brandIntelligence.sort((a, b) => a.costPerFollower - b.costPerFollower);

    return NextResponse.json({
      ok: true,
      brands: brandIntelligence,
    });
  } catch (err) {
    console.warn('[intelligence] Could not build intelligence data.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت اطلاعات هوشمند.' },
      { status: 500 },
    );
  }
});
