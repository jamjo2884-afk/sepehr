import type { ID, Timestamp } from '@/types/index';
import type { SocialPlatform } from '@/types/domain';

/* =========================================================================
 * Expense Categories
 * ========================================================================= */

export type ExpenseCategory =
  | 'advertising'
  | 'content_production'
  | 'human_resources'
  | 'influencer'
  | 'reportage'
  | 'equipment'
  | 'software'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  advertising: 'تبلیغات',
  content_production: 'تولید محتوا',
  human_resources: 'نیروی انسانی',
  influencer: 'اینفلوئنسر',
  reportage: 'رپورتاژ',
  equipment: 'تجهیزات',
  software: 'نرم‌افزار و سرویس',
  other: 'سایر',
};

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  advertising: '📢',
  content_production: '🎬',
  human_resources: '👥',
  influencer: '⭐',
  reportage: '📰',
  equipment: '🔧',
  software: '💻',
  other: '📦',
};

/* =========================================================================
 * Campaign Status
 * ========================================================================= */

export type FinanceCampaignStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled';

export const FINANCE_CAMPAIGN_STATUS_LABELS: Record<
  FinanceCampaignStatus,
  string
> = {
  planned: 'برنامه‌ریزی‌شده',
  active: 'فعال',
  completed: 'انجام‌شده',
  cancelled: 'لغوشده',
};

/* =========================================================================
 * Budget
 * ========================================================================= */

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface FinanceBudget {
  id: ID;
  brand: string;
  period: BudgetPeriod;
  periodLabel: string;
  amount: number;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceBudgetInput {
  brand: string;
  period: BudgetPeriod;
  periodLabel: string;
  amount: number;
  notes?: string;
}

/* =========================================================================
 * Expense
 * ========================================================================= */

export interface FinanceExpense {
  id: ID;
  brand: string;
  expenseDate: string;
  amount: number;
  category: ExpenseCategory;
  campaignId: string | null;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceExpenseInput {
  brand: string;
  expenseDate: string;
  amount: number;
  category: ExpenseCategory;
  campaignId?: string | null;
  description?: string;
  allocations?: ExpenseAllocationInput[];
}

/* =========================================================================
 * Expense Allocation (platform distribution)
 * ========================================================================= */

export interface ExpenseAllocation {
  id: ID;
  expenseId: ID;
  platform: SocialPlatform;
  socialAccountId: string | null;
  amount: number;
  percentage: number | null;
  createdAt: Timestamp;
}

export interface ExpenseAllocationInput {
  platform: SocialPlatform;
  socialAccountId?: string | null;
  amount: number;
  percentage?: number | null;
}

/* =========================================================================
 * Campaign
 * ========================================================================= */

export interface FinanceCampaign {
  id: ID;
  brand: string;
  name: string;
  startDate: string;
  endDate: string | null;
  budget: number;
  status: FinanceCampaignStatus;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceCampaignInput {
  brand: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  budget: number;
  status?: FinanceCampaignStatus;
  description?: string;
}

/* =========================================================================
 * Analytics Types
 * ========================================================================= */

export interface FinanceOverviewKpis {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  budgetUsagePercent: number;
  expenseCount: number;
  brandCount: number;
}

export interface FinanceBudgetVsActual {
  periodLabel: string;
  budget: number;
  actual: number;
  remaining: number;
  usagePercent: number;
}

export interface FinanceExpenseBreakdown {
  category: ExpenseCategory;
  label: string;
  total: number;
  percentage: number;
}

export interface FinanceBrandCost {
  brand: string;
  totalSpend: number;
  expenseCount: number;
}

export interface FinancePlatformEfficiency {
  platform: SocialPlatform;
  platformLabel: string;
  allocatedSpend: number;
  followerGrowth: number;
  costPerNewFollower: number | null;
  growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
}

export interface FinanceBrandPerformance {
  brand: string;
  totalSpend: number;
  followerGrowth: number;
  costPerNewFollower: number | null;
  growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
  budgetUsagePercent: number | null;
}

export interface FinanceScatterPoint {
  brand: string;
  platform: SocialPlatform;
  spend: number;
  followerGrowth: number;
}

/* =========================================================================
 * Row types (Supabase snake_case)
 * ========================================================================= */

export interface BudgetRow {
  id: string;
  brand: string;
  period: BudgetPeriod;
  period_label: string;
  amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: string;
  brand: string;
  expense_date: string;
  amount: number;
  category: ExpenseCategory;
  campaign_id: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface AllocationRow {
  id: string;
  expense_id: string;
  platform: SocialPlatform;
  social_account_id: string | null;
  amount: number;
  percentage: number | null;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  brand: string;
  name: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  status: FinanceCampaignStatus;
  description: string;
  created_at: string;
  updated_at: string;
}
