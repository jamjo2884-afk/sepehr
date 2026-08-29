/**
 * Finance CRUD Service
 *
 * Full CRUD for budgets, expenses, allocations, and campaigns.
 * Uses Supabase with localStorage fallback when tables don't exist.
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

let _supabaseAvailable: boolean | null = null;

async function getSupabase(): Promise<SupabaseClient> {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

async function checkSupabaseTable(
  supabase: SupabaseClient,
  table: string,
): Promise<boolean> {
  if (_supabaseAvailable !== null) return _supabaseAvailable;
  try {
    const { error } = await supabase.from(table).select('id').limit(1);
    _supabaseAvailable = !error || error.code !== 'PGRST205';
    return _supabaseAvailable;
  } catch {
    _supabaseAvailable = false;
    return false;
  }
}

/* =========================================================================
 * In-memory store (fallback when Supabase tables don't exist).
 * Works on both server (Node.js API routes) and client.
 * ========================================================================= */

const _memoryStore = new Map<string, unknown[]>();

function loadStore<T>(key: string): T[] {
  return (_memoryStore.get(key) as T[]) ?? [];
}

function saveStore<T>(key: string, data: T[]): void {
  _memoryStore.set(key, data);
}

/* =========================================================================
 * Row Mappers
 * ========================================================================= */

function budgetFromRow(row: BudgetRow): FinanceBudget {
  return {
    id: row.id,
    brand: row.brand,
    brandId: row.brand_id ?? null,
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
    brandId: row.brand_id ?? null,
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
    brandId: row.brand_id ?? null,
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
 * Budgets CRUD
 * ========================================================================= */

export async function getBudgets(brand?: string, brandId?: string): Promise<FinanceBudget[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_budgets')) {
      let query = supabase
        .from('finance_budgets')
        .select('*')
        .order('period_label', { ascending: false });
      if (brandId) query = query.eq('brand_id', brandId);
      else if (brand) query = query.eq('brand', brand);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as BudgetRow[]).map(budgetFromRow);
      }
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  let budgets = loadStore<FinanceBudget>('budgets');
  if (brand) budgets = budgets.filter((b) => b.brand === brand);
  return budgets.sort((a, b) => b.periodLabel.localeCompare(a.periodLabel));
}

