'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListTodo,
  Plus,
  Search,
  Calendar,
  LayoutGrid,
  List,
  Check,
  Circle,
  CircleDot,
  AlertTriangle,
  X,
  MoreHorizontal,
  Tag,
  FolderKanban,
} from 'lucide-react';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getLabels,
  getTaskStats,
} from '@/services/todo.service';
import { getProjects } from '@/services/data.service';
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ICONS,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskWithProject,
  type TaskLabel,
  type TaskStats,
  type TaskViewMode,
} from '@/types/todo';
import type { Project } from '@/types/domain';
import { cn } from '@/lib/utils';

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  backlog: <Circle className="h-4 w-4 text-muted-foreground" />,
  todo: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <CircleDot className="h-4 w-4 text-primary animate-pulse" />,
  done: <Check className="h-4 w-4 text-success" />,
  cancelled: <X className="h-4 w-4 text-muted-foreground" />,
};



const STATUS_FILTERS: Array<{ id: TaskStatus | 'all'; label: string; icon?: React.ReactNode }> = [
  { id: 'all', label: 'همه' },
  { id: 'todo', label: 'انجام نشده', icon: <Circle className="h-3 w-3" /> },
  { id: 'in_progress', label: 'در حال انجام', icon: <CircleDot className="h-3 w-3 text-primary" /> },
  { id: 'done', label: 'انجام شده', icon: <Check className="h-3 w-3 text-success" /> },
];

const PRIORITY_FILTERS: Array<{ id: TaskPriority | 'all'; label: string }> = [
  { id: 'all', label: 'همه اولویت‌ها' },
  { id: 'urgent', label: '⚡ فوری' },
  { id: 'high', label: '↑ زیاد' },
  { id: 'medium', label: '→ متوسط' },
  { id: 'low', label: '↓ کم' },
];

// ─── Quick Add Input ─────────────────────────────────────────────────────────

function QuickAdd({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await createTask({ title: text.trim() });
      setText('');
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Plus className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="افزودن کار جدید..."
          className="w-full rounded-lg border border-border bg-surface/60 py-2.5 pr-9 pl-3 text-sm outline-none transition-colors focus:border-primary/50"
          disabled={loading}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || loading}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        افزودن
      </button>
    </div>
  );
}

