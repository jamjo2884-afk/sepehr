'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Eye,
  History,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  getSocialDashboardData,
  latestMetricsByAccount,
} from '@/services/social.service';
import {
  formatSyncDuration,
  getLatestSyncLogs,
} from '@/services/social-sync.service';
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
import type {
  SyncAllResult,
  SyncOverview,
  SyncOverviewRecent,
} from '@/services/social-sync.service';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatJalaliDate, formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { MetricFormDialog } from '@/components/social/metric-form-dialog';
import { BulkMetricFormDialog } from '@/components/social/bulk-metric-form-dialog';
import { BulkImportDialog } from '@/components/social/bulk-import-dialog';
import { AccountFormDialog } from '@/components/social/account-form-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [importOpen, setImportOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(
    null,
  );
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const [overview, setOverview] = useState<SyncOverview | null>(null);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(
    null,
  );
  const [syncAllOpen, setSyncAllOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<SocialAccount | null>(
    null,
  );
  const [historyLogs, setHistoryLogs] = useState<SyncOverviewRecent[] | null>(
    null,
  );

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

  // Control-center overview (platform summary, health, recent syncs).
  useEffect(() => {
    let active = true;
    fetch('/api/social/sync/overview')
      .then((r) => r.json())
      .then((data: SyncOverview) => {
        if (active) setOverview(data);
      })
      .catch(() => {});
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

  // Sync every connected account (bounded concurrency on the server).
  const runSyncAll = async () => {
    if (syncAllBusy) return;
    setSyncAllBusy(true);
    try {
      const res = await fetch('/api/social/sync/all', { method: 'POST' });
      const result = (await res.json()) as SyncAllResult;
      setSyncAllResult(result);
      setSyncAllOpen(true);
      setReloadKey((k) => k + 1);
    } catch {
      toast.error('همگام‌سازی همه انجام نشد.');
    } finally {
      setSyncAllBusy(false);
    }
  };

  // Open the sync history dialog for one account.
  const openHistory = async (account: SocialAccount) => {
    setHistoryAccount(account);
    setHistoryOpen(true);
    setHistoryLogs(null);
    try {
      const logs = await getLatestSyncLogs([account.id], 15);
      setHistoryLogs(logs[account.id] ?? []);
    } catch {
      setHistoryLogs([]);
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
              disabled={syncAllBusy}
              onClick={runSyncAll}
              title="فقط حساب‌های متصل همگام‌سازی می‌شوند"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', syncAllBusy && 'animate-spin')}
              />
              {syncAllBusy ? 'در حال همگام‌سازی…' : 'همگام‌سازی همه'}
            </Button>
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
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              ورود انبوه
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatNumber(accounts.length)} حساب — آخرین آمار هر حساب و ثبت/ویرایش
          متریک
        </p>
      </header>

      {/* Platform overview + sync health */}
      <SyncOverviewSection overview={overview} />

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
                const latestLog =
                  overview?.latestLogByAccount[account.id] ?? null;
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
                      {latestLog ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs tabular-nums">
                            {formatJalaliShort(latestLog.startedAt ?? '')}
                          </span>
                          <SyncResultLine log={latestLog} />
                        </span>
                      ) : account.lastSyncAt ? (
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
                          onClick={() => openHistory(account)}
                        >
                          <History className="h-3 w-3" />
                          تاریخچه
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
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
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

      {/* Recent syncs */}
      <RecentSyncsSection logs={overview?.recent ?? []} />

      {/* Sync-all result dialog */}
      <Dialog open={syncAllOpen} onOpenChange={setSyncAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>همگام‌سازی همه پایان یافت</DialogTitle>
            <DialogDescription>
              نتیجهٔ همگام‌سازی خودکار حساب‌های متصل.
            </DialogDescription>
          </DialogHeader>
          {syncAllResult ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-success/5 p-4">
                <span className="text-2xl font-bold tabular-nums text-success">
                  {formatNumber(syncAllResult.success)}
                </span>
                <span className="text-xs text-muted-foreground">موفق</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-destructive/5 p-4">
                <span className="text-2xl font-bold tabular-nums text-destructive">
                  {formatNumber(syncAllResult.failed)}
                </span>
                <span className="text-xs text-muted-foreground">ناموفق</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-2xl font-bold tabular-nums text-muted-foreground">
                  {formatNumber(syncAllResult.skipped)}
                </span>
                <span className="text-xs text-muted-foreground">ردشده</span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncAllOpen(false)}
            >
              بستن
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              تاریخچهٔ همگام‌سازی
              {historyAccount
                ? ` — ${historyAccount.brand} / ${historyAccount.username}`
                : ''}
            </DialogTitle>
            <DialogDescription>
              آخرین اجراهای همگام‌سازی این حساب.
            </DialogDescription>
          </DialogHeader>
          {historyLogs === null ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              در حال دریافت…
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              هنوز همگام‌سازی‌ای برای این حساب ثبت نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/40">
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      تاریخ
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      مدت
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      وضعیت
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      دریافت‌شده
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      ذخیره‌شده
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      خطا
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-3 py-2 tabular-nums text-foreground">
                        {formatJalaliDateTime(log.startedAt)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatSyncDuration(log.durationMs) ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <SyncStatusBadge status={log.status} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-foreground">
                        {formatNumber(log.recordsFetched)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-foreground">
                        {formatNumber(log.recordsWritten)}
                      </td>
                      <td className="px-3 py-2 text-xs text-destructive">
                        {log.errorMessage || (log.errorCode ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  if (!iso) return '—';
  try {
    return formatJalaliDate(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString('fa-IR');
  }
}

function formatJalaliDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = formatJalaliDate(d);
    const time = d.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date}، ${time}`;
  } catch {
    return new Date(iso).toLocaleString('fa-IR');
  }
}

function SyncStatusBadge({ status }: { status: SocialSyncRunStatus }) {
  const className = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
    status === 'success' && 'bg-success/10 text-success',
    status === 'error' && 'bg-destructive/10 text-destructive',
    status === 'running' &&
      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  );
  return (
    <span className={className}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'success' && 'bg-success',
          status === 'error' && 'bg-destructive',
          status === 'running' && 'bg-amber-500',
        )}
      />
      {SOCIAL_SYNC_RUN_LABELS[status]}
    </span>
  );
}

/** Compact line: status + fetched→written + short error. */
function SyncResultLine({ log }: { log: SyncOverviewRecent }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <SyncStatusBadge status={log.status} />
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatNumber(log.recordsFetched)} ←{' '}
          {formatNumber(log.recordsWritten)}
        </span>
      </span>
      {log.errorMessage ? (
        <span
          className="max-w-[220px] truncate text-[11px] text-destructive"
          title={log.errorMessage}
        >
          {log.errorMessage}
        </span>
      ) : null}
    </span>
  );
}

/** Platform credential dot. */
function CredentialDot({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 text-[11px] text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      آمادهٔ اتصال
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Credential تنظیم نشده
    </span>
  );
}

/** Top control-center section: platform summary + sync health. */
function SyncOverviewSection({ overview }: { overview: SyncOverview | null }) {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview.platforms.map((p) => (
          <div
            key={p.platform}
            className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SocialPlatformIcon
                  platform={p.platform}
                  className="h-7 w-7 rounded-md"
                  iconClassName="h-4 w-4"
                />
                <span className="text-sm font-semibold text-foreground">
                  {SOCIAL_PLATFORM_LABELS[p.platform]}
                </span>
              </div>
              <CredentialDot configured={p.credentialConfigured} />
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{formatNumber(p.accounts)} حساب</span>
                <span className="text-success">
                  متصل {formatNumber(p.connected)}
                </span>
                {p.error > 0 ? (
                  <span className="text-destructive">
                    خطا {formatNumber(p.error)}
                  </span>
                ) : null}
                {p.notConfigured > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    تنظیم‌نشده {formatNumber(p.notConfigured)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {/* Sync health KPI */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              سلامت همگام‌سازی
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {overview.health.rate === null
                ? '—'
                : `${formatNumber(overview.health.rate)}٪`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {overview.health.total > 0
                ? `${formatNumber(overview.health.success)} موفق از ${formatNumber(overview.health.total)}`
                : 'دادهٔ کافی نیست'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bottom section: the latest sync runs across accounts. */
function RecentSyncsSection({ logs }: { logs: SyncOverviewRecent[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          آخرین همگام‌سازی‌ها
        </h2>
      </div>
      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
          هنوز همگام‌سازی‌ای اجرا نشده است.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  حساب
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  پلتفرم
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  زمان
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  وضعیت
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  رکوردها
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  مدت
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {log.brand}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.username}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <SocialPlatformIcon
                        platform={log.platform}
                        className="h-6 w-6 rounded-md"
                        iconClassName="h-3.5 w-3.5"
                      />
                      <span className="text-muted-foreground">
                        {SOCIAL_PLATFORM_LABELS[log.platform]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatJalaliDateTime(log.startedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <SyncStatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(log.recordsFetched)} ←{' '}
                    {formatNumber(log.recordsWritten)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatSyncDuration(log.durationMs) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
