'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  Clock,
  FileText,
  FolderKanban,
  HeartPulse,
  MessageSquareText,
  Radio,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthStore } from '@/stores/auth.store';
import { navItems } from '@/config/navigation.config';
import { PROJECT_STATUS_LABELS, type Project } from '@/types/domain';
import type { Notification } from '@/types/index';
import type { ActivityItem } from '@/features/mock-data';
import {
  getProjects,
  getActivity,
  getNotifications,
} from '@/services/data.service';
import { formatJalaliDate, formatRelativeTime } from '@/utils/persian';
import { cn } from '@/lib/utils';

const QUICK_ACCESS_IDS = [
  'projects',
  'operations',
  'assets',
  'campaigns',
  'distribution',
  'social',
  'analytics',
];

const STATUS_TONE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  planning: 'bg-primary/10 text-primary',
  on_hold: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

/* ===== KPI cards (sample overview values) ===== */
const KPIS: {
  id: string;
  label: string;
  value: string;
  growth: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'reach',
    label: 'دسترسی کل',
    value: '۲٫۴۵M',
    growth: '+۱۲٫۵٪',
    icon: Radio,
  },
  {
    id: 'engagement',
    label: 'نرخ تعامل',
    value: '۱۸٫۶٪',
    growth: '+۸٫۷٪',
    icon: HeartPulse,
  },
  {
    id: 'content',
    label: 'محتوای کل',
    value: '۳۴۲',
    growth: '+۵٫۲٪',
    icon: FileText,
  },
  {
    id: 'mentions',
    label: 'اشاره‌های رسانه‌ای',
    value: '۸٬۴۲۱',
    growth: '+۱۴٫۲٪',
    icon: MessageSquareText,
  },
];

/* ===== Chart data (media monitoring overview) ===== */
const REACH_DATA = [
  { day: 'ش', reach: 182, engagement: 14.2 },
  { day: 'ی', reach: 214, engagement: 15.6 },
  { day: 'د', reach: 198, engagement: 14.9 },
  { day: 'س', reach: 256, engagement: 17.3 },
  { day: 'چ', reach: 240, engagement: 16.8 },
  { day: 'پ', reach: 288, engagement: 18.4 },
  { day: 'ج', reach: 301, engagement: 18.6 },
];

const SENTIMENT_DATA = [
  { name: 'مثبت', value: 62, color: 'hsl(var(--success))' },
  { name: 'خنثی', value: 26, color: 'hsl(var(--muted-foreground))' },
  { name: 'منفی', value: 12, color: 'hsl(var(--destructive))' },
];

const SENTIMENT_TOTAL = '۸٬۴۲۱';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-1.5 font-medium">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color }}
          />
          {item.name}: {toFa(Number(item.value))}
        </p>
      ))}
    </div>
  );
}

export default function CommandCenterPage() {
  const workspace = useAuthStore((s) => s.workspace);
  const today = useMemo(() => new Date(), []);
  const jalali = useMemo(
    () => formatJalaliDate(today, { withWeekday: true }),
    [today],
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(), getActivity(), getNotifications()])
      .then(([p, a, n]) => {
        if (!active) return;
        setProjects(p);
        setActivity(a);
        setNotifications(n);
      })
      .catch(() => {
        // services already fall back; nothing else to do
      });
    return () => {
      active = false;
    };
  }, []);

  const recentProjects = projects.slice(0, 4);
  const continueWorking = projects
    .filter((p) => p.status === 'active' || p.status === 'planning')
    .slice(0, 3);
  const recentActivity = activity.slice(0, 5);
  const unreadNotifications = notifications.filter((n) => !n.read);

  const quickAccess = useMemo(() => {
    const byId = new Map(navItems.map((i) => [i.id, i]));
    return QUICK_ACCESS_IDS.map((id) => byId.get(id)).filter(
      (i): i is NonNullable<typeof i> => Boolean(i),
    );
  }, []);

  const workspaceName = workspace?.name ?? 'فضای کاری پیش‌فرض';

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
          {workspaceName} — نمای کلی وضعیت رسانه‌ها، عملکرد محتوا و اشاره‌های
          رسانه‌ای شما
        </p>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors duration-200 hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  dir="ltr"
                  className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"
                >
                  <TrendingUp className="h-3 w-3" />
                  {kpi.growth}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  dir="ltr"
                  className="text-3xl font-bold tracking-tight text-foreground"
                >
                  {kpi.value}
                </span>
                <span className="text-sm text-muted-foreground">
                  {kpi.label}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Charts — media monitoring overview */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              دسترسی و تعامل — ۷ روز اخیر
            </h2>
            <span className="text-xs text-muted-foreground">هزار (K)</span>
          </div>
          <div dir="ltr" className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={REACH_DATA}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="engFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => toFa(v)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name="دسترسی"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#reachFill)"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  name="تعامل"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#engFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2 w-2 rounded-full bg-cyan" />
            احساسات رسانه
          </h2>
          <div className="relative h-56 w-full">
            <div dir="ltr" className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SENTIMENT_DATA}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {SENTIMENT_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                dir="ltr"
                className="text-2xl font-bold tracking-tight text-foreground"
              >
                {SENTIMENT_TOTAL}
              </span>
              <span className="text-xs text-muted-foreground">
                اشاره‌های رسانه‌ای
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {SENTIMENT_DATA.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold text-foreground">
                  {toFa(item.value)}٪
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle icon={Clock} title="ادامه کار" href="/projects" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {continueWorking.map((project) => (
            <Link
              key={project.id}
              href="/projects"
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4 transition-colors duration-200 hover:border-primary/40"
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
              <p className="text-sm font-semibold text-foreground">
                {project.name}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {project.description}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {toFa(project.progress)}٪
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          icon={FolderKanban}
          title="پروژه‌های اخیر"
          href="/projects"
        />
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">نام پروژه</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                  وضعیت
                </th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                  پیشرفت
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  به‌روزرسانی
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentProjects.map((project) => (
                <tr
                  key={project.id}
                  className="transition-colors duration-150 hover:bg-primary/5"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {project.name}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                        STATUS_TONE[project.status],
                      )}
                    >
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="text-muted-foreground">
                      {toFa(project.progress)}٪
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatRelativeTime(new Date(project.updatedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="فعالیت‌های اخیر" />
          <ul className="flex flex-col gap-2">
            {recentActivity.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle icon={Bell} title="اعلان‌ها" />
          <ul className="flex flex-col gap-2">
            {unreadNotifications.length === 0 ? (
              <li className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                اعلان جدیدی وجود ندارد.
              </li>
            ) : (
              unreadNotifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeTime(new Date(n.createdAt))}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </motion.div>
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

function ActivityRow({ activity }: { activity: ActivityItem }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan" />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{activity.title}</p>
        <p className="text-xs text-muted-foreground">{activity.description}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(activity.timestamp))}
        </p>
      </div>
    </li>
  );
}

function toFa(value: number): string {
  return value.toLocaleString('fa-IR');
}
