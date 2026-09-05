/**
 * Brand CRUD Service
 *
 * Manages brands within a workspace.
 * Uses Supabase with in-memory fallback when tables don't exist.
 * All writes go through this service — the client never touches Supabase directly.
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import type {
  Brand,
  BrandInput,
  BrandRow,
  BrandStatus,
} from '@/types/brand';

/* =========================================================================
 * Helpers
 * ========================================================================= */

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}



/**
 * Resolve a brand name to its UUID id within the current workspace.
 * Returns null when the brand is not found or Supabase is unavailable.
 */
export async function resolveBrandId(
  brandName: string,
  workspaceId?: string | null,
): Promise<string | null> {
  try {
    const supabase = await getSupabase();
    if (!(await isTableAvailable('brands'))) return null;
    let query = supabase
      .from('brands')
      .select('id')
      .eq('name', brandName.trim())
      .eq('status', 'active')
      .limit(1);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;
    return data[0].id as string;
  } catch {
    return null;
  }
}

/**
 * Resolve multiple brand names to their UUID ids in a single query.
 * Returns a Map<brandName, brandId> for found brands.
 */
export async function resolveBrandIds(
  brandNames: string[],
  workspaceId?: string | null,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (brandNames.length === 0) return result;
  try {
    const supabase = await getSupabase();
    if (!(await isTableAvailable('brands'))) return result;
    let query = supabase
      .from('brands')
      .select('id, name')
      .in('name', brandNames.map((n) => n.trim()))
      .eq('status', 'active');
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { data, error } = await query;
    if (error || !data) return result;
    for (const row of data) {
      result.set(row.name as string, row.id as string);
    }
    return result;
  } catch {
    return result;
  }
}

/**
 * Resolve multiple brand UUID ids to their display names.
 * Returns a Map<brandId, brandName> for found brands.
 */
export async function resolveBrandNames(
  brandIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueIds = [...new Set(brandIds.filter((id) => !!id))];
  if (uniqueIds.length === 0) return result;
  try {
    const supabase = await getSupabase();
    if (!(await isTableAvailable('brands'))) {
      // Fallback: fetch all brands and build the map
      const brands = await getBrands();
      for (const b of brands) result.set(b.id, b.name);
      return result;
    }
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .in('id', uniqueIds);
    if (error || !data) {
      // Fallback: fetch all brands
      const brands = await getBrands();
      for (const b of brands) result.set(b.id, b.name);
      return result;
    }
    for (const row of data) {
      result.set(row.id as string, row.name as string);
    }
    // If some IDs are still missing, try full brand list
    const missing = uniqueIds.filter((id) => !result.has(id));
    if (missing.length > 0) {
      const brands = await getBrands();
      for (const b of brands) {
        if (missing.includes(b.id)) result.set(b.id, b.name);
      }
    }
    return result;
  } catch {
    // Last resort: fetch all brands
    try {
      const brands = await getBrands();
      for (const b of brands) result.set(b.id, b.name);
    } catch {
      // Give up
    }
    return result;
  }
}



/* =========================================================================
 * In-memory store (fallback when Supabase tables don't exist)
 * ========================================================================= */

const _memoryStore: Brand[] = [];

/* =========================================================================
 * Row Mapper
 * ========================================================================= */

function brandFromRow(row: BrandRow): Brand {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    slug: row.slug,
    status: row.status as BrandStatus,
    logoUrl: row.logo_url,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
 * Get Default Workspace ID
 * ========================================================================= */

async function getDefaultWorkspaceId(supabase: Awaited<ReturnType<typeof getSupabase>>): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

/* =========================================================================
 * Brands CRUD
 * ========================================================================= */

export async function getBrands(workspaceId?: string): Promise<Brand[]> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brands')) {
      let query = supabase
        .from('brands')
        .select('*')
        .order('name', { ascending: true });

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as BrandRow[]).map(brandFromRow);
      }
    }
  } catch {
    // Fall through to in-memory store
  }

  // In-memory fallback
  if (workspaceId) {
    return _memoryStore.filter((b) => b.workspaceId === workspaceId);
  }
  return [..._memoryStore];
}

