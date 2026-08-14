'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  Clock,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
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
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{jalali}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          مرکز فرمان
        </h1>
        <p className="text-sm text-muted-foreground">
          {workspaceName} — نمای کلی عملیات رسانه‌ای شما
        </p>
      </header>

      <section>
        <SectionTitle icon={Clock} title="ادامه کار" href="/projects" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {continueWorking.map((project) => (
            <Link
              key={project.id}
              href="/projects"
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40"
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
            <thead className="bg-surface/60 text-xs text-muted-foreground">
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
                  className="transition-colors hover:bg-surface/40"
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
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-surface/60 p-4 text-center transition-colors hover:border-primary/40 hover:bg-surface"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
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
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
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
