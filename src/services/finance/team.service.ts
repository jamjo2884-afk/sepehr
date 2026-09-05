/**
 * Team CRUD Service
 *
 * Full CRUD for team members and brand allocations.
 * Uses Supabase with in-memory fallback when tables don't exist.
 * All writes go through this service — the client never touches Supabase directly.
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
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

function allocationFromRow(row: BrandAllocationRow, brandNames?: Map<string, string>): BrandAllocation {
  const brandId = row.brand_id ?? null;
  return {
    id: row.id,
    teamMemberId: row.team_member_id,
    brand: (brandId && brandNames?.get(brandId)) ?? '',
    brandId,
    allocationPercentage: Number(row.allocation_percentage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
 * In-memory store (fallback when Supabase tables don't exist)
 * ========================================================================= */



const _memberStore: TeamMemberWithAllocations[] = [];

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
      // Filter by brand through allocations (prefer brand_id if available)
      const { resolveBrandId: resolve } = await import('@/services/brand.service');
      const resolvedId = await resolve(brand);
      const allocQuery = await supabase
        .from('team_member_brand_allocations')
        .select('team_member_id')
        .eq(resolvedId ? 'brand_id' : 'brand', resolvedId ?? brand);
      const memberIds = (allocQuery.data ?? []).map(
        (r: { team_member_id: string }) => r.team_member_id,
      );
      if (memberIds.length === 0) return [];
      query = query.in('id', memberIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      // Check if table simply doesn't exist vs empty
      if (!(await isTableAvailable('team_members'))) {
        return _memberStore;
      }
      return [];
    }

    // Fetch all allocations in one query (no N+1)
    const memberIds = (data as unknown as TeamMemberRow[]).map((r) => r.id);
    const { data: allocData } = await supabase
      .from('team_member_brand_allocations')
      .select('*')
      .in('team_member_id', memberIds);

    const allocRows = (allocData ?? []) as unknown as BrandAllocationRow[];
    const { resolveBrandNames } = await import('@/services/brand.service');
    const brandIds = allocRows.map((r) => r.brand_id).filter((id): id is string => !!id);
    const brandNames = await resolveBrandNames(brandIds);

    const allocsByMember = new Map<string, BrandAllocationRow[]>();
    for (const row of allocRows) {
      const list = allocsByMember.get(row.team_member_id) ?? [];
      list.push(row);
      allocsByMember.set(row.team_member_id, list);
    }

    return (data as unknown as TeamMemberRow[]).map((row) => {
      const member = memberFromRow(row);
      const allocs = (allocsByMember.get(row.id) ?? []).map((r) => allocationFromRow(r, brandNames));
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
    console.warn('[team] Could not read members, falling back to in-memory store.', err);
    return _memberStore;
  }
}

export async function createTeamMember(
  input: TeamMemberInput,
): Promise<TeamMember | null> {
  const id = `tm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('team_members')) {
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
    }
  } catch {
    // Fall through to in-memory store
  }

  // In-memory fallback
  const member: TeamMemberWithAllocations = {
    id,
    name: input.name.trim(),
    employmentType: input.employmentType,
    monthlyCost: input.monthlyCost,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    status: input.status ?? 'active',
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
    allocations: (input.allocations ?? []).map((a) => ({
      id: `ta-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${a.brand.replace(/\s+/g, '')}`,
      teamMemberId: id,
      brand: a.brand,
      allocationPercentage: a.allocationPercentage,
      createdAt: now,
      updatedAt: now,
    })),
    totalAllocated: (input.allocations ?? []).reduce((s, a) => s + a.allocationPercentage, 0),
    unallocatedPercent: Math.max(0, 100 - (input.allocations ?? []).reduce((s, a) => s + a.allocationPercentage, 0)),
  };
  _memberStore.push(member);
  return member;
}

export async function updateTeamMember(
  id: string,
  patch: Partial<TeamMemberInput>,
): Promise<TeamMember | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('team_members')) {
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
    }
  } catch {
    // Fall through to in-memory store
  }

  // In-memory fallback
  const idx = _memberStore.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const existing = _memberStore[idx];
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() } as TeamMemberWithAllocations;
  if (patch.allocations !== undefined) {
    const now = new Date().toISOString();
    updated.allocations = patch.allocations.map((a) => ({
      id: `ta-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${a.brand.replace(/\s+/g, '')}`,
      teamMemberId: id,
      brand: a.brand,
      allocationPercentage: a.allocationPercentage,
      createdAt: now,
      updatedAt: now,
    }));
    updated.totalAllocated = updated.allocations.reduce((s, a) => s + a.allocationPercentage, 0);
    updated.unallocatedPercent = Math.max(0, 100 - updated.totalAllocated);
  }
  _memberStore[idx] = updated;
  return updated;
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('team_members')) {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  } catch {
    // Fall through
  }

  // In-memory fallback
  const idx = _memberStore.findIndex((m) => m.id === id);
  if (idx !== -1) _memberStore.splice(idx, 1);
  return true;
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
    team_member_id: memberId,        brand_id: a.brandId ?? null,
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
    if (await isTableAvailable('team_member_brand_allocations')) {
      const { data } = await supabase
        .from('team_member_brand_allocations')
        .select('brand_id');
      if (data && data.length > 0) {
        const brandIds = [...new Set(
          (data as { brand_id: string | null }[])
            .map((r) => r.brand_id)
            .filter((id): id is string => !!id),
        )];
        if (brandIds.length > 0) {
          const { data: brandsData } = await supabase
            .from('brands')
            .select('id, name')
            .in('id', brandIds)
            .eq('status', 'active');
          if (brandsData && brandsData.length > 0) {
            const nameMap = new Map(
              (brandsData as { id: string; name: string }[]).map((b) => [b.id, b.name]),
            );
            const brands = brandIds
              .map((id) => nameMap.get(id))
              .filter((n): n is string => !!n);
            return [...new Set(brands)].sort((a, b) => a.localeCompare(b, 'fa'));
          }
        }
      }
    }
  } catch {
    // Fall through
  }

  // In-memory fallback
  const brands = new Set<string>();
  for (const m of _memberStore) {
    for (const a of m.allocations ?? []) brands.add(a.brand);
  }
  return [...brands].sort((a, b) => a.localeCompare(b, 'fa'));
}
