import type { ID, Timestamp } from '@/types/index';

/* =========================================================================
 * Brand
 * ========================================================================= */

export type BrandStatus = 'active' | 'inactive';

export const BRAND_STATUS_LABELS: Record<BrandStatus, string> = {
  active: 'فعال',
  inactive: 'غیرفعال',
};

export interface Brand {
  id: ID;
  workspaceId: ID;
  name: string;
  slug: string;
  status: BrandStatus;
  logoUrl: string | null;
  color: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BrandInput {
  name: string;
  slug?: string;
  status?: BrandStatus;
  logoUrl?: string | null;
  color?: string | null;
}

/* =========================================================================
 * Row types (Supabase snake_case)
 * ========================================================================= */

export interface BrandRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: BrandStatus;
  logo_url: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/* =========================================================================
 * Service Result Types
 * ========================================================================= */

export type BrandResult =
  | { ok: true; brand: Brand }
  | { ok: false; errorCode: string; errorMessage: string };

export type BrandListResult =
  | { ok: true; brands: Brand[] }
  | { ok: false; errorCode: string; errorMessage: string };
