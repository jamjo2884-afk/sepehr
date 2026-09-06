import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Team Workload Service tests.
 *
 * Verifies FlowBoard task workload (real card counts) and finance team
 * cost workload are returned side by side with honest empty fallbacks.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

const mockGetCurrentUser = vi.fn();
const mockMemberFindFirst = vi.fn();
const mockBoardMemberFindMany = vi.fn();
const mockCardMemberCount = vi.fn();

vi.mock('@/lib/flowboard/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/flowboard/db', () => ({
  prisma: {
    flowWorkspaceMember: { findFirst: mockMemberFindFirst },
    flowBoardMember: { findMany: mockBoardMemberFindMany },
    flowCardMember: { count: mockCardMemberCount },
  },
}));

vi.mock('@/services/finance/team.service', () => ({
  getTeamMembers: vi.fn(async () => [
    {
      id: 'tm-1',
      name: 'سارا',
      employmentType: 'full_time',
      monthlyCost: 40_000_000,
      totalAllocated: 80,
      unallocatedPercent: 20,
      allocations: [
        { id: 'a1', teamMemberId: 'tm-1', brand: 'ازما', brandId: 'b1', allocationPercentage: 80, createdAt: '', updatedAt: '' },
      ],
    },
  ]),
}));

import { getTeamWorkload } from '@/services/team-workload.service';

describe('getTeamWorkload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('1. returns empty lists when there is no flow user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const workload = await getTeamWorkload();
    expect(workload.tasks).toEqual([]);
    expect(workload.costs).toHaveLength(1); // finance team still real
  });

  it('2. returns empty tasks when the user has no workspace membership', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'u1@x.com', name: 'u1', avatarUrl: null });
    mockMemberFindFirst.mockResolvedValue(null);
    const workload = await getTeamWorkload();
    expect(workload.tasks).toEqual([]);
  });

  it('3. aggregates real open/overdue card counts per board member', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'u1@x.com', name: 'u1', avatarUrl: null });
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'flow-ws' });
    mockBoardMemberFindMany.mockResolvedValue([
      { userId: 'u1', user: { id: 'u1', name: 'علی', avatarUrl: null } },
      { userId: 'u2', user: { id: 'u2', name: 'مریم', avatarUrl: null } },
    ]);
    // counts: [u1 open, u1 overdue, u2 open, u2 overdue]
    mockCardMemberCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);

    const workload = await getTeamWorkload();
    expect(workload.tasks).toHaveLength(2);
    const ali = workload.tasks.find((t) => t.id === 'u1');
    expect(ali).toMatchObject({ name: 'علی', openCards: 5, overdueCards: 1 });
    const maryam = workload.tasks.find((t) => t.id === 'u2');
    expect(maryam).toMatchObject({ name: 'مریم', openCards: 2, overdueCards: 0 });
  });

  it('4. tolerates FlowBoard failure and still returns finance workload', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('db down'));
    const workload = await getTeamWorkload();
    expect(workload.tasks).toEqual([]);
    expect(workload.costs).toHaveLength(1);
    expect(workload.costs[0].allocations[0]).toMatchObject({
      brand: 'ازما',
      brandId: 'b1',
      percentage: 80,
    });
  });

  it('5. finance workload maps allocation percentages correctly', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const workload = await getTeamWorkload();
    expect(workload.costs[0]).toMatchObject({
      name: 'سارا',
      employmentType: 'full_time',
      monthlyCost: 40_000_000,
      totalAllocated: 80,
      unallocatedPercent: 20,
    });
  });
});
