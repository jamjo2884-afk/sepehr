/**
 * Team Workload Service (Phase 23 — Operational Layer)
 *
 * Joins the two people-datasets Media Deck already has:
 *
 * 1. FlowBoard users (Prisma) — assigned cards per member:
 *    open / overdue counts from real flow_card_members rows.
 * 2. Finance team (team_members + team_member_brand_allocations) —
 *    monthly cost and brand allocation percentages.
 *
 * The datasets are returned side by side (NOT merged by name — matching
 * them heuristically would be guesswork). The UI renders them as two
 * sections of the same "workload" view.
 *
 * No fabricated numbers: sources with no data yield honest empty lists.
 */

import { getTeamMembers } from '@/services/finance/team.service';
import type { TeamMemberWithAllocations } from '@/types/team';

export interface TaskWorkloadMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  openCards: number;
  overdueCards: number;
}

export interface CostWorkloadMember {
  id: string;
  name: string;
  employmentType: string;
  monthlyCost: number;
  totalAllocated: number;
  unallocatedPercent: number;
  allocations: Array<{ brand: string; brandId: string | null; percentage: number }>;
}

export interface TeamWorkload {
  tasks: TaskWorkloadMember[];
  costs: CostWorkloadMember[];
}

export async function getTeamWorkload(): Promise<TeamWorkload> {
  const [taskMembers, financeMembers] = await Promise.all([
    getTaskWorkload(),
    getCostWorkload(),
  ]);
  return { tasks: taskMembers, costs: financeMembers };
}

/** FlowBoard assigned-card workload per member (real card counts). */
async function getTaskWorkload(): Promise<TaskWorkloadMember[]> {
  try {
    const [{ getCurrentUser }, { prisma }] = await Promise.all([
      import('@/lib/flowboard/auth'),
      import('@/lib/flowboard/db'),
    ]);
    const user = await getCurrentUser();
    if (!user) return [];

    const membership = await prisma.flowWorkspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return [];
    const workspaceId = membership.workspaceId;

    // All members of the workspace's boards that have card assignments.
    const boardMembers = await prisma.flowBoardMember.findMany({
      where: { board: { workspaceId, isArchived: false } },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      distinct: ['userId'],
    });
    if (boardMembers.length === 0) return [];

    const now = new Date();
    const members: TaskWorkloadMember[] = [];

    for (const bm of boardMembers) {
      const base = {
        card: {
          board: { workspaceId, isArchived: false },
          isArchived: false,
        },
        userId: bm.userId,
      };
      const [openCards, overdueCards] = await Promise.all([
        prisma.flowCardMember.count({
          where: { ...base, card: { ...base.card, isCompleted: false } },
        }),
        prisma.flowCardMember.count({
          where: {
            ...base,
            card: { ...base.card, isCompleted: false, dueDate: { lt: now } },
          },
        }),
      ]);
      members.push({
        id: bm.user.id,
        name: bm.user.name,
        avatarUrl: bm.user.avatarUrl,
        openCards,
        overdueCards,
      });
    }

    return members;
  } catch (err) {
    console.warn('[team-workload] Could not read FlowBoard workload:', err);
    return [];
  }
}

/** Finance-side workload: monthly cost + brand allocation percentages. */
async function getCostWorkload(): Promise<CostWorkloadMember[]> {
  try {
    const members = await getTeamMembers();
    return members.map((m: TeamMemberWithAllocations) => ({
      id: m.id,
      name: m.name,
      employmentType: m.employmentType,
      monthlyCost: m.monthlyCost,
      totalAllocated: m.totalAllocated,
      unallocatedPercent: m.unallocatedPercent,
      allocations: m.allocations.map((a) => ({
        brand: a.brand,
        brandId: a.brandId ?? null,
        percentage: a.allocationPercentage,
      })),
    }));
  } catch (err) {
    console.warn('[team-workload] Could not read finance team:', err);
    return [];
  }
}