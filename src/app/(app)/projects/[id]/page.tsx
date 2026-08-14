'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderKanban,
  ListTodo,
  Megaphone,
} from 'lucide-react';
import {
  getProjectById,
  getOperationsByProject,
  getAssetsByProject,
  getCampaignsByProject,
} from '@/services/data.service';
import {
  CAMPAIGN_STATUS_LABELS,
  MEDIA_ASSET_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type Campaign,
  type MediaAsset,
  type Operation,
  type Project,
  type ProjectStatus,
} from '@/types/domain';
import {
  formatJalaliDate,
  formatNumber,
  formatRelativeTime,
} from '@/utils/persian';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: 'bg-success/10 text-success',
  planning: 'bg-primary/10 text-primary',
  on_hold: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

const OPERATION_STATUS_TONE: Record<Operation['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  blocked: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getProjectById(id),
      getOperationsByProject(id),
      getCampaignsByProject(id),
      getAssetsByProject(id),
    ])
      .then(([p, ops, cams, asts]) => {
        if (!active) return;
        setProject(p);
        setOperations(ops);
        setCampaigns(cams);
        setAssets(asts);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const doneOps = useMemo(
    () => operations.filter((o) => o.status === 'done').length,
    [operations],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">پروژه پیدا نشد.</p>
        <Link
          href="/projects"
          className="text-sm font-medium text-primary hover:underline"
        >
          بازگشت به پروژه‌ها
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <button
        onClick={() => router.back()}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت
      </button>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_TONE[project.status],
            )}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            /{project.slug}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {project.name}
        </h1>
        <p className="text-sm text-muted-foreground">{project.description}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
          <span className="text-xs text-muted-foreground">پیشرفت</span>
          <span className="text-xl font-bold text-foreground">
            {formatNumber(project.progress)}٪
          </span>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
          <span className="text-xs text-muted-foreground">عملیات</span>
          <span className="text-xl font-bold text-foreground">
            {formatNumber(operations.length)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatNumber(doneOps)} انجام‌شده
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
          <span className="text-xs text-muted-foreground">کمپین‌ها</span>
          <span className="text-xl font-bold text-foreground">
            {formatNumber(campaigns.length)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
          <span className="text-xs text-muted-foreground">دارایی‌ها</span>
          <span className="text-xl font-bold text-foreground">
            {formatNumber(assets.length)}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListTodo className="h-4 w-4 text-primary" />
          عملیات‌ها
        </h2>
        {operations.length === 0 ? (
          <EmptyRow text="عملیاتی برای این پروژه ثبت نشده است." />
        ) : (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {operations.map((op) => (
              <Link
                key={op.id}
                href={`/operations/${encodeURIComponent(op.id)}`}
                className="flex items-center justify-between gap-3 bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/70"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {op.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {OPERATION_TYPE_LABELS[op.type]}
                    {op.dueDate
                      ? ` · مهلت: ${formatJalaliDate(new Date(op.dueDate))}`
                      : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    OPERATION_STATUS_TONE[op.status],
                  )}
                >
                  {OPERATION_STATUS_LABELS[op.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-primary" />
            کمپین‌ها
          </h2>
          {campaigns.length === 0 ? (
            <EmptyRow text="کمپینی برای این پروژه ثبت نشده است." />
          ) : (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
              {campaigns.map((c) => (
                <div key={c.id} className="flex flex-col gap-1 bg-surface/40 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                  {c.startDate ? (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      شروع: {formatJalaliDate(new Date(c.startDate))}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            دارایی‌های رسانه‌ای
          </h2>
          {assets.length === 0 ? (
            <EmptyRow text="دارایی‌ای برای این پروژه ثبت نشده است." />
          ) : (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
              {assets.map((a) => (
                <Link
                  key={a.id}
                  href={`/assets/${encodeURIComponent(a.id)}`}
                  className="flex items-center justify-between gap-3 bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/70"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {MEDIA_ASSET_TYPE_LABELS[a.type]}
                      {a.tags.length > 0 ? ` · ${a.tags.join('، ')}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(a.updatedAt))}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" />
        ساخته‌شده: {formatJalaliDate(new Date(project.createdAt))} · آخرین
        به‌روزرسانی: {formatRelativeTime(new Date(project.updatedAt))}
      </footer>
    </motion.div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
      {text}
    </div>
  );
}
