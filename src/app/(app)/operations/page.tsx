'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ListTodo, Search } from 'lucide-react';
import { getOperations } from '@/services/data.service';
import {
  OPERATION_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  type Operation,
  type OperationStatus,
  type OperationType,
} from '@/types/domain';
import { formatJalaliDate, formatNumber } from '@/utils/persian';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<OperationStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  blocked: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
};

const STATUS_FILTERS: Array<{ id: OperationStatus | 'all'; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'todo', label: 'در صف' },
  { id: 'in_progress', label: 'در حال انجام' },
  { id: 'blocked', label: 'مسدود' },
  { id: 'done', label: 'انجام‌شده' },
];

export default function OperationsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OperationStatus | 'all'>(
    'all',
  );
  const [typeFilter, setTypeFilter] = useState<OperationType | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOperations()
      .then((ops) => {
        if (!active) return;
        setOperations(ops);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return operations.filter((op) => {
      if (statusFilter !== 'all' && op.status !== statusFilter) return false;
      if (typeFilter !== 'all' && op.type !== typeFilter) return false;
      if (!q) return true;
      return (
        op.title.toLowerCase().includes(q) ||
        op.description.toLowerCase().includes(q)
      );
    });
  }, [operations, statusFilter, typeFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: operations.length };
    for (const s of Object.keys(OPERATION_STATUS_LABELS)) {
      c[s] = operations.filter((o) => o.status === s).length;
    }
    return c;
  }, [operations]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          عملیات‌ها
        </h1>
        <p className="text-sm text-muted-foreground">
          کارهای عملیاتی پروژه‌ها — {formatNumber(operations.length)} عملیات
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === f.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.label}
              <span className="mr-1 opacity-70">({formatNumber(counts[f.id] ?? 0)})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as OperationType | 'all')
            }
            className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
          >
            <option value="all">همه انواع</option>
            {(Object.keys(OPERATION_TYPE_LABELS) as OperationType[]).map(
              (t) => (
                <option key={t} value={t}>
                  {OPERATION_TYPE_LABELS[t]}
                </option>
              ),
            )}
          </select>
          <div className="relative sm:mr-auto">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی عملیات..."
              className="w-full rounded-lg border border-border bg-surface/60 py-2 pr-9 pl-3 text-sm outline-none transition-colors focus:border-primary/50 sm:w-64"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-surface/60"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <ListTodo className="mb-2 h-8 w-8 opacity-40" />
          عملیاتی با این فیلترها پیدا نشد.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {visible.map((op) => (
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
                  STATUS_TONE[op.status],
                )}
              >
                {OPERATION_STATUS_LABELS[op.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
