/**
 * Team CRUD Service
 *
 * Full CRUD for team members and brand allocations.
 * Reads from Supabase with mock data fallback (same pattern as finance).
 * All writes go through this service — the client never touches Supabase directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TeamMember,
  TeamMemberInput,
  TeamMemberWithAllocations,
  BrandAllocation,
  BrandAllocationInput,
  TeamMemberRow,
  BrandAllocationRow,
  EmploymentType,
  TeamMemberStatus,
} from '@/types/team';

/* =========================================================================
 * Helpers
 * ========================================================================= */

async function getSupabase(): Promise<SupabaseClient> {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/* =========================================================================
 * Row Mappers
 * ========================================================================= */

function memberFromRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    employmentType: row.employment_type as EmploymentType,
    monthlyCost: Number(row.monthly_cost),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as TeamMemberStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function allocationFromRow(row: BrandAllocationRow): BrandAllocation {
  return {
    id: row.id,
    teamMemberId: row.team_member_id,
    brand: row.brand,
    allocationPercentage: Number(row.allocation_percentage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
 * Mock Data
 * ========================================================================= */

const MOCK_MEMBERS: TeamMemberWithAllocations[] = [];

/* =========================================================================
 * Team Members CRUD
 * ========================================================================= */

export async function getTeamMembers(
  brand?: string,
): Promise<TeamMemberWithAllocations[]> {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from('team_members')
      .select('*')
      .order('name', { ascending: true });
    if (brand) {
      // Filter by brand through allocations
      const allocQuery = await supabase
        .from('team_member_brand_allocations')
        .select('team_member_id')
        .eq('brand', brand);
      const memberIds = (allocQuery.data ?? []).map(
        (r: { team_member_id: string }) => r.team_member_id,
      );
      if (memberIds.length === 0) return [];
      query = query.in('id', memberIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_MEMBERS;

    // Fetch all allocations in one query (no N+1)
    const memberIds = (data as unknown as TeamMemberRow[]).map((r) => r.id);
    const { data: allocData } = await supabase
      .from('team_member_brand_allocations')
      .select('*')
      .in('team_member_id', memberIds);

    const allocsByMember = new Map<string, BrandAllocationRow[]>();
    for (const row of (allocData ?? []) as unknown as BrandAllocationRow[]) {
      const list = allocsByMember.get(row.team_member_id) ?? [];
      list.push(row);
      allocsByMember.set(row.team_member_id, list);
    }

    return (data as unknown as TeamMemberRow[]).map((row) => {
      const member = memberFromRow(row);
      const allocs = (allocsByMember.get(row.id) ?? []).map(allocationFromRow);
      const totalAllocated = allocs.reduce(
        (sum, a) => sum + a.allocationPercentage,
        0,
      );
      return {
        ...member,
        allocations: allocs,
        totalAllocated,
        unallocatedPercent: Math.max(0, 100 - totalAllocated),
      };
    });
  } catch (err) {
    console.warn('[team] Could not read members, falling back to mock.', err);
    return MOCK_MEMBERS;
  }
}

export async function createTeamMember(
  input: TeamMemberInput,
): Promise<TeamMember | null> {
  try {
    const supabase = await getSupabase();
    const id = `tm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id,
      name: input.name.trim(),
      employment_type: input.employmentType,
      monthly_cost: input.monthlyCost,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      status: input.status ?? 'active',
      notes: input.notes ?? '',
    };
    const { data, error } = await supabase
      .from('team_members')
      .insert(row)
      .select()
      .single();
    if (error) throw error;

    // Insert allocations if provided
    if (input.allocations && input.allocations.length > 0) {
      await createAllocations(id, input.allocations);
    }

    return memberFromRow(data as unknown as TeamMemberRow);
  } catch (err) {
    console.warn('[team] Could not create member.', err);
    return null;
  }
}

export async function updateTeamMember(
  id: string,
  patch: Partial<TeamMemberInput>,
): Promise<TeamMember | null> {
  try {
    const supabase = await getSupabase();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.employmentType !== undefined)
      row.employment_type = patch.employmentType;
    if (patch.monthlyCost !== undefined) row.monthly_cost = patch.monthlyCost;
    if (patch.startDate !== undefined) row.start_date = patch.startDate;
    if (patch.endDate !== undefined) row.end_date = patch.endDate ?? null;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (Object.keys(row).length === 0 && !patch.allocations) return null;

    if (Object.keys(row).length > 0) {
      const { error } = await supabase
        .from('team_members')
        .update(row)
        .eq('id', id);
      if (error) throw error;
    }

    // Replace allocations if provided
    if (patch.allocations !== undefined) {
      await supabase
        .from('team_member_brand_allocations')
        .delete()
        .eq('team_member_id', id);
      if (patch.allocations.length > 0) {
        await createAllocations(id, patch.allocations);
      }
    }

    // Fetch updated member
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return memberFromRow(data as unknown as TeamMemberRow);
  } catch (err) {
    console.warn('[team] Could not update member.', err);
    return null;
  }
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[team] Could not delete member.', err);
    return false;
  }
}

/* =========================================================================
 * Allocations CRUD
 * ========================================================================= */

async function createAllocations(
  memberId: string,
  allocations: BrandAllocationInput[],
): Promise<void> {
  const supabase = await getSupabase();
  const rows = allocations.map((a) => ({
    id: `ta-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${a.brand.replace(/\s+/g, '')}`,
    team_member_id: memberId,
    brand: a.brand,
    allocation_percentage: a.allocationPercentage,
  }));
  const { error } = await supabase
    .from('team_member_brand_allocations')
    .insert(rows);
  if (error) throw error;
}

/* =========================================================================
 * Brand Discovery
 * ========================================================================= */

export async function getTeamBrands(): Promise<string[]> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('team_member_brand_allocations')
      .select('brand');
    if (!data || data.length === 0) return [];
    const brands = new Set(
      (data as { brand: string }[]).map((r) => r.brand),
    );
    return [...brands].sort((a, b) => a.localeCompare(b, 'fa'));
  } catch {
    return [];
  }
}
