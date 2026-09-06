/**
 * Command Center Service (Phase 23)
 *
 * Aggregates REAL data from every internal Media Deck module for the
 * /command-center dashboard:
 *
 *   brands      → brands table (workspace-scoped)
 *   content     → contents table (workspace-scoped)
 *   tasks       → FlowBoard (Prisma) cards
 *   finance     → finance budgets / expenses
 *   social      → social_accounts + social_metrics (latest followers)
 *   audit       → audit_logs recent activity
 *   attention   → due-soon/overdue tasks, contents pending review,
 *                 unread notifications
 *
 * No hardcoded or mock numbers are ever produced in production. Every
 * subsection returns honest zeros/empty when the source has no data.
 * Demo-mode fallbacks only exist inside the underlying services (and only
 * when `isDemoMode()` is active), never here.
 */

import { getBrands } from '@/services/brand.service';
import { getContents } from '@/services/content.service';
import { getFinanceDashboardData } from '@/services/finance/finance-analytics.service';
import { getAuditLogs } from '@/services/audit.service';
import {
  getNotifications,
  getUnreadCount,
} from '@/services/notification.service';
import { CONTENT_STATUS_LABELS, type ContentStatus } from '@/types/content';

/* =========================================================================
 * Task stats (FlowBoard via Prisma — dynamic import so the rest of the
 * dashboard keeps working even when the FlowBoard database is unreachable)
 * ========================================================================= */

export interface TaskStats {
  openTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  completedThisWeek: number;
}

const ZERO_TASKS: TaskStats = {
  openTasks: 0,
  overdueTasks: 0,
  dueSoonTasks: 0,
  completedThisWeek: 0,
};

export async function getTaskStats(): Promise<TaskStats> {
  try {
    const [{ getCurrentUser }, { prisma }] = await Promise.all([
      import('@/lib/flowboard/auth'),
      import('@/lib/flowboard/db'),
    ]);
    const user = await getCurrentUser();
    if (!user) return ZERO_TASKS;

    const membership = await prisma.flowWorkspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return ZERO_TASKS;
    const workspaceId = membership.workspaceId;

    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const base = {
      board: { workspaceId },
      isArchived: false,
    };

    const [open, overdue, dueSoon, completed] = await Promise.all([
      prisma.flowCard.count({ where: { ...base, isCompleted: false } }),
      prisma.flowCard.count({
        where: {
          ...base,
          isCompleted: false,
          dueDate: { lt: now },
        },
      }),
      prisma.flowCard.count({
        where: {
          ...base,
          isCompleted: false,
          dueDate: { gte: now, lte: inThreeDays },
        },
      }),
      prisma.flowCard.count({
        where: {
          ...base,
          isCompleted: true,
          updatedAt: { gte: weekAgo },
        },
      }),
    ]);

    return {
      openTasks: open,
      overdueTasks: overdue,
      dueSoonTasks: dueSoon,
      completedThisWeek: completed,
    };
  } catch (err) {
    console.warn('[command-center] Could not read FlowBoard task stats:', err);
    return ZERO_TASKS;
  }
}

/* =========================================================================
 * Aggregate payload
 * ========================================================================= */

export interface AttentionItem {
  id: string;
  kind: 'content_review' | 'tasks_overdue' | 'tasks_due_soon' | 'unread';
  title: string;
  description: string;
  href: string;
  severity: 'danger' | 'warning' | 'info';
}

export interface PipelineBucket {
  status: ContentStatus;
  label: string;
  count: number;
}

/* =========================================================================
 * Week ahead — operational view (tasks due + content scheduled, next 7 days)
 * ========================================================================= */

export interface WeekAheadItem {
  id: string;
  source: 'task' | 'content';
  title: string;
  /** ISO datetime of the due/scheduled date. */
  date: string;
  /** Board title for tasks, null for content. */
  context: string | null;
}