export async function getBrandById(id: string): Promise<Brand | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brands')) {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return brandFromRow(data as unknown as BrandRow);
    }
  } catch {
    // Fall through
  }

  // In-memory fallback
  return _memoryStore.find((b) => b.id === id) ?? null;
}

export async function getBrandByName(
  name: string,
  workspaceId?: string,
): Promise<Brand | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brands')) {
      let query = supabase
        .from('brands')
        .select('*')
        .eq('name', name.trim())
        .single();

      if (workspaceId) {
        // Add workspace filter via nested condition
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq('name', name.trim())
          .eq('workspace_id', workspaceId)
          .single();
        if (error) throw error;
        return brandFromRow(data as unknown as BrandRow);
      }

      const { data, error } = await query;
      if (error) throw error;
      return brandFromRow(data as unknown as BrandRow);
    }
  } catch {
    // Fall through
  }

  // In-memory fallback
  return _memoryStore.find(
    (b) =>
      b.name === name.trim() &&
      (!workspaceId || b.workspaceId === workspaceId),
  ) ?? null;
}

export async function createBrand(
  input: BrandInput,
  workspaceId?: string,
): Promise<Brand | null> {
  const now = new Date().toISOString();

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brands')) {
      // Get workspace ID if not provided
      let wsId: string | undefined = workspaceId;
      if (!wsId) {
        const found = await getDefaultWorkspaceId(supabase);
        if (!found) {
          console.warn('[brand] No workspace found for brand creation.');
          return null;
        }
        wsId = found;
      }

      const slug = input.slug || generateSlug(input.name);
      const row = {
        workspace_id: wsId,
        name: input.name.trim(),
        slug,
        status: input.status ?? 'active',
        logo_url: input.logoUrl ?? null,
        color: input.color ?? null,
      };

      const { data, error } = await supabase
        .from('brands')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return brandFromRow(data as unknown as BrandRow);
    }
  } catch {
    // Fall through to in-memory store
  }

  // In-memory fallback
  const brand: Brand = {
    id: `brand-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: workspaceId ?? 'demo-workspace',
    name: input.name.trim(),
    slug: input.slug || generateSlug(input.name),
    status: input.status ?? 'active',
    logoUrl: input.logoUrl ?? null,
    color: input.color ?? null,
    createdAt: now,
    updatedAt: now,
  };
  _memoryStore.push(brand);
  return brand;
}

export async function updateBrand(
  id: string,
  patch: Partial<BrandInput>,
): Promise<Brand | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('brands')) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
      if (patch.color !== undefined) row.color = patch.color;
      if (Object.keys(row).length === 0) return null;

      const { data, error } = await supabase
        .from('brands')
        .update(row)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return brandFromRow(data as unknown as BrandRow);
    }
  } catch {
    // Fall through to in-memory store
  }

  // In-memory fallback
  const idx = _memoryStore.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const updated = {
    ..._memoryStore[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  } as Brand;
  _memoryStore[idx] = updated;
  return updated;
}

export async function deleteBrand(id: string): Promise<boolean> {
  // Soft-delete: set status to inactive instead of removing the row.
  // This preserves historical references from finance, team, and social tables.
  return updateBrand(id, { status: 'inactive' }).then((b) => b !== null);
}

/**
 * Get or create a brand by name.
 * Useful during data migration when we need to ensure a brand exists.
 */
export async function getOrCreateBrand(
  name: string,
  workspaceId?: string,
): Promise<Brand | null> {
  const existing = await getBrandByName(name, workspaceId);
  if (existing) return existing;
  return createBrand({ name }, workspaceId);
}

/**
 * Get all brand names as strings (for backward compatibility with existing code).
 */
export async function getBrandNames(workspaceId?: string): Promise<string[]> {
  const brands = await getBrands(workspaceId);
  return brands.map((b) => b.name);
}
