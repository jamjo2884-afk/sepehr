/**
 * Todo/Task Management Service
 *
 * Full CRUD for tasks and labels. Reads from Supabase with mock fallback.
 * All writes go through this service — the client never touches Supabase directly.
 */
import type {
  Task,
  TaskLabel,
  TaskStatus,
  TaskPriority,
  TaskStats,
  CreateTaskInput,
  UpdateTaskInput,
  TaskWithProject,
} from '@/types/todo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function iso(v: unknown): string {
  return typeof v === 'string' ? v : new Date().toISOString();
}



function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v : [];
}

// ─── Task Row Mapping ────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  labels: string[];
  color: string | null;
  category: string | null;
  assignee_id: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    labels: arr(row.labels),
    color: row.color ?? null,
    category: row.category ?? null,
    assigneeId: row.assignee_id,
    sortOrder: num(row.sort_order),
    completedAt: row.completed_at,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function taskToRow(input: CreateTaskInput | UpdateTaskInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('projectId' in input && input.projectId !== undefined) row.project_id = input.projectId;
  if ('parentId' in input && input.parentId !== undefined) row.parent_id = input.parentId;
  if ('title' in input && input.title !== undefined) row.title = input.title.trim();
  if ('description' in input && input.description !== undefined) row.description = input.description;
  if ('status' in input && input.status !== undefined) row.status = input.status;
  if ('priority' in input && input.priority !== undefined) row.priority = input.priority;
  if ('dueDate' in input && input.dueDate !== undefined) row.due_date = input.dueDate;
  if ('labels' in input && input.labels !== undefined) row.labels = input.labels;
  if ('color' in input && input.color !== undefined) row.color = input.color || null;
  if ('category' in input && input.category !== undefined) row.category = input.category || null;
  if ('assigneeId' in input && input.assigneeId !== undefined) row.assignee_id = input.assigneeId;
  if ('sortOrder' in input && input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  return row;
}

// ─── Label Row Mapping ───────────────────────────────────────────────────────

interface LabelRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

function labelFromRow(row: LabelRow): TaskLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: iso(row.created_at),
  };
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_LABELS: TaskLabel[] = [
  { id: 'lbl-urgent', name: 'فوری', color: '#ef4444', createdAt: new Date().toISOString() },
  { id: 'lbl-review', name: 'نیاز به بررسی', color: '#f59e0b', createdAt: new Date().toISOString() },
  { id: 'lbl-content', name: 'محتوا', color: '#3b82f6', createdAt: new Date().toISOString() },
  { id: 'lbl-design', name: 'طراحی', color: '#8b5cf6', createdAt: new Date().toISOString() },
  { id: 'lbl-dev', name: 'توسعه', color: '#10b981', createdAt: new Date().toISOString() },
  { id: 'lbl-social', name: 'شبکه اجتماعی', color: '#ec4899', createdAt: new Date().toISOString() },
];

const MOCK_TASKS: Task[] = [
  {
    id: 'task-1', projectId: null, parentId: null,
    title: 'بررسی آمار شبکه‌های اجتماعی هفته', description: '',
    status: 'todo', priority: 'medium', dueDate: '1405-06-01',
    labels: ['lbl-social'], color: '#ec4899', category: 'social',
    assigneeId: null, sortOrder: 0,
    completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2', projectId: null, parentId: null,
    title: 'تهیه گزارش ماهانه عملکرد', description: '',
    status: 'in_progress', priority: 'high', dueDate: '1405-06-05',
    labels: ['lbl-review'], color: '#f59e0b', category: 'analytics',
    assigneeId: null, sortOrder: 1,
    completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-3', projectId: null, parentId: null,
    title: 'طراحی پوستر کمپین تابستانه', description: '',
    status: 'todo', priority: 'medium', dueDate: '1405-06-10',
    labels: ['lbl-design', 'lbl-content'], color: '#8b5cf6', category: 'design',
    assigneeId: null, sortOrder: 2,
    completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-4', projectId: null, parentId: null,
    title: 'انتشار محتوای هفته در شبکه‌ها', description: '',
    status: 'backlog', priority: 'low', dueDate: null,
    labels: ['lbl-social'], color: '#3b82f6', category: 'content',
    assigneeId: null, sortOrder: 3,
    completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

// ─── Supabase Client ─────────────────────────────────────────────────────────

async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

// ─── Tasks CRUD ──────────────────────────────────────────────────────────────

/** Get all tasks with optional filters. Falls back to mock data. */
export async function getTasks(filters?: {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  projectId?: string | 'all';
  label?: string | 'all';
  search?: string;
}): Promise<TaskWithProject[]> {
  try {
    const sb = await getSupabase();
    let query = sb.from('tasks').select('*').order('sort_order', { ascending: true });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority && filters.priority !== 'all') {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.projectId && filters.projectId !== 'all') {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_TASKS;

    const tasks = data.map(taskFromRow);

    return tasks;
  } catch (err) {
    console.warn('[todo] Could not read tasks from Supabase, falling back to mock data.', err);
    return MOCK_TASKS;
  }
}

/** Get a single task by id. */
export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? taskFromRow(data as TaskRow) : null;
  } catch {
    return MOCK_TASKS.find((t) => t.id === id) ?? null;
  }
}

