/**
 * Finance CRUD Service
 *
 * Full CRUD for budgets, expenses, allocations, and campaigns.
 * Reads from Supabase with mock data fallback (same pattern as social/todo).
 * All writes go through this service — the client never touches Supabase directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SocialPlatform } from '@/types/domain';
import type {
  FinanceBudget,
  FinanceBudgetInput,
  FinanceExpense,
  FinanceExpenseInput,
  ExpenseAllocation,
  ExpenseAllocationInput,
  FinanceCampaign,
  FinanceCampaignInput,
  BudgetRow,
  ExpenseRow,
  AllocationRow,
  CampaignRow,
  BudgetPeriod,
  ExpenseCategory,
  FinanceCampaignStatus,
} from '@/types/finance';

/* =========================================================================
 * Helpers
 * ========================================================================= */

function iso(v: unknown): string {
  return typeof v === 'string' ? v : new Date().toISOString();
}

async function getSupabase(): Promise<SupabaseClient> {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/* =========================================================================
 * Row Mappers
 * ========================================================================= */

function budgetFromRow(row: BudgetRow): FinanceBudget {
  return {
    id: row.id,
    brand: row.brand,
    period: row.period as BudgetPeriod,
    periodLabel: row.period_label,
    amount: Number(row.amount),
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function expenseFromRow(row: ExpenseRow): FinanceExpense {
  return {
    id: row.id,
    brand: row.brand,
    expenseDate: row.expense_date,
    amount: Number(row.amount),
    category: row.category as ExpenseCategory,
    campaignId: row.campaign_id,
    description: row.description,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function allocationFromRow(row: AllocationRow): ExpenseAllocation {
  return {
    id: row.id,
    expenseId: row.expense_id,
    platform: row.platform as SocialPlatform,
    socialAccountId: row.social_account_id,
    amount: Number(row.amount),
    percentage: row.percentage != null ? Number(row.percentage) : null,
    createdAt: iso(row.created_at),
  };
}

function campaignFromRow(row: CampaignRow): FinanceCampaign {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: Number(row.budget),
    status: row.status as FinanceCampaignStatus,
    description: row.description,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/* =========================================================================
 * Mock Data
 * ========================================================================= */

const MOCK_BUDGETS: FinanceBudget[] = [];
const MOCK_EXPENSES: FinanceExpense[] = [];
const MOCK_CAMPAIGNS: FinanceCampaign[] = [];

/* =========================================================================
 * Budgets CRUD
 * ========================================================================= */

export async function getBudgets(brand?: string): Promise<FinanceBudget[]> {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from('finance_budgets')
      .select('*')
      .order('period_label', { ascending: false });
    if (brand) query = query.eq('brand', brand);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_BUDGETS;
    return (data as unknown as BudgetRow[]).map(budgetFromRow);
  } catch (err) {
    console.warn('[finance] Could not read budgets, falling back to mock.', err);
    return brand ? MOCK_BUDGETS.filter((b) => b.brand === brand) : MOCK_BUDGETS;
  }
}

export async function createBudget(
  input: FinanceBudgetInput,
): Promise<FinanceBudget | null> {
  try {
    const supabase = await getSupabase();
    const id = `bud-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      brand: input.brand.trim(),
      period: input.period,
      period_label: input.periodLabel,
      amount: input.amount,
      notes: input.notes ?? '',
    };
    const { data, error } = await supabase
      .from('finance_budgets')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return budgetFromRow(data as unknown as BudgetRow);
  } catch (err) {
    console.warn('[finance] Could not create budget.', err);
    return null;
  }
}

export async function updateBudget(
  id: string,
  patch: Partial<FinanceBudgetInput>,
): Promise<FinanceBudget | null> {
  try {
    const supabase = await getSupabase();
    const row: Record<string, unknown> = {};
    if (patch.brand !== undefined) row.brand = patch.brand.trim();
    if (patch.period !== undefined) row.period = patch.period;
    if (patch.periodLabel !== undefined) row.period_label = patch.periodLabel;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (Object.keys(row).length === 0) return null;
    const { data, error } = await supabase
      .from('finance_budgets')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return budgetFromRow(data as unknown as BudgetRow);
  } catch (err) {
    console.warn('[finance] Could not update budget.', err);
    return null;
  }
}

export async function deleteBudget(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('finance_budgets').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[finance] Could not delete budget.', err);
    return false;
  }
}

/* =========================================================================
 * Expenses CRUD
 * ========================================================================= */

export async function getExpenses(brand?: string): Promise<FinanceExpense[]> {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from('finance_expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (brand) query = query.eq('brand', brand);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_EXPENSES;
    return (data as unknown as ExpenseRow[]).map(expenseFromRow);
  } catch (err) {
    console.warn('[finance] Could not read expenses, falling back to mock.', err);
    return brand ? MOCK_EXPENSES.filter((e) => e.brand === brand) : MOCK_EXPENSES;
  }
}

export async function getExpenseById(id: string): Promise<FinanceExpense | null> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('finance_expenses')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return expenseFromRow(data as unknown as ExpenseRow);
  } catch (err) {
    console.warn('[finance] Could not read expense.', err);
    return null;
  }
}

export async function createExpense(
  input: FinanceExpenseInput,
): Promise<FinanceExpense | null> {
  try {
    const supabase = await getSupabase();
    const id = `exp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      brand: input.brand.trim(),
      expense_date: input.expenseDate,
      amount: input.amount,
      category: input.category,
      campaign_id: input.campaignId ?? null,
      description: input.description ?? '',
    };
    const { data, error } = await supabase
      .from('finance_expenses')
      .insert(row)
      .select()
      .single();
    if (error) throw error;

    // Insert allocations if provided
    if (input.allocations && input.allocations.length > 0) {
      await createAllocations(id, input.allocations);
    }

    return expenseFromRow(data as unknown as ExpenseRow);
  } catch (err) {
    console.warn('[finance] Could not create expense.', err);
    return null;
  }
}

export async function updateExpense(
  id: string,
  patch: Partial<FinanceExpenseInput>,
): Promise<FinanceExpense | null> {
  try {
    const supabase = await getSupabase();
    const row: Record<string, unknown> = {};
    if (patch.brand !== undefined) row.brand = patch.brand.trim();
    if (patch.expenseDate !== undefined) row.expense_date = patch.expenseDate;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
    if (patch.description !== undefined) row.description = patch.description;
    if (Object.keys(row).length === 0) return null;
    const { data, error } = await supabase
      .from('finance_expenses')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Replace allocations if provided
    if (patch.allocations !== undefined) {
      await supabase.from('finance_expense_allocations').delete().eq('expense_id', id);
      if (patch.allocations.length > 0) {
        await createAllocations(id, patch.allocations);
      }
    }

    return expenseFromRow(data as unknown as ExpenseRow);
  } catch (err) {
    console.warn('[finance] Could not update expense.', err);
    return null;
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[finance] Could not delete expense.', err);
    return false;
  }
}

/* =========================================================================
 * Allocations CRUD
 * ========================================================================= */

async function createAllocations(
  expenseId: string,
  allocations: ExpenseAllocationInput[],
): Promise<void> {
  const supabase = await getSupabase();
  const rows = allocations.map((a) => ({
    id: `alloc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${a.platform}`,
    expense_id: expenseId,
    platform: a.platform,
    social_account_id: a.socialAccountId ?? null,
    amount: a.amount,
    percentage: a.percentage ?? null,
  }));
  const { error } = await supabase.from('finance_expense_allocations').insert(rows);
  if (error) throw error;
}

export async function getAllocationsForExpense(
  expenseId: string,
): Promise<ExpenseAllocation[]> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('finance_expense_allocations')
      .select('*')
      .eq('expense_id', expenseId)
      .order('amount', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return (data as unknown as AllocationRow[]).map(allocationFromRow);
  } catch (err) {
    console.warn('[finance] Could not read allocations.', err);
    return [];
  }
}

export async function getAllocationsForExpenses(
  expenseIds: string[],
): Promise<Map<string, ExpenseAllocation[]>> {
  if (expenseIds.length === 0) return new Map();
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('finance_expense_allocations')
      .select('*')
      .in('expense_id', expenseIds);
    if (error) throw error;
    if (!data || data.length === 0) return new Map();
    const map = new Map<string, ExpenseAllocation[]>();
    for (const row of data as unknown as AllocationRow[]) {
      const list = map.get(row.expense_id) ?? [];
      list.push(allocationFromRow(row));
      map.set(row.expense_id, list);
    }
    return map;
  } catch (err) {
    console.warn('[finance] Could not read allocations for expenses.', err);
    return new Map();
  }
}

export async function getAllAllocations(
  brand?: string,
): Promise<ExpenseAllocation[]> {
  try {
    const supabase = await getSupabase();
    let query = supabase.from('finance_expense_allocations').select('*');
    if (brand) {
      // Join through expenses to filter by brand
      const expenses = await getExpenses(brand);
      const expenseIds = expenses.map((e) => e.id);
      if (expenseIds.length === 0) return [];
      query = query.in('expense_id', expenseIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return (data as unknown as AllocationRow[]).map(allocationFromRow);
  } catch (err) {
    console.warn('[finance] Could not read all allocations.', err);
    return [];
  }
}

/* =========================================================================
 * Campaigns CRUD
 * ========================================================================= */

export async function getCampaigns(brand?: string): Promise<FinanceCampaign[]> {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from('finance_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (brand) query = query.eq('brand', brand);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_CAMPAIGNS;
    return (data as unknown as CampaignRow[]).map(campaignFromRow);
  } catch (err) {
    console.warn('[finance] Could not read campaigns, falling back to mock.', err);
    return brand ? MOCK_CAMPAIGNS.filter((c) => c.brand === brand) : MOCK_CAMPAIGNS;
  }
}

export async function createCampaign(
  input: FinanceCampaignInput,
): Promise<FinanceCampaign | null> {
  try {
    const supabase = await getSupabase();
    const id = `cmp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      brand: input.brand.trim(),
      name: input.name.trim(),
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      budget: input.budget,
      status: input.status ?? 'planned',
      description: input.description ?? '',
    };
    const { data, error } = await supabase
      .from('finance_campaigns')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return campaignFromRow(data as unknown as CampaignRow);
  } catch (err) {
    console.warn('[finance] Could not create campaign.', err);
    return null;
  }
}

export async function updateCampaign(
  id: string,
  patch: Partial<FinanceCampaignInput>,
): Promise<FinanceCampaign | null> {
  try {
    const supabase = await getSupabase();
    const row: Record<string, unknown> = {};
    if (patch.brand !== undefined) row.brand = patch.brand.trim();
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.startDate !== undefined) row.start_date = patch.startDate;
    if (patch.endDate !== undefined) row.end_date = patch.endDate;
    if (patch.budget !== undefined) row.budget = patch.budget;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.description !== undefined) row.description = patch.description;
    if (Object.keys(row).length === 0) return null;
    const { data, error } = await supabase
      .from('finance_campaigns')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return campaignFromRow(data as unknown as CampaignRow);
  } catch (err) {
    console.warn('[finance] Could not update campaign.', err);
    return null;
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('finance_campaigns').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[finance] Could not delete campaign.', err);
    return false;
  }
}

/* =========================================================================
 * Brand Discovery (for filters)
 * ========================================================================= */

export async function getFinanceBrands(): Promise<string[]> {
  try {
    const supabase = await getSupabase();
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
