/**
 * Finance Analytics Service
 *
 * Pure computation layer that joins finance data (expenses, budgets,
 * allocations) with social_metrics to produce growth analytics.
 *
 * Key principle: Finance stores costs, Social stores growth.
 * This service joins them for analytics — never stores follower counts.
 */

import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialMetric,
} from '@/types/social';
import type {
  ExpenseCategory,
  FinanceOverviewKpis,
  FinanceBudgetVsActual,
  FinanceExpenseBreakdown,
  FinanceBrandCost,
  FinancePlatformEfficiency,
  FinanceBrandPerformance,
  FinanceScatterPoint,
} from '@/types/finance';
import { EXPENSE_CATEGORY_LABELS } from '@/types/finance';
import { sortMetricsByPeriod } from '@/services/social-metrics';
import {
  getBudgets,
  getExpenses,
  getAllAllocations,
} from '@/services/finance/finance.service';

/* =========================================================================
 * Overview KPIs
 * ========================================================================= */

export async function getFinanceOverview(
  brand?: string,
): Promise<FinanceOverviewKpis> {
  const [budgets, expenses] = await Promise.all([
    getBudgets(brand),
    getExpenses(brand),
  ]);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = Math.max(0, totalBudget - totalSpent);
  const budgetUsagePercent =
    totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const brandCount = new Set(expenses.map((e) => e.brand)).size;

  return {
    totalBudget,
    totalSpent,
    remainingBudget,
    budgetUsagePercent,
    expenseCount: expenses.length,
    brandCount,
  };
}

/* =========================================================================
 * Budget vs Actual
 * ========================================================================= */

export async function getBudgetVsActual(
  brand?: string,
): Promise<FinanceBudgetVsActual[]> {
  const [budgets, expenses] = await Promise.all([
    getBudgets(brand),
    getExpenses(brand),
  ]);

  // Group budgets by period_label
  const budgetByLabel = new Map<string, number>();
  for (const b of budgets) {
    budgetByLabel.set(b.periodLabel, (budgetByLabel.get(b.periodLabel) ?? 0) + b.amount);
  }

  // Group expenses by month (extract YYYY-MM from expense_date)
  const expenseByMonth = new Map<string, number>();
  for (const e of expenses) {
    const month = e.expenseDate.slice(0, 7); // "1405-05" from "1405-05-15"
    expenseByMonth.set(month, (expenseByMonth.get(month) ?? 0) + e.amount);
  }

  // Merge all period labels
  const allLabels = new Set([
    ...budgetByLabel.keys(),
    ...expenseByMonth.keys(),
  ]);

  return [...allLabels]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((label) => {
      const budget = budgetByLabel.get(label) ?? 0;
      const actual = expenseByMonth.get(label) ?? 0;
      const remaining = Math.max(0, budget - actual);
      const usagePercent = budget > 0 ? (actual / budget) * 100 : 0;
      return { periodLabel: label, budget, actual, remaining, usagePercent };
    });
}

/* =========================================================================
 * Expense Breakdown by Category
 * ========================================================================= */

