'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  getSocialDashboardData,
  latestMetricsByAccount,
} from '@/services/social.service';
import type { SocialAccount, SocialMetric } from '@/types/social';
import {
  SOCIAL_ACCOUNT_STATUS_LABELS,
  SOCIAL_CONNECTION_STATUS_LABELS,
} from '@/types/social';
import type {
  SocialAccountStatus,
  SocialConnectionStatus,
  SocialSyncRunStatus,
} from '@/types/social';
import { SOCIAL_SYNC_RUN_LABELS } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatJalaliDate, formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { MetricFormDialog } from '@/components/social/metric-form-dialog';
import { BulkMetricFormDialog } from '@/components/social/bulk-metric-form-dialog';
import { AccountFormDialog } from '@/components/social/account-form-dialog';
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
import { toast } from 'sonner';

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
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(
    null,
  );
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

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

  const toggleAccountStatus = async (account: SocialAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(account.id);
    const { setSocialAccountStatus } =
      await import('@/services/social.service');
    const nextStatus: SocialAccountStatus =
      account.status === 'active' ? 'inactive' : 'active';
    const updated = await setSocialAccountStatus(account.id, nextStatus);
    setBusyAccountId(null);
    if (!updated) return;
    setRaw((prev) =>
      prev
        ? {
            ...prev,
            accounts: prev.accounts.map((a) =>
              a.id === account.id ? updated : a,
            ),
          }
        : prev,
    );
  };

  const runSync = async (account: SocialAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(account.id);
    try {
      const res = await fetch('/api/social/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        errorMessage?: string | null;
      };
      if (result.ok) {
        toast.success('آمار با موفقیت به‌روزرسانی شد.');
        setReloadKey((k) => k + 1);
      } else {
        toast.error(result.errorMessage || 'همگام‌سازی انجام نشد.');
      }
    } catch {
      toast.error('همگام‌سازی انجام نشد.');
    } finally {
      setBusyAccountId(null);
    }
  };

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={() => {
                setEditingAccount(null);
                setAccountDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن حساب
            </Button>
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
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  اتصال
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  آخرین همگام‌سازی
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
                      <ConnectionBadge
                        status={account.connectionStatus}
                        lastStatus={account.lastSyncStatus}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {account.lastSyncAt ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs tabular-nums">
                            {formatJalaliShort(account.lastSyncAt)}
                          </span>
                          {account.lastSyncStatus ? (
                            <span className="text-[11px]">
                              {SOCIAL_SYNC_RUN_LABELS[account.lastSyncStatus]}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={busyAccountId === account.id}
                          onClick={() => runSync(account)}
                        >
                          <RefreshCw
                            className={cn(
                              'h-3 w-3',
                              busyAccountId === account.id && 'animate-spin',
                            )}
                          />
                          {busyAccountId === account.id
                            ? 'در حال همگام‌سازی…'
                            : 'همگام‌سازی'}
                        </Button>
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
                          onClick={() => {
                            setEditingAccount(account);
                            setAccountDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                          ویرایش
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={busyAccountId === account.id}
                          onClick={() => toggleAccountStatus(account)}
                          aria-label={
                            account.status === 'active'
                              ? 'غیرفعال‌کردن حساب'
                              : 'فعال‌کردن حساب'
                          }
                        >
                          <Power
                            className={cn(
                              'h-3 w-3',
                              account.status === 'active'
                                ? 'text-muted-foreground'
                                : 'text-success',
                            )}
                          />
                          {account.status === 'active'
                            ? 'غیرفعال'
                            : 'فعال‌سازی'}
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
      <AccountFormDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={editingAccount}
        onSaved={(saved, mode) => {
          setAccountDialogOpen(false);
          setEditingAccount(null);
          setRaw((prev) => {
            if (!prev) return prev;
            if (mode === 'create') {
              return {
                ...prev,
                accounts: [...prev.accounts, saved],
              };
            }
            return {
              ...prev,
              accounts: prev.accounts.map((a) =>
                a.id === saved.id ? saved : a,
              ),
            };
          });
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

function ConnectionBadge({
  status,
  lastStatus,
}: {
  status: SocialConnectionStatus;
  lastStatus: SocialSyncRunStatus | null;
}) {
  const className = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
    status === 'connected' && 'bg-success/10 text-success',
    status === 'disconnected' && 'bg-muted text-muted-foreground',
    status === 'error' && 'bg-destructive/10 text-destructive',
    status === 'pending' &&
      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    lastStatus === 'running' &&
      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  );
  return (
    <span className={className}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'connected' && 'bg-success',
          status === 'disconnected' && 'bg-muted-foreground',
          status === 'error' && 'bg-destructive',
          (status === 'pending' || lastStatus === 'running') && 'bg-amber-500',
        )}
      />
      {lastStatus === 'running'
        ? SOCIAL_SYNC_RUN_LABELS.running
        : SOCIAL_CONNECTION_STATUS_LABELS[status]}
    </span>
  );
}

function formatJalaliShort(iso: string): string {
  try {
    return formatJalaliDate(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString('fa-IR');
  }
}
