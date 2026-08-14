'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ClipboardList, Eye, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import {
  getSocialDashboardData,
  latestMetricsByAccount,
} from '@/services/social.service';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { SOCIAL_ACCOUNT_STATUS_LABELS } from '@/types/social';
import type { SocialAccountStatus } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { MetricFormDialog } from '@/components/social/metric-form-dialog';
import { BulkMetricFormDialog } from '@/components/social/bulk-metric-form-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function SocialAccountsPage() {
  const [raw, setRaw] = useState<{
    accounts: SocialAccount[];
    metrics: SocialMetric[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [brandFilter, setBrandFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordAccountId, setRecordAccountId] = useState<string | undefined>(
    undefined,
  );
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSocialDashboardData()
      .then((data) => {
        if (active) {
          setRaw(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setRaw(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const accounts = useMemo(() => raw?.accounts ?? [], [raw]);
  const metrics = useMemo(() => raw?.metrics ?? [], [raw]);

  const brands = useMemo(
    () =>
      [...new Set(accounts.map((a) => a.brand))].sort((a, b) =>
        a.localeCompare(b, 'fa'),
      ),
    [accounts],
  );
  const platforms = useMemo(
    () => [...new Set(accounts.map((a) => a.platform))] as SocialPlatform[],
    [accounts],
  );
  const statuses = useMemo(
    () => [...new Set(accounts.map((a) => a.status))] as SocialAccountStatus[],
    [accounts],
  );

  const latestByAccount = useMemo(
    () => latestMetricsByAccount(metrics),
    [metrics],
  );

  const filtered = useMemo(() => {
    return accounts.filter(
      (a) =>
        (brandFilter === 'all' || a.brand === brandFilter) &&
        (platformFilter === 'all' || a.platform === platformFilter) &&
        (statusFilter === 'all' || a.status === statusFilter),
    );
  }, [accounts, brandFilter, platformFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface/60 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-foreground">
          خطا در دریافت حساب‌ها. لطفاً دوباره تلاش کنید.
        </p>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          تلاش دوباره
        </Button>
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
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          مدیریت حساب‌های شبکه‌های اجتماعی
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            مدیریت آمار
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => setBulkOpen(true)}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            ثبت انبوه
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatNumber(accounts.length)} حساب — آخرین آمار هر حساب و ثبت/ویرایش
          متریک
        </p>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface/60 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            برند
          </span>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه برندها</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            پلتفرم
          </span>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه پلتفرم‌ها</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>
                  {SOCIAL_PLATFORM_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            وضعیت
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOCIAL_ACCOUNT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Accounts table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            حسابی با این فیلترها یافت نشد.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  برند
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  پلتفرم
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  نام حساب
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  وضعیت
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  آخرین دنبال‌کننده
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  آخرین دوره
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const latest = latestByAccount.get(account.id) ?? null;
                const detailHref = `/social/${encodeURIComponent(
                  [account.brand, account.platform, account.username].join('|'),
                )}`;
                return (
                  <tr
                    key={account.id}
                    className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {account.brand}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <SocialPlatformIcon
                          platform={account.platform}
                          className="h-6 w-6 rounded-md"
                          iconClassName="h-3.5 w-3.5"
                        />
                        <span className="text-muted-foreground">
                          {SOCIAL_PLATFORM_LABELS[account.platform]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {account.username || account.displayName || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={account.status} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-foreground">
                      {latest ? formatNumber(latest.followers) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {latest
                        ? latest.period === 'monthly'
                          ? jalaliMonthName(latest.periodLabel)
                          : latest.periodLabel
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            setRecordAccountId(account.id);
                            setRecordOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          ثبت آمار
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <Link href={detailHref}>
                            <Eye className="h-3 w-3" />
                            مشاهده
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MetricFormDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        accounts={accounts}
        defaultAccountId={recordAccountId}
        onSaved={() => {
          setRecordOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />
      <BulkMetricFormDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        accounts={accounts}
        onSaved={() => {
          setBulkOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </motion.div>
  );
}

function StatusBadge({ status }: { status: SocialAccountStatus }) {
  const isActive = status === 'active';
  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-0',
        isActive
          ? 'bg-success/10 text-success'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {SOCIAL_ACCOUNT_STATUS_LABELS[status]}
    </Badge>
  );
}
