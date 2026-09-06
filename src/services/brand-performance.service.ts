/**
 * Brand Performance Service (Phase 23 — Operational Layer)
 *
 * Joins the internal modules for ONE brand:
 *   social   → latest social metrics across the brand's accounts
 *   finance  → budget vs actual spend for the brand
 *   content  → content pipeline counts for the brand
 *
 * All values come from real tables; empty sources yield honest zeros.
 */

import { getSocialAccounts, getBrandMetrics, latestMetricsByAccount } from '@/services/social.service';
import { getBudgets, getExpenses } from '@/services/finance/finance.service';
import { getContents } from '@/services/content.service';
import type { ContentStatus } from '@/types/content';

export interface BrandPerformance {
  brandId: string;
  social: {
    accountCount: number;
    totalFollowers: number;
    latestViews: number;
    latestLikes: number;
    latestComments: number;
  };
  finance: {
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
    budgetUsagePercent: number;
  };
  content: {
    total: number;
    byStatus: Record<ContentStatus, number>;
  };
}

/** Build the performance payload for one brand (by brandId). */
export async function getBrandPerformance(
  brandId: string,
  workspaceId: string,
): Promise<BrandPerformance | null> {
  const accounts = (await getSocialAccounts()).filter(
    (a) => a.brandId === brandId,
  );
  const metrics = await getBrandMetrics(brandId, 'monthly');
  const latestByAccount = latestMetricsByAccount(metrics);

  let totalFollowers = 0;
  let latestViews = 0;
  let latestLikes = 0;
  let latestComments = 0;
  for (const account of accounts) {
    const latest = latestByAccount.get(account.id);
    if (!latest) continue;
    totalFollowers += latest.followers;
    latestViews += latest.views ?? 0;
    latestLikes += latest.likes ?? 0;
    latestComments += latest.comments ?? 0;
  }

  const [budgets, expenses, contents] = await Promise.all([
    getBudgets(brandId),
    getExpenses(brandId),
    getContents(workspaceId, { brandId }),
  ]);

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  const ALL_STATUSES: ContentStatus[] = [
    'draft',
    'review',
    'approved',
    'scheduled',
    'published',
    'rejected',
    'cancelled',
    'failed',
  ];
  const byStatus = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  ) as Record<ContentStatus, number>;
  for (const c of contents) byStatus[c.status] += 1;

  return {
    brandId,
    social: {
      accountCount: accounts.length,
      totalFollowers,
      latestViews,
      latestLikes,
      latestComments,
    },
    finance: {
      totalBudget,
      totalSpent,
      remainingBudget: Math.max(0, totalBudget - totalSpent),
      budgetUsagePercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    },
    content: {
      total: contents.length,
      byStatus,
    },
  };
}