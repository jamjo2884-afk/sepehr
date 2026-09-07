'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type Content,
  type ContentStatus,
  type ContentType,
} from '@/types/content';
import { formatJalaliDate, formatRelativeTime } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

const STATUS_BADGE: Record<ContentStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  review: 'bg-amber-500/10 text-amber-500',
  approved: 'bg-cyan-500/10 text-cyan-500',
  scheduled: 'bg-blue-500/10 text-blue-500',
  published: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

interface BrandOption {
  id: string;
  name: string;
}

interface CampaignOption {
  id: string;
  brandId?: string | null;
  name: string;
}

interface BoardOption {
  id: string;
  title: string;
  lists: { id: string; title: string; position: number }[];
}

interface ContentFormState {
  title: string;
  type: ContentType;
  brandId: string;
  campaignId: string;
  platform: string;
  body: string;
  scheduledAt: string;
}

interface TaskFormState {
  title: string;
  boardId: string;
  listId: string;
  priority: string;
  dueDate: string;
  description: string;
}

const EMPTY_FORM: ContentFormState = {
  title: '',
  type: 'post',
  brandId: '',
  campaignId: '',
  platform: '',
  body: '',
  scheduledAt: '',
};

const EMPTY_TASK_FORM: TaskFormState = {
  title: '',
  boardId: '',
  listId: '',
  priority: 'MEDIUM',
  dueDate: '',
  description: '',
};

type LoadState = 'loading' | 'ready' | 'error';