export async function createBudget(
  input: FinanceBudgetInput,
): Promise<FinanceBudget | null> {
  const now = new Date().toISOString();
  const id = `bud-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_budgets')) {
      const row = {
        id,
        brand: input.brand.trim(),
        brand_id: input.brandId ?? null,
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
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const budget: FinanceBudget = {
    id,
    brand: input.brand.trim(),
    period: input.period,
    periodLabel: input.periodLabel,
    amount: input.amount,
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const store = loadStore<FinanceBudget>('budgets');
  store.push(budget);
  saveStore('budgets', store);
  return budget;
}

export async function updateBudget(
  id: string,
  patch: Partial<FinanceBudgetInput>,
): Promise<FinanceBudget | null> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_budgets')) {
      const row: Record<string, unknown> = {};
      if (patch.brand !== undefined) row.brand = patch.brand.trim();
      if (patch.brandId !== undefined) row.brand_id = patch.brandId ?? null;
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
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceBudget>('budgets');
  const idx = store.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const updated = { ...store[idx], ...patch, updatedAt: new Date().toISOString() };
  store[idx] = updated as FinanceBudget;
  saveStore('budgets', store);
  return updated as FinanceBudget;
}

export async function deleteBudget(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_budgets')) {
      const { error } = await supabase.from('finance_budgets').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceBudget>('budgets');
  const filtered = store.filter((b) => b.id !== id);
  saveStore('budgets', filtered);
  return true;
}

/* =========================================================================
 * Expenses CRUD
 * ========================================================================= */

export async function getExpenses(brand?: string, brandId?: string): Promise<FinanceExpense[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expenses')) {
      let query = supabase
        .from('finance_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (brandId) query = query.eq('brand_id', brandId);
      else if (brand) query = query.eq('brand', brand);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as ExpenseRow[]).map(expenseFromRow);
      }
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  let expenses = loadStore<FinanceExpense>('expenses');
  if (brand) expenses = expenses.filter((e) => e.brand === brand);
  return expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
}

export async function getExpenseById(id: string): Promise<FinanceExpense | null> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expenses')) {
      const { data, error } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return expenseFromRow(data as unknown as ExpenseRow);
    }
  } catch {
    // Fall through
  }

  // localStorage fallback
  const store = loadStore<FinanceExpense>('expenses');
  return store.find((e) => e.id === id) ?? null;
}

export async function createExpense(
  input: FinanceExpenseInput,
): Promise<FinanceExpense | null> {
  const now = new Date().toISOString();
  const id = `exp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expenses')) {
      const row = {
        id,
        brand: input.brand.trim(),
        brand_id: input.brandId ?? null,
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
      if (input.allocations && input.allocations.length > 0) {
        await createAllocations(id, input.allocations);
      }
      return expenseFromRow(data as unknown as ExpenseRow);
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const expense: FinanceExpense = {
    id,
    brand: input.brand.trim(),
    expenseDate: input.expenseDate,
    amount: input.amount,
    category: input.category,
    campaignId: input.campaignId ?? null,
    description: input.description ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const store = loadStore<FinanceExpense>('expenses');
  store.push(expense);
  saveStore('expenses', store);

  // Save allocations to localStorage too
  if (input.allocations && input.allocations.length > 0) {
    const allocStore = loadStore<ExpenseAllocation>('allocations');
    for (const a of input.allocations) {
      allocStore.push({
        id: `alloc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${a.platform}`,
        expenseId: id,
        platform: a.platform,
        socialAccountId: a.socialAccountId ?? null,
        amount: a.amount,
        percentage: a.percentage ?? null,
        createdAt: now,
      });
    }
    saveStore('allocations', allocStore);
  }

  return expense;
}

export async function updateExpense(
  id: string,
  patch: Partial<FinanceExpenseInput>,
): Promise<FinanceExpense | null> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expenses')) {
      const row: Record<string, unknown> = {};
      if (patch.brand !== undefined) row.brand = patch.brand.trim();
      if (patch.brandId !== undefined) row.brand_id = patch.brandId ?? null;
      if (patch.expenseDate !== undefined) row.expense_date = patch.expenseDate;
      if (patch.amount !== undefined) row.amount = patch.amount;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
      if (patch.description !== undefined) row.description = patch.description;
      if (Object.keys(row).length === 0 && !patch.allocations) return null;
      if (Object.keys(row).length > 0) {
        const { error } = await supabase
          .from('finance_expenses')
          .update(row)
          .eq('id', id);
        if (error) throw error;
      }
      if (patch.allocations !== undefined) {
        await supabase
          .from('finance_expense_allocations')
          .delete()
          .eq('expense_id', id);
        if (patch.allocations.length > 0) {
          await createAllocations(id, patch.allocations);
        }
      }
      const { data, error } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return expenseFromRow(data as unknown as ExpenseRow);
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceExpense>('expenses');
  const idx = store.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated = { ...store[idx], ...patch, updatedAt: new Date().toISOString() } as FinanceExpense;
  store[idx] = updated;
  saveStore('expenses', store);
  return updated;
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expenses')) {
      const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceExpense>('expenses');
  saveStore('expenses', store.filter((e) => e.id !== id));
  // Also clean up allocations
  const allocStore = loadStore<ExpenseAllocation>('allocations');
  saveStore('allocations', allocStore.filter((a) => a.expenseId !== id));
  return true;
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
  const { error } = await supabase
    .from('finance_expense_allocations')
    .insert(rows);
  if (error) throw error;
}

export async function getAllocationsForExpense(
  expenseId: string,
): Promise<ExpenseAllocation[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expense_allocations')) {
      const { data, error } = await supabase
        .from('finance_expense_allocations')
        .select('*')
        .eq('expense_id', expenseId)
        .order('amount', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as AllocationRow[]).map(allocationFromRow);
      }
    }
  } catch {
    // Fall through
  }

  // localStorage fallback
  const allocs = loadStore<ExpenseAllocation>('allocations');
  return allocs
    .filter((a) => a.expenseId === expenseId)
    .sort((a, b) => b.amount - a.amount);
}

