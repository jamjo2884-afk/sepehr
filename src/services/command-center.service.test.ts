import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Command Center Service tests.
 *
 * Verifies the dashboard aggregates REAL module data: workspace-scoped
 * brands/contents, task stats from FlowBoard, finance totals, attention
 * items and honest empty results (never fabricated numbers).
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

const mockGetCurrentUser = vi.fn();
const mockFindFirst = vi.fn();
const mockCount = vi.fn();

vi.mock('@/lib/flowboard/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/flowboard/db', () => ({
  prisma: {
    flowWorkspaceMember: { findFirst: mockFindFirst },
    flowCard: { count: mockCount },
  },
}));

import { getCommandCenterData, getTaskStats } from '@/services/command-center.service';
import { createContent, transitionContentStatus } from '@/services/content.service';

const WS = 'ws-1';
const USER = 'user-1';

describe('getTaskStats (FlowBoard)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('1. returns zeros when there is no flow user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const stats = await getTaskStats();
    expect(stats).toEqual({
      openTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      completedThisWeek: 0,
    });
  });

  it('2. returns zeros when the user has no workspace membership', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'u1@x.com', name: 'u1', avatarUrl: null });
    mockFindFirst.mockResolvedValue(null);
    const stats = await getTaskStats();
    expect(stats).toEqual({
      openTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      completedThisWeek: 0,
    });
  });

  it('3. aggregates the four task KPIs from real counts', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'u1@x.com', name: 'u1', avatarUrl: null });
    mockFindFirst.mockResolvedValue({ workspaceId: 'flow-ws' });
    mockCount
      .mockResolvedValueOnce(12) // open
      .mockResolvedValueOnce(3) // overdue
      .mockResolvedValueOnce(5) // due soon
      .mockResolvedValueOnce(7); // completed this week

    const stats = await getTaskStats();
    expect(stats).toEqual({
      openTasks: 12,
      overdueTasks: 3,
      dueSoonTasks: 5,
      completedThisWeek: 7,
    });
  });

  it('4. tolerates FlowBoard failures with zeros (dashboard never breaks)', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('db down'));
    const stats = await getTaskStats();
    expect(stats).toEqual({
      openTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      completedThisWeek: 0,
    });
  });
});

describe('getCommandCenterData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
  });

  it('5. returns honest empty pipeline and zero KPIs with no data', async () => {
    const data = await getCommandCenterData({ workspaceId: 'ws-empty', userId: USER });

    expect(data.kpis.brandCount).toBe(0);
    expect(data.kpis.contentCount).toBe(0);
    expect(data.kpis.totalBudget).toBe(0);
    expect(data.kpis.totalSpent).toBe(0);
    expect(data.kpis.remainingBudget).toBe(0);
    expect(data.pipeline).toHaveLength(8);
    expect(data.pipeline.every((p) => p.count === 0)).toBe(true);
    expect(data.attention).toEqual([]);
    expect(data.recentActivity).toEqual([]);
  });

  it('6. aggregates real contents into the pipeline and attention center', async () => {
    const c1 = await createContent({ title: 'پیش‌نویس ۱' }, 'ws-a', USER);
    const c2 = await createContent({ title: 'بازبینی ۱' }, 'ws-a', USER);
    await transitionContentStatus(c2!.id, 'review', 'ws-a', USER);

    const data = await getCommandCenterData({ workspaceId: 'ws-a', userId: USER });

    expect(data.kpis.contentCount).toBe(2);
    const byStatus = Object.fromEntries(
      data.pipeline.map((p) => [p.status, p.count]),
    );
    expect(byStatus.draft).toBe(1);
    expect(byStatus.review).toBe(1);

    const reviewAttention = data.attention.find(
      (a) => a.kind === 'content_review',
    );
    expect(reviewAttention).toBeDefined();
    expect(reviewAttention!.title).toContain('۱ محتوا');
    expect(reviewAttention!.href).toBe('/content?status=review');

    // No fabricated task numbers when FlowBoard is empty
    expect(data.tasks.openTasks).toBe(0);
  });

  it('7. recent activity is sourced from audit logs (never mock)', async () => {
    const c = await createContent({ title: 'فعالیت ۱' }, 'ws-b', USER);
    await transitionContentStatus(c!.id, 'review', 'ws-b', USER);
    // recordAudit is fire-and-forget; flush pending microtasks so the
    // in-memory audit entries land before we assert on them.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await getCommandCenterData({ workspaceId: 'ws-b', userId: USER });
    expect(data.recentActivity.length).toBeGreaterThanOrEqual(2);
    expect(
      data.recentActivity.some((a) => a.description.includes('فعالیت ۱')),
    ).toBe(true);
  });

  it('8. content in the other workspace never leaks into this dashboard', async () => {
    await createContent({ title: 'محتوای فضای دیگر' }, 'ws-other', USER);

    const data = await getCommandCenterData({ workspaceId: 'ws-c', userId: USER });
    expect(data.kpis.contentCount).toBe(0);
  });
});