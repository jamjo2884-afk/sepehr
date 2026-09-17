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
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { navItems } from '@/config/navigation.config';
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

const ATTENTION_COLORS: Record<AttentionItem['severity'], string> = {
  danger: 'text-destructive bg-destructive/10',
  warning: 'text-amber-500 bg-amber-500/10',
  info: 'text-primary bg-primary/10',
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
      (i): i is NonNullable<typeof i> => Boolean(i),
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
      {/* Welcome / overview */}
      <header className="brand-glow flex flex-col gap-1 rounded-xl border border-border p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">{jalali}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          مرکز فرمان
        </h1>
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
                className="h-28 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-border bg-surface" />
          <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
        </div>
      ) : state === 'error' ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            دریافت نمای کلی ممکن نشد.
          </p>
          <button
            onClick={() => void load()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            تلاش دوباره
          </button>
        </section>
      ) : data ? (
        <>
          {/* KPI cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Award}
              label="برندها"
              value={formatNumber(data.kpis.brandCount)}
            />
            <KpiCard
              icon={FileText}
              label="محتوای کل"
              value={formatNumber(data.kpis.contentCount)}
            />
            <KpiCard
              icon={Wallet}
              label="بودجه باقی‌مانده"
              value={formatNumber(data.kpis.remainingBudget)}
              ltr
            />
            <KpiCard
              icon={Users}
              label="مخاطبان کل"
              value={formatNumber(data.kpis.totalFollowers)}
            />
          </section>

          {/* Social trends — 5 server-aggregated charts with shared filters,
              mounted right after the KPI cards so the "total audience" KPI
              is immediately followed by its trend */}
          <SocialTrendsSection />

          {/* Attention center */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell className="h-4 w-4 text-primary" />
              مرکز توجه
            </h2>
            {data.attention.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
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
                        className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ATTENTION_COLORS[item.severity]}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex flex-1 flex-col gap-0.5">
                          <p className="text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Week ahead — operational view */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" />
              پیش‌روی این هفته
            </h2>
            {data.weekAhead.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                موردی برای هفته پیش‌رو برنامه‌ریزی نشده است.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.weekAhead.map((item) => (
                  <li
                    key={`${item.source}-${item.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        item.source === 'task'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-cyan-500/10 text-cyan-500'
                      }`}
                    >
                      {item.source === 'task' ? (
                        <ListTodo className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.source === 'task' ? 'وظیفه' : 'محتوا'}
                        {item.context ? ` — ${item.context}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
                title="وظایف"
                href="/tasks/boards"
              />
              <div className="grid grid-cols-2 gap-2">
                <TaskStat
                  label="باز"
                  value={formatNumber(data.tasks.openTasks)}
                />
                <TaskStat
                  label="عقب‌افتاده"
                  value={formatNumber(data.tasks.overdueTasks)}
                  danger={data.tasks.overdueTasks > 0}
                />
                <TaskStat
                  label="تا ۳ روز آینده"
                  value={formatNumber(data.tasks.dueSoonTasks)}
                />
                <TaskStat
                  label="تکمیل‌شده این هفته"
                  value={formatNumber(data.tasks.completedThisWeek)}
                  positive
                />
              </div>
            </section>

            {/* Content pipeline */}
            <section>
              <SectionTitle
                icon={FileText}
                title="خط لوله محتوا"
                href="/content"
              />
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                {data.pipeline
                  .filter((p) => p.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((p) => (
                    <div key={p.status} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">
                        {p.label}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.round((p.count / maxPipeline) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-left text-sm font-semibold text-foreground">
                        {formatNumber(p.count)}
                      </span>
                    </div>
                  ))}
                {data.pipeline.every((p) => p.count === 0) && (
                  <p className="text-sm text-muted-foreground">
                    هنوز محتوایی ثبت نشده است.{' '}
                    <Link
                      href="/content"
                      className="text-primary hover:underline"
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
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-surface/60 p-4 text-center transition-colors duration-200 hover:border-primary/40 hover:bg-surface"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-medium text-foreground">
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
              <p className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                هنوز فعالیتی ثبت نشده است.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.recentActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan" />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
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

function KpiCard({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors duration-200 hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          dir={ltr ? 'ltr' : undefined}
          className={`text-3xl font-bold tracking-tight text-foreground ${
            ltr ? 'text-right' : ''
          }`}
        >
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function TaskStat({
  label,
  value,
  danger,
  positive,
}: {
  label: string;
  value: string;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span
        className={`text-2xl font-bold tracking-tight ${
          danger
            ? 'text-destructive'
            : positive
              ? 'text-success'
              : 'text-foreground'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  href,
}: {
  icon?: LucideIcon;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="text-xs font-medium text-primary hover:underline"
        >
          مشاهده همه
        </Link>
      ) : null}
    </div>
  );
}
