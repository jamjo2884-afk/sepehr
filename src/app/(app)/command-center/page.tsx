'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Bell,
  CalendarClock,
  Clock,
  FileText,
  ListTodo,
  Wallet,
  Users,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  navItems,
  sectionTintVar,
  type NavItem,
} from '@/config/navigation.config';
import type {
  AttentionItem,
  CommandCenterData,
} from '@/services/command-center.service';
import { SocialTrendsSection } from '@/components/common/social-trends-section';

import {
  formatJalaliDate,
  formatNumber,
  formatRelativeTime,
} from '@/utils/persian';

const QUICK_ACCESS_IDS = [
  'tasks',
  'content',
  'campaigns',
  'finance',
  'social',
  'analytics',
];

const ATTENTION_ICONS: Record<AttentionItem['kind'], LucideIcon> = {
  content_review: Clock,
  tasks_overdue: AlertTriangle,
  tasks_due_soon: CalendarClock,
  unread: Bell,
};

/** Severity → tint token for the vivid chip border treatment. */
const ATTENTION_TINT: Record<AttentionItem['severity'], string> = {
  danger: 'var(--destructive)',
  warning: 'var(--warning)',
  info: 'var(--primary)',
};

type LoadState = 'loading' | 'ready' | 'error';

export default function CommandCenterPage() {
  const workspace = useAuthStore((s) => s.workspace);
  const today = useMemo(() => new Date(), []);
  const jalali = useMemo(
    () => formatJalaliDate(today, { withWeekday: true }),
    [today],
  );

  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<CommandCenterData | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/command-center', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const body = (await res.json()) as {
        ok: boolean;
        data?: CommandCenterData;
      };
      if (!body.ok || !body.data) throw new Error('empty');
      setData(body.data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const quickAccess = useMemo(() => {
    const byId = new Map(navItems.map((i) => [i.id, i]));
    return QUICK_ACCESS_IDS.map((id) => byId.get(id)).filter(
      (i): i is NavItem => Boolean(i),
    );
  }, []);

  const workspaceName = workspace?.name ?? 'Media Deck';
  const maxPipeline = Math.max(
    1,
    ...(data?.pipeline.map((p) => p.count) ?? [1]),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Welcome / overview — v2: vivid gradient hero header */}
      <header className="page-header-gradient flex flex-col gap-1 rounded-2xl border p-5 shadow-lg sm:p-6">
        <div className="flex items-center gap-2">
          <span className="icon-chip-solid flex h-9 w-9 items-center justify-center rounded-xl">
            <LayoutDashboardIcon />
          </span>
          <p className="text-meta font-medium text-muted-foreground">{jalali}</p>
        </div>
        <h1 className="text-page-title mt-1 text-foreground">مرکز فرمان</h1>
        <p className="text-sm text-muted-foreground">
          {workspaceName} — نمای زنده از برندها، محتوا، وظایف، مالی و شبکه‌های
          اجتماعی
        </p>
      </header>

      {state === 'loading' ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
      ) : state === 'error' ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-surface p-10 text-center shadow-md">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-body-strong text-foreground">
            دریافت نمای کلی ممکن نشد.
          </p>
          <button
            onClick={() => void load()}
            className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          >
            تلاش دوباره
          </button>
        </section>
      ) : data ? (
        <>
          {/* KPI cards — v2: per-metric accent colors + gradient cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Award}
              tint={sectionTintVar.brands}
              label="برندها"
              value={formatNumber(data.kpis.brandCount)}
            />
            <KpiCard
              icon={FileText}
              tint={sectionTintVar.content}
              label="محتوای کل"
              value={formatNumber(data.kpis.contentCount)}
            />
            <KpiCard
              icon={Wallet}
              tint={sectionTintVar.finance}
              label="بودجه باقی‌مانده"
              value={formatNumber(data.kpis.remainingBudget)}
              ltr
            />
            <KpiCard
              icon={Users}
              tint={sectionTintVar.social}
              label="مخاطبان کل"
              value={formatNumber(data.kpis.totalFollowers)}
            />
          </section>

          {/* Social trends — 5 server-aggregated charts with shared filters,
              mounted right after the KPI cards so the "total audience" KPI
              is immediately followed by its trend */}
          <SocialTrendsSection />

          {/* Attention center — v2: severity-tinted cards */}
          <section className="card-tint rounded-2xl border p-5 shadow-md">
            <h2 className="text-section-title mb-3 flex items-center gap-2 text-foreground">
              <span
                className="icon-chip flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ ['--tint' as string]: 'var(--primary)' }}
              >
                <Bell className="h-4 w-4" />
              </span>
              مرکز توجه
            </h2>
            {data.attention.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-surface/60 p-4 text-sm text-muted-foreground">
                موردی برای توجه وجود ندارد — همه‌چیز در وضعیت عادی است.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {data.attention.map((item) => {
                  const Icon = ATTENTION_ICONS[item.kind];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="group flex items-start gap-3 rounded-xl border bg-surface/70 p-4 shadow-sm transition-all duration-200 hover:shadow-md"
                        style={{
                          ['--tint' as string]:
                            ATTENTION_TINT[item.severity],
                          borderColor:
                            'color-mix(in srgb, var(--tint) 28%, transparent)',
                        }}
                      >
                        <span
                          className="icon-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
                          style={{ ['--tint' as string]: ATTENTION_TINT[item.severity] }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex flex-1 flex-col gap-0.5">
                          <p className="text-body-strong text-foreground">
                            {item.title}
                          </p>
                          <p className="text-meta text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <ChevronLeft className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Week ahead — operational view (v2: source-tinted chips) */}
          <section className="card-tint rounded-2xl border p-5 shadow-md" style={{ ['--tint' as string]: sectionTintVar.tasks }}>
            <h2 className="text-section-title mb-3 flex items-center gap-2 text-foreground">
              <span
                className="icon-chip flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ ['--tint' as string]: sectionTintVar.tasks }}
              >
                <CalendarClock className="h-4 w-4" />
              </span>
              پیش‌روی این هفته
            </h2>
            {data.weekAhead.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-surface/60 p-4 text-sm text-muted-foreground">
                موردی برای هفته پیش‌رو برنامه‌ریزی نشده است.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.weekAhead.map((item) => (
                  <li
                    key={`${item.source}-${item.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/70 p-4 shadow-sm"
                  >
                    <span
                      className="icon-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        ['--tint' as string]:
                          item.source === 'task'
                            ? sectionTintVar.tasks
                            : sectionTintVar.content,
                      }}
                    >
                      {item.source === 'task' ? (
                        <ListTodo className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-body-strong text-foreground">
                        {item.title}
                      </p>
                      <p className="text-meta text-muted-foreground">
                        {item.source === 'task' ? 'وظیفه' : 'محتوا'}
                        {item.context ? ` — ${item.context}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {formatJalaliDate(new Date(item.date))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Task overview */}
            <section>
              <SectionTitle
                icon={ListTodo}
                tint={sectionTintVar.tasks}
                title="وظایف"
                href="/tasks/boards"
              />
              <div className="grid grid-cols-2 gap-2">
                <TaskStat
                  tint={sectionTintVar.tasks}
                  label="باز"
                  value={formatNumber(data.tasks.openTasks)}
                />
                <TaskStat
                  tint={sectionTintVar.tasks}
                  label="عقب‌افتاده"
                  value={formatNumber(data.tasks.overdueTasks)}
                  danger={data.tasks.overdueTasks > 0}
                />
                <TaskStat
                  tint={sectionTintVar.tasks}
                  label="تا ۳ روز آینده"
                  value={formatNumber(data.tasks.dueSoonTasks)}
                />
                <TaskStat
                  tint={sectionTintVar.tasks}
                  label="تکمیل‌شده این هفته"
                  value={formatNumber(data.tasks.completedThisWeek)}
                  positive
                />
              </div>
            </section>

            {/* Content pipeline — v2: vivid gradient bars */}
            <section>
              <SectionTitle
                icon={FileText}
                tint={sectionTintVar.content}
                title="خط لوله محتوا"
                href="/content"
              />
              <div className="card-tint flex flex-col gap-3 rounded-2xl border p-4 shadow-md" style={{ ['--tint' as string]: sectionTintVar.content }}>
                {data.pipeline
                  .filter((p) => p.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((p) => (
                    <div key={p.status} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
                        {p.label}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="vivid-bar h-full rounded-full transition-[width] duration-500"
                          style={{
                            ['--tint' as string]: sectionTintVar.content,
                            width: `${Math.round((p.count / maxPipeline) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-left text-sm font-bold text-foreground persian-nums">
                        {formatNumber(p.count)}
                      </span>
                    </div>
                  ))}
                {data.pipeline.every((p) => p.count === 0) && (
                  <p className="text-sm text-muted-foreground">
                    هنوز محتوایی ثبت نشده است.{' '}
                    <Link
                      href="/content"
                      className="font-semibold text-primary hover:underline"
                    >
                      اولین محتوا را ایجاد کنید
                    </Link>
                  </p>
                )}
              </div>
            </section>
          </div>

          <section>
            <SectionTitle title="دسترسی سریع" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {quickAccess.map((item) => {
                const Icon: LucideIcon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group flex flex-col items-center gap-2 rounded-2xl border bg-surface/70 p-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      ['--tint' as string]: sectionTintVar[item.section],
                      borderColor:
                        'color-mix(in srgb, var(--tint) 20%, transparent)',
                    }}
                  >
                    <span className="icon-chip flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle title="فعالیت‌های اخیر" />
            {data.recentActivity.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-surface/60 p-4 text-sm text-muted-foreground">
                هنوز فعالیتی ثبت نشده است.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.recentActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface/70 p-4 shadow-sm"
                  >
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4"
                      style={{
                        background: 'var(--section-social)',
                        ['--tw-ring-color' as string]:
                          'color-mix(in srgb, var(--section-social) 20%, transparent)',
                      }}
                    />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className="text-body-strong text-foreground">
                        {activity.title}
                      </p>
                      <p className="text-meta text-muted-foreground">
                        {activity.description}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatRelativeTime(new Date(activity.timestamp))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </motion.div>
  );
}

/**
 * v2 KPI card: gradient tint in the section's hue, vivid icon chip,
 * big extrabold value (Persian digits via .text-kpi-value).
 */
function KpiCard({
  icon: Icon,
  tint,
  label,
  value,
  ltr,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div
      className="kpi-card-gradient group flex flex-col gap-3 rounded-2xl border p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ ['--tint' as string]: tint }}
    >
      <div className="flex items-center justify-between">
        <span className="icon-chip flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          dir={ltr ? 'ltr' : undefined}
          className={`text-kpi-value text-foreground ${ltr ? 'text-right' : ''}`}
        >
          {value}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

function TaskStat({
  tint,
  label,
  value,
  danger,
  positive,
}: {
  tint: string;
  label: string;
  value: string;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className="card-tint flex flex-col gap-1 rounded-xl border p-4 shadow-sm"
      style={{
        ['--tint' as string]: danger
          ? 'var(--destructive)'
          : positive
            ? 'var(--success)'
            : tint,
      }}
    >
      <span
        className={`text-2xl font-extrabold tracking-tight persian-nums ${
          danger
            ? 'text-destructive'
            : positive
              ? 'text-success'
              : 'text-foreground'
        }`}
      >
        {value}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  tint,
  title,
  href,
}: {
  icon?: LucideIcon;
  tint?: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-section-title flex items-center gap-2 text-foreground">
        {Icon ? (
          <span
            className="icon-chip flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ ['--tint' as string]: tint ?? 'var(--primary)' }}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs font-semibold text-primary transition-colors hover:text-brand-300 hover:underline"
        >
          مشاهده همه
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Inline icon so the hero header needs no extra import indirection. */
function LayoutDashboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