export async function getExpenseBreakdown(
  brand?: string,
): Promise<FinanceExpenseBreakdown[]> {
  const expenses = await getExpenses(brand);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      total: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/* =========================================================================
 * Brand Cost Comparison
 * ========================================================================= */

export async function getBrandCosts(): Promise<FinanceBrandCost[]> {
  const expenses = await getExpenses();

  // Group by brandId when available, fall back to brand string
  const byBrand = new Map<string, { brand: string; brandId: string | null; total: number; count: number }>();
  for (const e of expenses) {
    const key = e.brandId ?? e.brand;
    const existing = byBrand.get(key) ?? { brand: e.brand, brandId: e.brandId ?? null, total: 0, count: 0 };
    existing.total += e.amount;
    existing.count += 1;
    byBrand.set(key, existing);
  }

  return [...byBrand.values()]
    .map((data) => ({
      brand: data.brand,
      brandId: data.brandId,
      totalSpend: data.total,
      expenseCount: data.count,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

/* =========================================================================
 * Platform Efficiency (cost per new follower)
 * ========================================================================= */

export async function getPlatformEfficiency(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand?: string,
): Promise<FinancePlatformEfficiency[]> {
  const allocations = await getAllAllocations(brand);
  const { SOCIAL_PLATFORM_LABELS } = await import('@/types/domain');

  // Sum allocated spend per platform
  const spendByPlatform = new Map<SocialPlatform, number>();
  for (const a of allocations) {
    spendByPlatform.set(
      a.platform,
      (spendByPlatform.get(a.platform) ?? 0) + a.amount,
    );
  }

  // Calculate follower growth per platform from social_metrics
  const growthByPlatform = new Map<SocialPlatform, number>();
  const sortedMetrics = sortMetricsByPeriod(metrics);

  // Group metrics by account, then by platform
  const accountsByPlatform = new Map<SocialPlatform, SocialAccount[]>();
  for (const account of accounts) {
    const list = accountsByPlatform.get(account.platform) ?? [];
    list.push(account);
    accountsByPlatform.set(account.platform, list);
  }

  for (const [platform, platformAccounts] of accountsByPlatform) {
    const accountIds = new Set(platformAccounts.map((a) => a.id));
    const platformMetrics = sortedMetrics.filter((m) =>
      accountIds.has(m.accountId),
    );

    // Get latest vs first follower count for growth
    const latest = platformMetrics[platformMetrics.length - 1];
    const first = platformMetrics[0];

    if (latest && first && latest.periodLabel !== first.periodLabel) {
      growthByPlatform.set(
        platform,
        (growthByPlatform.get(platform) ?? 0) + (latest.followers - first.followers),
      );
    }
  }

  // Build result for all platforms with allocations or growth
  const allPlatforms = new Set([
    ...spendByPlatform.keys(),
    ...growthByPlatform.keys(),
  ]);

  return [...allPlatforms].map((platform) => {
    const spend = spendByPlatform.get(platform) ?? 0;
    const growth = growthByPlatform.get(platform) ?? 0;

    let growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
    let costPerNewFollower: number | null;

    if (growth > 0) {
      growthStatus = 'positive';
      costPerNewFollower = spend / growth;
    } else if (growth < 0) {
      growthStatus = 'negative';
      costPerNewFollower = null;
    } else if (spend > 0) {
      growthStatus = 'zero';
      costPerNewFollower = null;
    } else {
      growthStatus = 'no_data';
      costPerNewFollower = null;
    }

    return {
      platform,
      platformLabel: SOCIAL_PLATFORM_LABELS[platform] ?? platform,
      allocatedSpend: spend,
      followerGrowth: growth,
      costPerNewFollower,
      growthStatus,
    };
  }).sort((a, b) => b.allocatedSpend - a.allocatedSpend);
}

/* =========================================================================
 * Brand Performance (cost per new follower per brand)
 * ========================================================================= */

export async function getBrandPerformance(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): Promise<FinanceBrandPerformance[]> {
  const expenses = await getExpenses();
  const budgets = await getBudgets();

  // Spend by brand (prefer brandId)
  const spendByBrand = new Map<string, { brand: string; brandId: string | null; amount: number }>();
  for (const e of expenses) {
    const key = e.brandId ?? e.brand;
    const existing = spendByBrand.get(key);
    if (existing) existing.amount += e.amount;
    else spendByBrand.set(key, { brand: e.brand, brandId: e.brandId ?? null, amount: e.amount });
  }

  // Budget by brand (prefer brandId)
  const budgetByBrand = new Map<string, number>();
  for (const b of budgets) {
    const key = b.brandId ?? b.brand;
    budgetByBrand.set(key, (budgetByBrand.get(key) ?? 0) + b.amount);
  }

  // Growth by brand (prefer brandId)
  const accountsByBrand = new Map<string, SocialAccount[]>();
  for (const account of accounts) {
    const key = account.brandId ?? account.brand;
    const list = accountsByBrand.get(key) ?? [];
    list.push(account);
    accountsByBrand.set(key, list);
  }

  const sortedMetrics = sortMetricsByPeriod(metrics);
  const growthByBrand = new Map<string, number>();

  for (const [brand, brandAccounts] of accountsByBrand) {
    const accountIds = new Set(brandAccounts.map((a) => a.id));
    const brandMetrics = sortedMetrics.filter((m) =>
      accountIds.has(m.accountId),
    );

    const latest = brandMetrics[brandMetrics.length - 1];
    const first = brandMetrics[0];

    if (latest && first && latest.periodLabel !== first.periodLabel) {
      growthByBrand.set(brand, latest.followers - first.followers);
    }
  }

  // Build result
  const allBrands = new Set([
    ...spendByBrand.keys(),
    ...growthByBrand.keys(),
  ]);

  return [...allBrands].map((key) => {
    const spendData = spendByBrand.get(key);
    const spend = spendData?.amount ?? 0;
    const brandName = spendData?.brand ?? key;
    const brandId = spendData?.brandId ?? null;
    const growth = growthByBrand.get(key) ?? 0;
    const budget = budgetByBrand.get(key) ?? 0;

    let growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
    let costPerNewFollower: number | null;

    if (growth > 0) {
      growthStatus = 'positive';
      costPerNewFollower = spend / growth;
    } else if (growth < 0) {
      growthStatus = 'negative';
      costPerNewFollower = null;
    } else if (spend > 0) {
      growthStatus = 'zero';
      costPerNewFollower = null;
    } else {
      growthStatus = 'no_data';
      costPerNewFollower = null;
    }

    const budgetUsagePercent =
      budget > 0 ? (spend / budget) * 100 : null;

    return {
      brand: brandName,
      brandId,
      totalSpend: spend,
      followerGrowth: growth,
      costPerNewFollower,
      growthStatus,
      budgetUsagePercent,
    };
  }).sort((a, b) => b.totalSpend - a.totalSpend);
}

/* =========================================================================
 * Scatter Data (spend vs growth)
 * ========================================================================= */

export async function getScatterData(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): Promise<FinanceScatterPoint[]> {
  const allocations = await getAllAllocations();
  const sortedMetrics = sortMetricsByPeriod(metrics);

  // Group allocations by platform
  const spendByPlatform = new Map<SocialPlatform, number>();
  for (const a of allocations) {
    spendByPlatform.set(a.platform, (spendByPlatform.get(a.platform) ?? 0) + a.amount);
  }

  // Calculate growth per brand+platform
  const accountsByBrandPlatform = new Map<string, SocialAccount[]>();
  for (const account of accounts) {
    const key = `${account.brand}|${account.platform}`;
    const list = accountsByBrandPlatform.get(key) ?? [];
    list.push(account);
    accountsByBrandPlatform.set(key, list);
  }

  const points: FinanceScatterPoint[] = [];

  for (const [key, brandPlatformAccounts] of accountsByBrandPlatform) {
    const [brand, platform] = key.split('|');
    const accountIds = new Set(brandPlatformAccounts.map((a) => a.id));
    const bpMetrics = sortedMetrics.filter((m) =>
      accountIds.has(m.accountId),
    );

    const latest = bpMetrics[bpMetrics.length - 1];
    const first = bpMetrics[0];

    let growth = 0;
    if (latest && first && latest.periodLabel !== first.periodLabel) {
      growth = latest.followers - first.followers;
    }

    // Find spend for this brand+platform from allocations
    let spend = 0;
    for (const a of allocations) {
      if (
        a.platform === platform &&
        brandPlatformAccounts.some((acc) => acc.id === a.socialAccountId)
      ) {
        spend += a.amount;
      }
    }

    // Only include if there's some data
    if (spend > 0 || growth !== 0) {
      points.push({
        brand,
        platform: platform as SocialPlatform,
        spend,
        followerGrowth: growth,
      });
    }
  }

  return points.sort((a, b) => b.spend - a.spend);
}

/* =========================================================================
 * Full Dashboard Data (single fetch)
 * ========================================================================= */

export interface FinanceDashboardData {
  overview: FinanceOverviewKpis;
  budgetVsActual: FinanceBudgetVsActual[];
  expenseBreakdown: FinanceExpenseBreakdown[];
  brandCosts: FinanceBrandCost[];
  brands: string[];
}

export async function getFinanceDashboardData(
  brand?: string,
): Promise<FinanceDashboardData> {
  const [overview, budgetVsActual, expenseBreakdown, brandCosts, brands] =
    await Promise.all([
      getFinanceOverview(brand),
      getBudgetVsActual(brand),
      getExpenseBreakdown(brand),
      getBrandCosts(),
      getFinanceBrands(),
    ]);

  return { overview, budgetVsActual, expenseBreakdown, brandCosts, brands };
}

/** Re-export from finance.service to avoid circular imports */
async function getFinanceBrands(): Promise<string[]> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const [budgets, expenses, campaigns] = await Promise.all([
      supabase.from('finance_budgets').select('brand'),
      supabase.from('finance_expenses').select('brand'),
      supabase.from('finance_campaigns').select('brand'),
    ]);
    const brands = new Set<string>();
    for (const row of budgets.data ?? []) brands.add((row as { brand: string }).brand);
    for (const row of expenses.data ?? []) brands.add((row as { brand: string }).brand);
    for (const row of campaigns.data ?? []) brands.add((row as { brand: string }).brand);
    return [...brands].sort((a, b) => a.localeCompare(b, 'fa'));
  } catch {
    return [];
  }
}
