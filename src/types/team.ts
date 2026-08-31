import type { ID, Timestamp } from '@/types/index';

/* =========================================================================
 * Employment Type
 * ========================================================================= */

export type EmploymentType = 'full_time' | 'part_time' | 'project' | 'intern';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'تمام‌وقت',
  part_time: 'پاره‌وقت',
  project: 'پروژه‌ای',
  intern: 'کارآموز',
};

/* =========================================================================
 * Team Member Status
 * ========================================================================= */

export type TeamMemberStatus = 'active' | 'inactive';

export const TEAM_MEMBER_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  active: 'فعال',
  inactive: 'غیرفعال',
};

/* =========================================================================
 * Team Member
 * ========================================================================= */

export interface TeamMember {
  id: ID;
  name: string;
  employmentType: EmploymentType;
  monthlyCost: number;
  startDate: string;
  endDate: string | null;
  status: TeamMemberStatus;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeamMemberInput {
  name: string;
  employmentType: EmploymentType;
  monthlyCost: number;
  startDate: string;
  endDate?: string | null;
  status?: TeamMemberStatus;
  notes?: string;
  allocations?: BrandAllocationInput[];
}

/* =========================================================================
 * Brand Allocation
 * ========================================================================= */

export interface BrandAllocation {
  id: ID;
  teamMemberId: ID;
  brand: string;
  /** Canonical brand reference — may be absent during transition. */
  brandId?: string | null;
  allocationPercentage: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BrandAllocationInput {
  brand: string;
  brandId?: string | null;
  allocationPercentage: number;
}

/* =========================================================================
 * Analytics Types
 * ========================================================================= */

export interface TeamKpis {
  totalMembers: number;
  fullTimeCount: number;
  partTimeCount: number;
  projectCount: number;
  internCount: number;
  activeCount: number;
  monthlyHumanCostTotal: number;
}

export interface TeamMemberWithAllocations extends TeamMember {
  allocations: BrandAllocation[];
  totalAllocated: number;
  unallocatedPercent: number;
}

export interface BrandHumanCost {
  brand: string;
  brandId?: string | null;
  humanCost: number;
  memberCount: number;
}

export interface BrandTotalCost {
  brand: string;
  brandId?: string | null;
  operationalCost: number;
  humanCost: number;
  totalCost: number;
  followerGrowth: number;
  costPerNewFollower: number | null;
  humanCostPerNewFollower: number | null;
  totalCostPerNewFollower: number | null;
  growthStatus: 'positive' | 'negative' | 'zero' | 'no_data';
}

/* =========================================================================
 * Row types (Supabase snake_case)
 * ========================================================================= */

export interface TeamMemberRow {
  id: string;
  name: string;
  employment_type: EmploymentType;
  monthly_cost: number;
  start_date: string;
  end_date: string | null;
  status: TeamMemberStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BrandAllocationRow {
  id: string;
  team_member_id: string;
  brand_id: string | null;
  allocation_percentage: number;
  created_at: string;
  updated_at: string;
}
