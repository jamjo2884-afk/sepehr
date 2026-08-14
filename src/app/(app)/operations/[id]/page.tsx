'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  ListTodo,
  User,
} from 'lucide-react';
import {
  getOperationById,
  getProjectById,
} from '@/services/data.service';
import {
  OPERATION_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  type Operation,
  type OperationStatus,
  type Project,
} from '@/types/domain';
import {
  formatJalaliDate,
  formatPersianTime,
  formatRelativeTime,
} from '@/utils/persian';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<OperationStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  blocked: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
};

export default function OperationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);

  const [operation, setOperation] = useState<Operation | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOperationById(id)
      .then(async (op) => {
        if (!active || !op) return;
        setOperation(op);
        setProject(await getProjectById(op.projectId));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <ListTodo className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">عملیات پیدا نشد.</p>
        <Link
          href="/operations"
          className="text-sm font-medium text-primary hover:underline"
        >
          بازگشت به عملیات‌ها
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_TONE[operation.status],
            )}
          >
            {OPERATION_STATUS_LABELS[operation.status]}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {OPERATION_TYPE_LABELS[operation.type]}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {operation.title}
        </h1>
        <p className="text-sm text-muted-foreground">{operation.description}</p>
        {project ? (
          <Link
            href={`/projects/${encodeURIComponent(project.id)}`}
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            پروژه: {project.name}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">مهلت</span>
            <span className="text-sm font-semibold text-foreground">
              {operation.dueDate
                ? formatJalaliDate(new Date(operation.dueDate))
                : 'بدون مهلت'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">مسئول</span>
            <span className="text-sm font-semibold text-foreground">
              {operation.assigneeId ? operation.assigneeId : 'تخصیص داده نشده'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4 sm:col-span-2 lg:col-span-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListTodo className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">وضعیت</span>
            <span
              className={cn(
                'text-sm font-semibold',
                operation.status === 'done' ? 'text-success' : 'text-foreground',
              )}
            >
              {OPERATION_STATUS_LABELS[operation.status]}
            </span>
          </div>
        </div>
      </div>

      <footer className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
        ساخته‌شده: {formatJalaliDate(new Date(operation.createdAt))} ساعت{' '}
        {formatPersianTime(new Date(operation.createdAt))} · آخرین به‌روزرسانی:{' '}
        {formatRelativeTime(new Date(operation.updatedAt))}
      </footer>
    </motion.div>
  );
}