export default function ContentPage() {
  const role = useAuthStore((s) => s.role);
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor';
  const canDelete = role === 'owner' || role === 'admin';

  const [state, setState] = useState<LoadState>('loading');
  const [contents, setContents] = useState<Content[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [boards, setBoards] = useState<BoardOption[]>([]);

  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [form, setForm] = useState<ContentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // Task creation dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskContent, setTaskContent] = useState<Content | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [taskSaving, setTaskSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [contentsRes, brandsRes, campaignsRes, taskCountRes, boardsRes] =
        await Promise.all([
          fetch('/api/content', { cache: 'no-store' }),
          fetch('/api/brands', { cache: 'no-store' }),
          fetch('/api/finance/campaigns', { cache: 'no-store' }),
          fetch('/api/content/tasks-count', { cache: 'no-store' }),
          fetch('/api/flowboard/boards-list', { cache: 'no-store' }),
        ]);

      const contentsBody = (await contentsRes.json()) as {
        ok: boolean;
        contents: Content[];
      };
      const brandsBody = (await brandsRes.json()) as {
        ok: boolean;
        brands: BrandOption[];
      };
      const campaignsBody = (await campaignsRes.json()) as {
        ok: boolean;
        campaigns: CampaignOption[];
      };
      const taskCountBody = (await taskCountRes.json()) as {
        ok: boolean;
        counts: Record<string, number>;
      };
      const boardsBody = (await boardsRes.json()) as {
        ok: boolean;
        boards: BoardOption[];
      };

      setContents(contentsBody.contents ?? []);
      setBrands(brandsBody.brands ?? []);
      setCampaigns(campaignsBody.campaigns ?? []);
      setTaskCounts(taskCountBody.counts ?? {});
      setBoards(boardsBody.boards ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let result = contents;
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (brandFilter !== 'all') {
      result = result.filter((c) => c.brandId === brandFilter);
    }
    if (campaignFilter !== 'all') {
      result = result.filter((c) => c.campaignId === campaignFilter);
    }
    return result;
  }, [contents, statusFilter, brandFilter, campaignFilter]);

  const countByStatus = useMemo(() => {
    const map = new Map<ContentStatus, number>(ALL_STATUSES.map((s) => [s, 0]));
    for (const c of contents) map.set(c.status, (map.get(c.status) ?? 0) + 1);
    return map;
  }, [contents]);

  const filteredCampaigns = useMemo(() => {
    if (brandFilter === 'all') return campaigns;
    return campaigns.filter(
      (c) => !c.brandId || c.brandId === brandFilter,
    );
  }, [campaigns, brandFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (content: Content) => {
    setEditing(content);
    setForm({
      title: content.title,
      type: content.type,
      brandId: content.brandId ?? '',
      campaignId: content.campaignId ?? '',
      platform: content.platform ?? '',
      body: content.body,
      scheduledAt: content.scheduledAt ? content.scheduledAt.slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const openTaskDialog = (content: Content) => {
    setTaskContent(content);
    setTaskForm({
      ...EMPTY_TASK_FORM,
      title: `تسک محتوا: ${content.title}`,
    });
    setTaskDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('عنوان محتوا الزامی است.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        brandId: form.brandId || null,
        campaignId: form.campaignId || null,
        platform: form.platform.trim() || null,
        body: form.body,
        scheduledAt: form.scheduledAt
          ? new Date(`${form.scheduledAt}T00:00:00`).toISOString()
          : null,
      };
      const res = await fetch(
        editing ? `/api/content/${editing.id}` : '/api/content',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'ثبت محتوا ناموفق بود.');
        return;
      }
      toast.success(editing ? 'محتوا به‌روزرسانی شد.' : 'محتوا ایجاد شد.');
      setDialogOpen(false);
      await load();
    } catch {
      toast.error('ثبت محتوا ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async () => {
    if (!taskContent || !taskForm.title.trim()) {
      toast.error('عنوان تسک الزامی است.');
      return;
    }
    if (!taskForm.boardId || !taskForm.listId) {
      toast.error('بورد و لیست را انتخاب کنید.');
      return;
    }
    setTaskSaving(true);
    try {
      const res = await fetch(`/api/content/${taskContent.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          boardId: taskForm.boardId,
          listId: taskForm.listId,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null,
          description: taskForm.description || undefined,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'ایجاد تسک ناموفق بود.');
        return;
      }
      toast.success('تسک ایجاد شد.');
      setTaskDialogOpen(false);
      await load();
    } catch {
      toast.error('ایجاد تسک ناموفق بود.');
    } finally {
      setTaskSaving(false);
    }
  };

  const transition = async (content: Content, to: ContentStatus) => {
    setTransitioningId(content.id);
    try {
      const res = await fetch(`/api/content/${content.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'تغییر وضعیت ناموفق بود.');
        return;
      }
      toast.success(`وضعیت به «${CONTENT_STATUS_LABELS[to]}» تغییر کرد.`);
      await load();
    } catch {
      toast.error('تغییر وضعیت ناموفق بود.');
    } finally {
      setTransitioningId(null);
    }
  };

  const remove = async (content: Content) => {
    if (!window.confirm(`«${content.title}» حذف شود؟`)) return;
    try {
      const res = await fetch(`/api/content/${content.id}`, {
        method: 'DELETE',
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'حذف محتوا ناموفق بود.');
        return;
      }
      toast.success('محتوا حذف شد.');
      await load();
    } catch {
      toast.error('حذف محتوا ناموفق بود.');
    }
  };

  const selectedBoard = boards.find((b) => b.id === taskForm.boardId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            محتوا
          </h1>
          <p className="text-sm text-muted-foreground">
            چرخه تولید محتوا — از پیش‌نویس تا انتشار
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ایجاد محتوا
          </Button>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <StatusChip
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label="همه"
          count={contents.length}
        />
        {ALL_STATUSES.map((status) => (
          <StatusChip
            key={status}
            active={statusFilter === status}
            onClick={() => setStatusFilter(status)}
            label={CONTENT_STATUS_LABELS[status]}
            count={countByStatus.get(status) ?? 0}
          />
        ))}
      </div>

      {/* Brand + Campaign filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="همه برندها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه برندها</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="همه کمپین‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کمپین‌ها</SelectItem>
              {filteredCampaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state === 'loading' ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : state === 'error' ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            دریافت محتواها ممکن نشد.
          </p>
          <Button onClick={() => void load()}>تلاش دوباره</Button>
        </section>
      ) : filtered.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {contents.length === 0
              ? 'هنوز محتوایی ثبت نشده است.'
              : 'محتوايی با این فیلتر وجود ندارد.'}
          </p>
          {contents.length === 0 && (
            <Button onClick={openCreate}>ایجاد اولین محتوا</Button>
          )}
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((content) => (
            <li
              key={content.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[content.status]}`}
                  >
                    {CONTENT_STATUS_LABELS[content.status]}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {CONTENT_TYPE_LABELS[content.type]}
                  </span>
                  {content.platform && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {content.platform}
                    </span>
                  )}
                  {taskCounts[content.id] ? (
                    <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-500">
                      <CheckSquare className="h-3 w-3" />
                      {taskCounts[content.id]} تسک
                    </span>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {content.title}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {content.brandId && (
                    <span>
                      برند: {brandName(content.brandId, brands)}
                    </span>
                  )}
                  {content.campaignId && (
                    <span>
                      کمپین: {campaignName(content.campaignId, campaigns)}
                    </span>
                  )}
                  {content.scheduledAt && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      انتشار: {formatJalaliDate(new Date(content.scheduledAt))}
                    </span>
                  )}
                  {content.publishedAt && (
                    <span>
                      منتشرشده: {formatRelativeTime(new Date(content.publishedAt))}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => openTaskDialog(content)}
                  >
                    <Workflow className="h-3 w-3" />
                    ایجاد تسک
                  </Button>
                )}
                {ALLOWED_ACTIONS[content.status].map((to) => (
                  <Button
                    key={to}
                    size="sm"
                    variant={to === 'published' ? 'default' : 'outline'}
                    disabled={!canEdit || transitioningId === content.id}
                    onClick={() => void transition(content, to)}
                  >
                    {ACTION_LABELS[to]}
                  </Button>
                ))}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(content)}
                  >
                    ویرایش
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void remove(content)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit content dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'ویرایش محتوا' : 'ایجاد محتوا'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="content-title">عنوان</Label>
              <Input
                id="content-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثلاً: پست معرفی محصول جدید"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>نوع</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v as ContentType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>پلتفرم</Label>
                <Input
                  value={form.platform}
                  onChange={(e) =>
                    setForm({ ...form, platform: e.target.value })
                  }
                  placeholder="مثلاً: instagram"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>برند</Label>
                <Select
                  value={form.brandId}
                  onValueChange={(v) =>
                    setForm({ ...form, brandId: v, campaignId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="بدون برند" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>کمپین</Label>
                <Select
                  value={form.campaignId}
                  onValueChange={(v) =>
                    setForm({ ...form, campaignId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="بدون کمپین" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns
                      .filter(
                        (c) =>
                          !form.brandId ||
                          !c.brandId ||
                          c.brandId === form.brandId,
                      )
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>تاریخ انتشار برنامه‌ریزی‌شده</Label>
              <Input
                type="date"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
              />
              {form.scheduledAt && (
                <p className="text-xs text-muted-foreground">
                  معادل شمسی:{' '}
                  {formatJalaliDate(new Date(`${form.scheduledAt}T00:00:00`))}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>متن / توضیحات</Label>
              <Textarea
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="متن یا توضیحات محتوا..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                انصراف
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'در حال ثبت...' : 'ثبت'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create task from content dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ایجاد تسک از محتوا</DialogTitle>
          </DialogHeader>
          {taskContent && (
            <div className="rounded-lg border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {taskContent.title}
              </span>
              {taskContent.brandId && (
                <span className="mr-2">
                  — برند: {brandName(taskContent.brandId, brands)}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>عنوان تسک</Label>
              <Input
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
                placeholder="عنوان تسک..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>بورد</Label>
                <Select
                  value={taskForm.boardId}
                  onValueChange={(v) =>
                    setTaskForm({ ...taskForm, boardId: v, listId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب بورد" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>لیست</Label>
                <Select
                  value={taskForm.listId}
                  onValueChange={(v) =>
                    setTaskForm({ ...taskForm, listId: v })
                  }
                  disabled={!taskForm.boardId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب لیست" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedBoard?.lists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>اولویت</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) =>
                    setTaskForm({ ...taskForm, priority: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">بدون اولویت</SelectItem>
                    <SelectItem value="LOW">پایین</SelectItem>
                    <SelectItem value="MEDIUM">متوسط</SelectItem>
                    <SelectItem value="HIGH">بالا</SelectItem>
                    <SelectItem value="URGENT">فوری</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>تاریخ سررسید</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, dueDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>توضیحات</Label>
              <Textarea
                rows={3}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                placeholder="توضیحات تسک..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTaskDialogOpen(false)}
              >
                انصراف
              </Button>
              <Button onClick={() => void saveTask()} disabled={taskSaving}>
                {taskSaving ? 'در حال ایجاد...' : 'ایجاد تسک'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* =========================================================================
 * Helpers
 * ========================================================================= */

function StatusChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-muted-foreground hover:border-primary/40'
      }`}
    >
      {label}
      <span
        className={`mr-1 ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
      >
        {count}
      </span>
    </button>
  );
}

function brandName(id: string, brands: BrandOption[]): string {
  return brands.find((b) => b.id === id)?.name ?? id;
}

function campaignName(id: string, campaigns: CampaignOption[]): string {
  return campaigns.find((c) => c.id === id)?.name ?? id;
}

/** Transitions offered as buttons for each status */
const ALLOWED_ACTIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['review'],
  review: ['approved', 'rejected'],
  approved: ['scheduled', 'published'],
  scheduled: ['published', 'cancelled'],
  published: [],
  rejected: ['draft'],
  cancelled: [],
  failed: ['draft'],
};

const ACTION_LABELS: Record<ContentStatus, string> = {
  draft: 'به پیش‌نویس',
  review: 'ارسال به بازبینی',
  approved: 'تأیید',
  scheduled: 'زمان‌بندی',
  published: 'انتشار',
  rejected: 'رد',
  cancelled: 'لغو',
  failed: 'ناموفق',
};
