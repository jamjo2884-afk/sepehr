'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderKanban, Search } from 'lucide-react';
import { getProjects } from '@/services/data.service';
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from '@/types/domain';
import { formatNumber, formatRelativeTime } from '@/utils/persian';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: 'bg-success/10 text-success',
  planning: 'bg-primary/10 text-primary',
  on_hold: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

const FILTERS: Array<{ id: ProjectStatus | 'all'; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'active', label: 'فعال' },
  { id: 'planning', label: 'در حال برنامه‌ریزی' },
  { id: 'on_hold', label: 'متوقف' },
  { id: 'completed', label: 'تکمیل‌شده' },
  { id: 'archived', label: 'بایگانی‌شده' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProjects()
      .then((p) => {
        if (!active) return;
        setProjects(p);
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
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      );
    });
  }, [projects, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const s of Object.keys(PROJECT_STATUS_LABELS)) {
      c[s] = projects.filter((p) => p.status === s).length;
    }
    return c;
  }, [projects]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          پروژه‌ها
        </h1>
        <p className="text-sm text-muted-foreground">
          پروژه‌های رسانه‌ای شما — {formatNumber(projects.length)} پروژه
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.label}
              <span className="mr-1 opacity-70">({formatNumber(counts[f.id] ?? 0)})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی پروژه..."
            className="w-full rounded-lg border border-border bg-surface/60 py-2 pr-9 pl-3 text-sm outline-none transition-colors focus:border-primary/50 sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-border bg-surface/60"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <FolderKanban className="mb-2 h-8 w-8 opacity-40" />
          پروژه‌ای با این فیلترها پیدا نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${encodeURIComponent(project.id)}`}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                    STATUS_TONE[project.status],
                  )}
                >
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
                <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  {project.name}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {project.description}
                </p>
              </div>
              <div className="mt-auto flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>پیشرفت</span>
                  <span>{formatNumber(project.progress)}٪</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  به‌روزرسانی: {formatRelativeTime(new Date(project.updatedAt))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
