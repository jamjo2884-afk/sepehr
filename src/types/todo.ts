import type { ID, Timestamp } from '@/types/index';

/** Task status workflow: backlog → todo → in_progress → done/cancelled */
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'در انتظار',
  todo: 'انجام نشده',
  in_progress: 'در حال انجام',
  done: 'انجام شده',
  cancelled: 'لغو شده',
};

export const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  backlog: '○',
  todo: '◎',
  in_progress: '◐',
  done: '●',
  cancelled: '⊘',
};

/** Task priority levels */
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'بدون اولویت',
  low: 'کم',
  medium: 'متوسط',
  high: 'زیاد',
  urgent: 'فوری',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: '#6b7280',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

export const TASK_PRIORITY_ICONS: Record<TaskPriority, string> = {
  none: '',
  low: '↓',
  medium: '→',
  high: '↑',
  urgent: '⚡',
};

/** A task in the Todo system */
export interface Task {
  id: ID;
  projectId: ID | null;
  parentId: ID | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // shamsi date '1405-05-31'
  labels: string[];
  assigneeId: string | null;
  sortOrder: number;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A label/tag for tasks */
export interface TaskLabel {
  id: ID;
  name: string;
  color: string;
  createdAt: Timestamp;
}

/** Input for creating a new task */
export interface CreateTaskInput {
  projectId?: ID | null;
  parentId?: ID | null;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  labels?: string[];
  assigneeId?: string | null;
  sortOrder?: number;
}

/** Input for updating a task */
export interface UpdateTaskInput {
  projectId?: ID | null;
  parentId?: ID | null;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  labels?: string[];
  assigneeId?: string | null;
  sortOrder?: number;
}

/** Task with project info for display */
export interface TaskWithProject extends Task {
  projectName?: string;
}

/** Task statistics for dashboard */
export interface TaskStats {
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  done: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  highPriority: number;
}

/** View modes for the Todo page */
export type TaskViewMode = 'list' | 'board' | 'calendar';

/** Filter options for tasks */
export interface TaskFilters {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  projectId?: ID | 'all';
  label?: string | 'all';
  search?: string;
  assigneeId?: ID | 'all';
}