/** Get subtasks of a parent task. */
export async function getSubtasks(parentId: string): Promise<Task[]> {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(taskFromRow);
  } catch {
    return MOCK_TASKS.filter((t) => t.parentId === parentId);
  }
}

/** Create a new task. Returns the new task id. */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const id = `task-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    const sb = await getSupabase();
    const row = {
      id,
      project_id: input.projectId ?? null,
      parent_id: input.parentId ?? null,
      title: input.title.trim(),
      description: input.description ?? '',
      status: input.status ?? 'todo',
      priority: input.priority ?? 'none',
      due_date: input.dueDate ?? null,
      labels: input.labels ?? [],
      color: input.color ?? null,
      category: input.category ?? null,
      assignee_id: input.assigneeId ?? null,
      sort_order: input.sortOrder ?? 0,
    };
    const { error } = await sb.from('tasks').insert(row);
    if (error) throw error;
    return id;
  } catch (err) {
    console.warn('[todo] Could not create task in Supabase.', err);
    return id;
  }
}

/** Update a task. */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  try {
    const sb = await getSupabase();
    const row = taskToRow(input);

    // Auto-set completed_at when status changes to 'done'
    if ('status' in input) {
      if (input.status === 'done') {
        row.completed_at = new Date().toISOString();
      } else {
        row.completed_at = null;
      }
    }

    const { error } = await sb.from('tasks').update(row).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('[todo] Could not update task.', err);
  }
}

/** Delete a task and its subtasks (cascade). */
export async function deleteTask(id: string): Promise<void> {
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('tasks').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('[todo] Could not delete task.', err);
  }
}

/** Quick-add a task from a single text string (like Todoist natural language). */
export async function quickAddTask(text: string): Promise<string> {
  return createTask({ title: text });
}

/** Get task statistics. */
export async function getTaskStats(): Promise<TaskStats> {
  const tasks = await getTasks();
  const today = '1405-06-01'; // Will be computed from shamsi date
  const stats: TaskStats = {
    total: tasks.length,
    backlog: tasks.filter((t) => t.status === 'backlog').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
    overdue: tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'cancelled').length,
    dueToday: tasks.filter((t) => t.dueDate === today).length,
    dueThisWeek: tasks.filter((t) => t.dueDate && t.dueDate <= today && t.status !== 'done').length,
    highPriority: tasks.filter((t) => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done' && t.status !== 'cancelled').length,
  };
  return stats;
}

// ─── Labels CRUD ─────────────────────────────────────────────────────────────

/** Get all labels. Falls back to mock data. */
export async function getLabels(): Promise<TaskLabel[]> {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.from('task_labels').select('*').order('name');
    if (error) throw error;
    if (!data || data.length === 0) return MOCK_LABELS;
    return data.map(labelFromRow);
  } catch {
    return MOCK_LABELS;
  }
}

/** Create a new label. */
export async function createLabel(name: string, color: string): Promise<string> {
  const id = `lbl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('task_labels').insert({ id, name: name.trim(), color });
    if (error) throw error;
    return id;
  } catch (err) {
    console.warn('[todo] Could not create label.', err);
    return id;
  }
}

/** Delete a label. */
export async function deleteLabel(id: string): Promise<void> {
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('task_labels').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('[todo] Could not delete label.', err);
  }
}

// ─── Batch Operations ────────────────────────────────────────────────────────

/** Batch update task statuses (for drag-and-drop in board view). */
export async function batchUpdateStatus(taskIds: string[], status: TaskStatus): Promise<void> {
  try {
    const sb = await getSupabase();
    const update: Record<string, unknown> = { status };
    if (status === 'done') {
      update.completed_at = new Date().toISOString();
    } else {
      update.completed_at = null;
    }
    const { error } = await sb.from('tasks').update(update).in('id', taskIds);
    if (error) throw error;
  } catch (err) {
    console.warn('[todo] Could not batch update tasks.', err);
  }
}

/** Batch update sort order (for reordering). */
export async function batchUpdateSortOrder(tasks: Array<{ id: string; sortOrder: number }>): Promise<void> {
  try {
    const sb = await getSupabase();
    for (const t of tasks) {
      await sb.from('tasks').update({ sort_order: t.sortOrder }).eq('id', t.id);
    }
  } catch (err) {
    console.warn('[todo] Could not batch update sort order.', err);
  }
}