// ─── Task Row ────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  labels,
  onToggle,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onSelect,
  isSelected,
}: {
  task: TaskWithProject;
  labels: TaskLabel[];
  onToggle: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onDelete: (id: string) => void;
  onSelect: (task: Task) => void;
  isSelected: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const taskLabels = labels.filter((l) => task.labels.includes(l.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2.5 transition-colors hover:bg-surface/70',
        isSelected && 'border-primary/40 bg-primary/5',
        task.status === 'done' && 'opacity-60',
      )}
    >
      {/* Status toggle */}
      <button
        onClick={() => onToggle(task)}
        className="shrink-0 transition-transform hover:scale-110"
      >
        {STATUS_ICON[task.status]}
      </button>

      {/* Priority indicator */}
      <button
        onClick={() => {
          const priorities: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];
          const idx = priorities.indexOf(task.priority);
          const next = priorities[(idx + 1) % priorities.length];
          onPriorityChange(task.id, next);
        }}
        className="shrink-0 text-xs font-bold"
        style={{ color: TASK_PRIORITY_COLORS[task.priority] }}
        title={TASK_PRIORITY_LABELS[task.priority]}
      >
        {TASK_PRIORITY_ICONS[task.priority] || <span className="text-muted-foreground">·</span>}
      </button>

      {/* Title + meta */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelect(task)}>
        <p className={cn('truncate text-sm font-medium text-foreground', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.projectName && (
            <span className="flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              {task.projectName}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {task.dueDate}
            </span>
          )}
          {taskLabels.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {taskLabels.map((l) => l.name).join('، ')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-surface shadow-lg">
              {(['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(task.id, s); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {STATUS_ICON[s]} {TASK_STATUS_LABELS[s]}
                </button>
              ))}
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                حذف
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Task Detail Panel ───────────────────────────────────────────────────────

function TaskDetail({
  task,
  labels,
  projects,
  onClose,
  onUpdated,
}: {
  task: Task;
  labels: TaskLabel[];
  projects: Project[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels);
  const [projectId, setProjectId] = useState(task.projectId ?? '');

  const handleSave = async () => {
    await updateTask(task.id, {
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      labels: selectedLabels,
      projectId: projectId || null,
    });
    onUpdated();
  };

  useEffect(() => {
    handleSave();
  }, [status, priority]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-y-0 left-0 z-50 w-full max-w-md border-r border-border bg-surface shadow-xl sm:relative sm:inset-auto sm:z-auto sm:max-w-sm"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">جزئیات کار</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full bg-transparent text-lg font-bold outline-none"
            placeholder="عنوان کار..."
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface/60 p-2 text-sm outline-none focus:border-primary/50"
            placeholder="توضیحات..."
          />

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">وضعیت</label>
            <div className="flex flex-wrap gap-1">
              {(['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-full px-2 py-1 text-xs font-medium transition-colors',
                    status === s ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {STATUS_ICON[s]} {TASK_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">اولویت</label>
            <div className="flex flex-wrap gap-1">
              {(['none', 'low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'rounded-full px-2 py-1 text-xs font-medium transition-colors',
                    priority === p ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {TASK_PRIORITY_ICONS[p]} {TASK_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date (Shamsi) */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">تاریخ سررسید (شمسی)</label>
            <input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={handleSave}
              placeholder="1405-06-01"
              className="w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono"
              dir="ltr"
            />
          </div>

          {/* Project */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">پروژه</label>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); }}
              onBlur={handleSave}
              className="w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            >
              <option value="">بدون پروژه</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">برچسب‌ها</label>
            <div className="flex flex-wrap gap-1">
              {labels.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setSelectedLabels((prev) =>
                      prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                    );
                  }}
                  className={cn(
                    'rounded-full px-2 py-1 text-xs font-medium transition-colors',
                    selectedLabels.includes(l.id)
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                  style={selectedLabels.includes(l.id) ? { backgroundColor: l.color } : undefined}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => { handleSave(); onClose(); }}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            ذخیره
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Board View (Kanban) ─────────────────────────────────────────────────────

function BoardView({
  tasks,
  labels,
  onToggle,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onSelect,
}: {
  tasks: TaskWithProject[];
  labels: TaskLabel[];
  onToggle: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onDelete: (id: string) => void;
  onSelect: (task: Task) => void;
}) {
  const columns: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done'];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div key={status} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              {STATUS_ICON[status]}
              <h3 className="text-xs font-semibold text-muted-foreground">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="text-[11px] text-muted-foreground/60">
                ({columnTasks.length})
              </span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/20 p-2 min-h-[100px]">
              <AnimatePresence>
                {columnTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    labels={labels}
                    onToggle={onToggle}
                    onStatusChange={onStatusChange}
                    onPriorityChange={onPriorityChange}
                    onDelete={onDelete}
                    onSelect={onSelect}
                    isSelected={false}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<TaskViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const refresh = useCallback(async () => {
    const [t, l, p, s] = await Promise.all([
      getTasks({ status: statusFilter, priority: priorityFilter, projectId: projectFilter, search }),
      getLabels(),
      getProjects(),
      getTaskStats(),
    ]);
    setTasks(t);
    setLabels(l);
    setProjects(p);
    setStats(s);
    setLoading(false);
  }, [statusFilter, priorityFilter, projectFilter, search]);

  useEffect(() => {
    let active = true;
    refresh().then(() => { if (!active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const handleToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    await updateTask(task.id, { status: newStatus });
    refresh();
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    await updateTask(id, { status });
    refresh();
  };

  const handlePriorityChange = async (id: string, priority: TaskPriority) => {
    await updateTask(id, { priority });
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    refresh();
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter !== 'all') result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((t) => t.priority === priorityFilter);
    if (projectFilter !== 'all') result = result.filter((t) => t.projectId === projectFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, statusFilter, priorityFilter, projectFilter, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            کارها
          </h1>
          <p className="text-sm text-muted-foreground">
            مدیریت وظایف و عملیات — {stats ? `${stats.total} کار` : '...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-border bg-surface/60 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn('rounded-md p-1.5', viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={cn('rounded-md p-1.5', viewMode === 'board' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Quick Add */}
      <QuickAdd onCreated={refresh} />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ListTodo className="h-3.5 w-3.5" />
              کل
            </div>
            <p className="mt-1 text-lg font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDot className="h-3.5 w-3.5 text-primary" />
              در حال انجام
            </div>
            <p className="mt-1 text-lg font-bold text-primary">{stats.inProgress}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              اولویت بالا
            </div>
            <p className="mt-1 text-lg font-bold text-warning">{stats.highPriority}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-success" />
              انجام شده
            </div>
            <p className="mt-1 text-lg font-bold text-success">{stats.done}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === f.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
            className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none"
          >
            {PRIORITY_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none"
          >
            <option value="all">همه پروژه‌ها</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="relative sm:mr-auto">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو..."
              className="w-full rounded-lg border border-border bg-surface/60 py-2 pr-9 pl-3 text-sm outline-none focus:border-primary/50 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Task list / board */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-surface/60" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <ListTodo className="mb-2 h-8 w-8 opacity-40" />
          کاری با این فیلترها پیدا نشد.
        </div>
      ) : viewMode === 'board' ? (
        <BoardView
          tasks={filteredTasks}
          labels={labels}
          onToggle={handleToggle}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onDelete={handleDelete}
          onSelect={setSelectedTask}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <AnimatePresence>
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                labels={labels}
                onToggle={handleToggle}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDelete={handleDelete}
                onSelect={setSelectedTask}
                isSelected={selectedTask?.id === task.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            labels={labels}
            projects={projects}
            onClose={() => setSelectedTask(null)}
            onUpdated={() => { refresh(); setSelectedTask(null); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