export async function getWeekAhead(
  workspaceId?: string,
): Promise<WeekAheadItem[]> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const items: WeekAheadItem[] = [];

  // FlowBoard tasks due within the next 7 days
  try {
    const [{ getCurrentUser }, { prisma }] = await Promise.all([
      import('@/lib/flowboard/auth'),
      import('@/lib/flowboard/db'),
    ]);
    const user = await getCurrentUser();
    if (user) {
      const membership = await prisma.flowWorkspaceMember.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (membership) {
        const cards = await prisma.flowCard.findMany({
          where: {
            board: { workspaceId: membership.workspaceId, isArchived: false },
            isArchived: false,
            isCompleted: false,
            dueDate: { gte: now, lte: inSevenDays },
          },
          include: { board: { select: { title: true } } },
          orderBy: { dueDate: 'asc' },
          take: 10,
        });
        for (const card of cards) {
          if (!card.dueDate) continue;
          items.push({
            id: card.id,
            source: 'task',
            title: card.title,
            date: card.dueDate.toISOString(),
            context: card.board.title,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[command-center] Could not read week-ahead tasks:', err);
  }

  // Contents scheduled within the next 7 days (workspace-scoped when the
  // caller provides a workspace).
  if (workspaceId) {
    try {
      const contents = await getContents(workspaceId);
      for (const c of contents) {
        if (
          (c.status === 'scheduled' || c.status === 'approved') &&
          c.scheduledAt &&
          new Date(c.scheduledAt) >= now &&
          new Date(c.scheduledAt) <= inSevenDays
        ) {
          items.push({
            id: c.id,
            source: 'content',
            title: c.title,
            date: c.scheduledAt,
            context: null,
          });
        }
      }
    } catch (err) {
      console.warn('[command-center] Could not read week-ahead contents:', err);
    }
  }

  return items
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
}

export interface CommandCenterData {
  kpis: {
    brandCount: number;
    contentCount: number;
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
    budgetUsagePercent: number;
    totalFollowers: number;
    totalAccounts: number;
  };
  tasks: TaskStats;
  pipeline: PipelineBucket[];
  attention: AttentionItem[];
  weekAhead: WeekAheadItem[];
  recentActivity: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
}

/** Build the full command-center payload for one workspace/user. */
export async function getCommandCenterData(input: {
  workspaceId: string;
  userId: string | null;
}): Promise<CommandCenterData> {
  const { workspaceId, userId } = input;

  const [brands, contents, finance, auditLogs, unread, notifications] =
    await Promise.all([
      getBrands(workspaceId),
      getContents(workspaceId),
      getFinanceDashboardData(),
      getAuditLogs(workspaceId, 10),
      getUnreadCount(workspaceId, userId),
      getNotifications(workspaceId, 5),
    ]);

  const tasks = await getTaskStats();
  const weekAhead = await getWeekAhead(workspaceId);

  // Content pipeline
  const ALL_STATUSES: ContentStatus[] = [
    'draft',
    'review',
    'approved',
    'scheduled',
    'published',
    'rejected',
    'cancelled',
    'failed',
  ];
  const countByStatus = new Map<ContentStatus, number>(
    ALL_STATUSES.map((s) => [s, 0]),
  );
  for (const c of contents) {
    countByStatus.set(c.status, (countByStatus.get(c.status) ?? 0) + 1);
  }
  const pipeline: PipelineBucket[] = ALL_STATUSES.map((status) => ({
    status,
    label: CONTENT_STATUS_LABELS[status],
    count: countByStatus.get(status) ?? 0,
  }));

  // Social totals: latest follower sums from the canonical overview
  // (social_accounts + social_metrics, snapshot fallback only in demo mode).
  const { summary } = await import('@/services/social.service').then((m) =>
    m.getSocialOverview(),
  );

  // Attention center
  const attention: AttentionItem[] = [];
  const pendingReview = countByStatus.get('review') ?? 0;
  if (pendingReview > 0) {
    attention.push({
      id: 'content-review',
      kind: 'content_review',
      title: `${pendingReview} محتوا در انتظار بازبینی`,
      description: 'محتواهایی که باید تأیید یا رد شوند.',
      href: '/content?status=review',
      severity: 'warning',
    });
  }
  if (tasks.overdueTasks > 0) {
    attention.push({
      id: 'tasks-overdue',
      kind: 'tasks_overdue',
      title: `${tasks.overdueTasks} وظیفه عقب‌افتاده`,
      description: 'وظایفی که مهلت آن‌ها گذشته است.',
      href: '/tasks',
      severity: 'danger',
    });
  }
  if (tasks.dueSoonTasks > 0) {
    attention.push({
      id: 'tasks-due-soon',
      kind: 'tasks_due_soon',
      title: `${tasks.dueSoonTasks} وظیفه تا ۳ روز آینده`,
      description: 'وظایفی که به مهلت آن‌ها نزدیک می‌شویم.',
      href: '/tasks',
      severity: 'info',
    });
  }
  if (unread > 0) {
    attention.push({
      id: 'unread-notifications',
      kind: 'unread',
      title: `${unread} اعلان خوانده‌نشده`,
      description: 'آخرین رویدادها و هشدارهای سیستم.',
      href: '/notifications',
      severity: 'info',
    });
  }

  // Recent activity: audit logs first; fall back to notification titles
  // when no audit entries exist yet.
  const AUDIT_ACTION_LABELS: Record<string, string> = {
    create: 'ایجاد',
    update: 'به‌روزرسانی',
    delete: 'حذف',
    status_change: 'تغییر وضعیت',
    approve: 'تأیید',
    reject: 'رد',
    publish: 'انتشار',
    assign: 'اختصاص',
    schedule: 'زمان‌بندی',
    cancel: 'لغو',
    read: 'مشاهده',
  };
  const recentActivity = auditLogs.map((log) => ({
    id: log.id,
    title: AUDIT_ACTION_LABELS[log.action] ?? log.action,
    description:
      (log.metadata?.summary as string | undefined) ??
      `${log.entityType} ${log.entityId}`,
    timestamp: log.createdAt,
  }));
  if (recentActivity.length === 0) {
    for (const n of notifications) {
      recentActivity.push({
        id: n.id,
        title: n.title,
        description: n.description,
        timestamp: n.createdAt,
      });
    }
  }

  const financeKpis = finance.overview;

  return {
    kpis: {
      brandCount: brands.length,
      contentCount: contents.length,
      totalBudget: financeKpis.totalBudget,
      totalSpent: financeKpis.totalSpent,
      remainingBudget: financeKpis.remainingBudget,
      budgetUsagePercent: financeKpis.budgetUsagePercent,
      totalFollowers: summary.totalFollowers,
      totalAccounts: summary.totalAccounts,
    },
    tasks,
    pipeline,
    attention,
    weekAhead,
    recentActivity: recentActivity.slice(0, 8),
  };
}