export async function getAllAllocations(
  brand?: string,
): Promise<ExpenseAllocation[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_expense_allocations')) {
      let query = supabase.from('finance_expense_allocations').select('*');
      if (brand) {
        const expenses = await getExpenses(brand);
        const expenseIds = expenses.map((e) => e.id);
        if (expenseIds.length === 0) return [];
        query = query.in('expense_id', expenseIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as AllocationRow[]).map(allocationFromRow);
      }
    }
  } catch {
    // Fall through
  }

  // localStorage fallback
  let allocs = loadStore<ExpenseAllocation>('allocations');
  if (brand) {
    const expenses = await getExpenses(brand);
    const expenseIds = new Set(expenses.map((e) => e.id));
    allocs = allocs.filter((a) => expenseIds.has(a.expenseId));
  }
  return allocs;
}

/* =========================================================================
 * Campaigns CRUD
 * ========================================================================= */

export async function getCampaigns(brand?: string, brandId?: string): Promise<FinanceCampaign[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_campaigns')) {
      let query = supabase
        .from('finance_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (brandId) query = query.eq('brand_id', brandId);
      else if (brand) query = query.eq('brand', brand);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as CampaignRow[]).map(campaignFromRow);
      }
    }
  } catch {
    // Fall through
  }

  // localStorage fallback
  let campaigns = loadStore<FinanceCampaign>('campaigns');
  if (brand) campaigns = campaigns.filter((c) => c.brand === brand);
  return campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCampaign(
  input: FinanceCampaignInput,
): Promise<FinanceCampaign | null> {
  const now = new Date().toISOString();
  const id = `cmp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_campaigns')) {
      const row = {
        id,
        brand: input.brand.trim(),
        brand_id: input.brandId ?? null,
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
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const campaign: FinanceCampaign = {
    id,
    brand: input.brand.trim(),
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    budget: input.budget,
    status: input.status ?? 'planned',
    description: input.description ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const store = loadStore<FinanceCampaign>('campaigns');
  store.push(campaign);
  saveStore('campaigns', store);
  return campaign;
}

export async function updateCampaign(
  id: string,
  patch: Partial<FinanceCampaignInput>,
): Promise<FinanceCampaign | null> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_campaigns')) {
      const row: Record<string, unknown> = {};
      if (patch.brand !== undefined) row.brand = patch.brand.trim();
      if (patch.brandId !== undefined) row.brand_id = patch.brandId ?? null;
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
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceCampaign>('campaigns');
  const idx = store.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...store[idx], ...patch, updatedAt: new Date().toISOString() } as FinanceCampaign;
  store[idx] = updated;
  saveStore('campaigns', store);
  return updated;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_campaigns')) {
      const { error } = await supabase.from('finance_campaigns').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  } catch {
    // Fall through to localStorage
  }

  // localStorage fallback
  const store = loadStore<FinanceCampaign>('campaigns');
  saveStore('campaigns', store.filter((c) => c.id !== id));
  return true;
}

/* =========================================================================
 * Brand Discovery (for filters)
 * ========================================================================= */

export async function getFinanceBrands(): Promise<string[]> {
  try {
    const supabase = await getSupabase();
    if (await checkSupabaseTable(supabase, 'finance_budgets')) {
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
    }
  } catch {
    // Fall through
  }

  // localStorage fallback
  const budgets = loadStore<FinanceBudget>('budgets');
  const expenses = loadStore<FinanceExpense>('expenses');
  const campaigns = loadStore<FinanceCampaign>('campaigns');
  const brands = new Set<string>();
  for (const b of budgets) brands.add(b.brand);
  for (const e of expenses) brands.add(e.brand);
  for (const c of campaigns) brands.add(c.brand);
  return [...brands].sort((a, b) => a.localeCompare(b, 'fa'));
}
