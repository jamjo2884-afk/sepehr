'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Database,
  GitCompareArrows,
  Inbox,
  PieChart,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  getSocialDashboardData,
  buildAccountRows,
} from '@/services/social.service';
import type { SocialAccountRow } from '@/services/social.service';
import {
  buildBrandStats,
  buildBrandTrends,
  buildFollowersTrend,
  buildPlatformStats,
  computeKpiComparison,
  computeKpisForAccounts,
  distinctMonths,
  filterAccounts,
  jalaliMonthName,
  metricsInMonthRange,
  monthlyGrowthSeries,
  monthRangeOfPreset,
  previousMonthRange,
} from '@/services/social-analytics';
import { rankBrandsByScore } from '@/services/social-score';
import type {
  SocialAccount,
  SocialMetric,
  SocialMonthRange,
  SocialRangePreset,
} from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { AnalyticsFilterBar } from '@/components/social/analytics/filter-bar';
import { AnalyticsKpiCards } from '@/components/social/analytics/kpi-cards';
import { FollowersTrendChart } from '@/components/social/analytics/followers-trend-chart';
import { MonthlyGrowthChart } from '@/components/social/analytics/monthly-growth-chart';
import { PlatformBreakdownChart } from '@/components/social/analytics/platform-breakdown-chart';
import { BrandComparisonTable } from '@/components/social/analytics/brand-comparison-table';
import { PlatformComparisonTable } from '@/components/social/analytics/platform-comparison-table';
import { PeriodComparison } from '@/components/social/analytics/period-comparison';
import { SectionTitle } from '@/components/social/analytics/shared';
import { ScoreRankingTable } from '@/components/social/score-ranking-table';
import { SocialAccountCard } from '@/components/social/account-card';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { useSocialBrandEdits } from '@/stores/social-brands.store';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const MAX_COMPARE_BRANDS = 5;

export default function SocialPage() {
  const [raw, setRaw] = useState<{
    accounts: SocialAccount[];
    metrics: SocialMetric[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Analytical filters.
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    [],
  );
  const [rangePreset, setRangePreset] = useState<SocialRangePreset>('24m');
  const [customRange, setCustomRange] = useState<SocialMonthRange | null>(null);
  const [brandWarning, setBrandWarning] = useState<string | null>(null);

  // Brand management dialog state.
  const [manageOpen, setManageOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(false);

  const { added, removed, setEdits } = useSocialBrandEdits();
  const [draftAdded, setDraftAdded] = useState<string[]>([]);
  const [draftRemoved, setDraftRemoved] = useState<string[]>([]);

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

  const accountsAll = useMemo(() => raw?.accounts ?? [], [raw]);
  const metricsAll = useMemo(() => raw?.metrics ?? [], [raw]);

  // Brands visible in the dashboard (removed ones are hidden; added ones are
  // kept even though they have no accounts yet).
  const visibleBrands = useMemo(() => {
    if (!raw) return [];
    const base = [...new Set(accountsAll.map((a) => a.brand))].filter(
      (b) => !removed.includes(b),
    );
    return [...base, ...added.filter((a) => !base.includes(a))];
  }, [raw, accountsAll, added, removed]);

  const accountsBase = useMemo(
    () => accountsAll.filter((a) => !removed.includes(a.brand)),
    [accountsAll, removed],
  );

  const presentPlatforms = useMemo(() => {
    return [
      ...new Set(accountsBase.map((a) => a.platform)),
    ] as SocialPlatform[];
  }, [accountsBase]);

  const availableMonths = useMemo(
    () => distinctMonths(metricsAll),
    [metricsAll],
  );

  // Drop brand/platform selections that no longer exist.
  useEffect(() => {
    setSelectedBrands((prev) => prev.filter((b) => visibleBrands.includes(b)));
  }, [visibleBrands]);
  useEffect(() => {
    setSelectedPlatforms((prev) =>
      prev.filter((p) => presentPlatforms.includes(p)),
    );
  }, [presentPlatforms]);

  const range = useMemo<SocialMonthRange>(() => {
    if (rangePreset === 'custom') {
      if (customRange) return customRange;
      return {
        start: availableMonths[0] ?? '',
        end: availableMonths[availableMonths.length - 1] ?? '',
      };
    }
    return monthRangeOfPreset(rangePreset);
  }, [rangePreset, customRange, availableMonths]);

  const prevRange = useMemo(() => previousMonthRange(range), [range]);

  const filteredAccounts = useMemo(
    () => filterAccounts(accountsBase, selectedBrands, selectedPlatforms),
    [accountsBase, selectedBrands, selectedPlatforms],
  );

  // Accounts for the brand comparison table: filtered by platform only, so
  // the table always compares every brand.
  const brandTableAccounts = useMemo(
    () => filterAccounts(accountsBase, [], selectedPlatforms),
    [accountsBase, selectedPlatforms],
  );

  // ---- Analytics computations (pure, from the service layer) ----
  const kpis = useMemo(
    () => computeKpisForAccounts(filteredAccounts, metricsAll, range),
    [filteredAccounts, metricsAll, range],
  );
  const prevKpis = useMemo(
    () => computeKpisForAccounts(filteredAccounts, metricsAll, prevRange),
    [filteredAccounts, metricsAll, prevRange],
  );
  const kpiComparison = useMemo(
    () => computeKpiComparison(kpis, prevKpis),
    [kpis, prevKpis],
  );

  const brandTrends = useMemo(
    () => buildBrandTrends(filteredAccounts, metricsAll, range),
    [filteredAccounts, metricsAll, range],
  );

  const aggregateTrend = useMemo(
    () => buildFollowersTrend(filteredAccounts, metricsAll, range),
    [filteredAccounts, metricsAll, range],
  );

  const trendSeries = useMemo(() => {
    if (selectedBrands.length === 0) {
      return [{ name: 'همه برندها', points: aggregateTrend }];
    }
    return selectedBrands.slice(0, MAX_COMPARE_BRANDS).map((brand) => {
      const t = brandTrends.find((x) => x.brand === brand);
      return { name: brand, points: t?.points ?? [] };
    });
  }, [selectedBrands, aggregateTrend, brandTrends]);

  const overLimitNote =
    selectedBrands.length > MAX_COMPARE_BRANDS
      ? `برای نمایش همزمان حداکثر ${formatNumber(
          MAX_COMPARE_BRANDS,
        )} برند میتوانید انتخاب کنید — ${formatNumber(
          selectedBrands.length,
        )} برند انتخاب شده است.`
      : undefined;

  const monthlyGrowth = useMemo(
    () => monthlyGrowthSeries(aggregateTrend),
    [aggregateTrend],
  );

  const brandStats = useMemo(
    () => buildBrandStats(brandTableAccounts, metricsAll, range, prevRange),
    [brandTableAccounts, metricsAll, range, prevRange],
  );

  const platformStats = useMemo(
    () => buildPlatformStats(filteredAccounts, metricsAll, range, prevRange),
    [filteredAccounts, metricsAll, range, prevRange],
  );

  // Brand ranking by Social Performance Score (over the full history, on
  // the FULL dataset so it stays consistent with the brand pages, which
  // score against every brand — the local "removed brand" filter is a UI
  // visibility concern only and must not skew scores).
  const brandRanking = useMemo(
    () => rankBrandsByScore(accountsAll, metricsAll),
    [accountsAll, metricsAll],
  );

  const singleBrand = selectedBrands.length === 1 ? selectedBrands[0] : null;

  // Account rows for the per-account cards at the bottom.
  const accountRows = useMemo(
    () => buildAccountRows(accountsBase, metricsAll),
    [accountsBase, metricsAll],
  );
  const visibleAccountRows = useMemo(() => {
    return accountRows
      .filter(
        (a) =>
          (selectedBrands.length === 0 || selectedBrands.includes(a.brand)) &&
          (selectedPlatforms.length === 0 ||
            selectedPlatforms.includes(a.platform)),
      )
      .sort((a, b) => {
        const av = a.latest?.value ?? 0;
        const bv = b.latest?.value ?? 0;
        return sortAscending ? av - bv : bv - av;
      });
  }, [accountRows, selectedBrands, selectedPlatforms, sortAscending]);

  const groupedAccounts = useMemo(() => {
    const byPlatform = new Map<SocialPlatform, SocialAccountRow[]>();
    for (const account of visibleAccountRows) {
      const list = byPlatform.get(account.platform) ?? [];
      list.push(account);
      byPlatform.set(account.platform, list);
    }
    const totals = new Map<SocialPlatform, number>();
    for (const [platform, list] of byPlatform) {
      totals.set(
        platform,
        list.reduce((sum, a) => sum + (a.latest?.value ?? 0), 0),
      );
    }
    return [...byPlatform.entries()].sort(
      (a, b) => (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0),
    );
  }, [visibleAccountRows]);

  const hasRangeData = useMemo(
    () => metricsInMonthRange(metricsAll, range).length > 0,
    [metricsAll, range],
  );

  const brandCount = useMemo(
    () => new Set(filteredAccounts.map((a) => a.brand)).size,
    [filteredAccounts],
  );
  const platformCount = useMemo(
    () => new Set(filteredAccounts.map((a) => a.platform)).size,
    [filteredAccounts],
  );

  // ---- Handlers ----
  const handleToggleBrand = (brand: string) => {
    if (brand === '__all__') {
      setSelectedBrands([]);
      setBrandWarning(null);
      return;
    }
    if (selectedBrands.includes(brand)) {
      setSelectedBrands((prev) => prev.filter((b) => b !== brand));
      return;
    }
    if (selectedBrands.length >= MAX_COMPARE_BRANDS) {
      setBrandWarning(
        `برای مقایسه همزمان حداکثر ${formatNumber(
          MAX_COMPARE_BRANDS,
        )} برند میتوانید انتخاب کنید.`,
      );
      return;
    }
    setSelectedBrands((prev) => [...prev, brand]);
    setBrandWarning(null);
  };

  const handleTogglePlatform = (platform: string) => {
    if (platform === '__all__') {
      setSelectedPlatforms([]);
      return;
    }
    const p = platform as SocialPlatform;
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleCustomRangeChange = (r: SocialMonthRange) => {
    setCustomRange(r);
    setRangePreset('custom');
  };

  const resetFilters = () => {
    setSelectedBrands([]);
    setSelectedPlatforms([]);
    setRangePreset('24m');
    setCustomRange(null);
    setBrandWarning(null);
  };

  const handleOpenManage = (open: boolean) => {
    setManageOpen(open);
    if (open) {
      setDraftAdded(added);
      setDraftRemoved(removed);
      setNewBrandName('');
      setAddError(null);
    }
  };

  const handleAddBrand = () => {
    const name = newBrandName.trim();
    if (!name) {
      setAddError('نام برند را وارد کنید.');
      return;
    }
    if (visibleBrands.includes(name) || draftAdded.includes(name)) {
      setAddError('این برند قبلاً وجود دارد.');
      return;
    }
    setDraftAdded((prev) => [...prev, name]);
    setDraftRemoved((prev) => prev.filter((r) => r !== name));
    setNewBrandName('');
    setAddError(null);
  };

  const handleRemoveBrand = (name: string) => {
    setDraftRemoved((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setDraftAdded((prev) => prev.filter((a) => a !== name));
  };

  const handleRestoreBrand = (name: string) => {
    setDraftRemoved((prev) => prev.filter((r) => r !== name));
  };

  const handleSave = () => {
    setEdits(draftAdded, draftRemoved);
    setManageOpen(false);
  };

  // Dialog brands (draft) — declared before the loading early return.
  const dialogBrands = useMemo(() => {
    if (!raw) return [];
    const base = visibleBrands.filter((b) => !draftRemoved.includes(b));
    return [...base, ...draftAdded.filter((a) => !base.includes(a))];
  }, [raw, visibleBrands, draftAdded, draftRemoved]);

  if (loading) {
    return <SocialDashboardSkeleton />;
  }

  if (!raw) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface/60 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-foreground">
          خطا در دریافت داده‌های شبکه‌های اجتماعی. لطفاً دوباره تلاش کنید.
        </p>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          تلاش دوباره
        </Button>
      </div>
    );
  }

  const manageDialog = (
    <Dialog open={manageOpen} onOpenChange={handleOpenManage}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          مدیریت برندها
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>مدیریت برندها</DialogTitle>
          <DialogDescription>
            برندها را به‌صورت دستی اضافه یا حذف کنید. این تغییرات فقط در این
            مرورگر ذخیره می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={newBrandName}
              onChange={(e) => {
                setNewBrandName(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddBrand();
              }}
              placeholder="نام برند جدید…"
            />
            <Button onClick={handleAddBrand} className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" />
              افزودن
            </Button>
          </div>
          {addError ? (
            <p className="text-xs text-destructive">{addError}</p>
          ) : null}
        </div>

        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {dialogBrands.map((brand) => (
            <div
              key={brand}
              className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {brand}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveBrand(brand)}
                aria-label={`حذف ${brand}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {dialogBrands.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              برندی وجود ندارد.
            </p>
          ) : null}
        </div>

        {draftRemoved.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              برندهای حذف‌شده
            </p>
            {draftRemoved.map((brand) => (
              <div
                key={brand}
                className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface/20 px-3 py-2"
              >
                <span className="truncate text-sm text-muted-foreground line-through">
                  {brand}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => handleRestoreBrand(brand)}
                  aria-label={`بازگردانی ${brand}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setManageOpen(false)}>
            انصراف
          </Button>
          <Button onClick={handleSave}>ذخیره اطلاعات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          داشبورد تحلیل و مقایسه برندها و شبکه‌های اجتماعی
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            شبکه‌های اجتماعی
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              asChild
            >
              <Link href="/social/accounts">
                <Database className="h-3.5 w-3.5" />
                مدیریت آمار
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatNumber(brandCount)} برند در {formatNumber(platformCount)}{' '}
          پلتفرم — {formatNumber(filteredAccounts.length)} اکانت
        </p>
      </header>

      {/* Filters */}
      <AnalyticsFilterBar
        brands={visibleBrands}
        selectedBrands={selectedBrands}
        onToggleBrand={handleToggleBrand}
        platforms={presentPlatforms}
        selectedPlatforms={selectedPlatforms}
        onTogglePlatform={handleTogglePlatform}
        rangePreset={rangePreset}
        onPresetChange={(p) => {
          if (p === 'custom' && !customRange) {
            setCustomRange({
              start: availableMonths[0] ?? '',
              end: availableMonths[availableMonths.length - 1] ?? '',
            });
          }
          setRangePreset(p);
        }}
        customRange={customRange}
        onCustomRangeChange={handleCustomRangeChange}
        availableMonths={availableMonths}
        manageButton={manageDialog}
      />

      {!hasRangeData ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            برای این ترکیب برند، شبکه و بازه زمانی داده‌ای ثبت نشده است.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            بازه انتخاب‌شده: {jalaliMonthName(range.start)} —{' '}
            {jalaliMonthName(range.end)}
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            بازنشانی فیلترها
          </Button>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <section>
            <AnalyticsKpiCards kpis={kpis} comparison={kpiComparison} />
          </section>

          {/* Follower trend chart */}
          <section>
            <SectionTitle icon={TrendingUp} title="روند رشد دنبال‌کنندگان" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <FollowersTrendChart
                series={trendSeries}
                overLimitNote={overLimitNote}
              />
            </div>
          </section>

          {/* Monthly growth chart */}
          <section>
            <SectionTitle icon={BarChart3} title="رشد ماهانه دنبال‌کنندگان" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <MonthlyGrowthChart points={monthlyGrowth} />
            </div>
          </section>

          {/* Platform breakdown */}
          <section>
            <SectionTitle icon={PieChart} title="عملکرد شبکه‌ها" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <PlatformBreakdownChart stats={platformStats} />
            </div>
          </section>

          {/* Brand comparison table */}
          <section>
            <SectionTitle
              icon={GitCompareArrows}
              title="مقایسه برندها"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  برای مقایسه در نمودار، برندها را از ستون انتخاب علامت بزنید
                </span>
              }
            />
            <BrandComparisonTable
              stats={brandStats}
              selectedBrands={selectedBrands}
              onToggle={handleToggleBrand}
              note={brandWarning ?? undefined}
            />
          </section>

          {/* Platform comparison table (when one brand selected) */}
          <section>
            <SectionTitle icon={Share2} title="مقایسه عملکرد شبکه‌ها" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <PlatformComparisonTable
                stats={platformStats}
                brand={singleBrand}
              />
            </div>
          </section>

          {/* Period comparison */}
          <section>
            <SectionTitle icon={CalendarRange} title="مقایسه با دوره قبل" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <PeriodComparison
                items={kpiComparison}
                rangeLabel={`${jalaliMonthName(range.start)} — ${jalaliMonthName(range.end)}`}
              />
            </div>
          </section>

          {/* Brand ranking by Social Performance Score */}
          <ScoreRankingTable rows={brandRanking} accounts={accountsAll} />
        </>
      )}

      {/* Per-account cards, grouped by platform */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle icon={Users} title="اکانت‌ها" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setSortAscending((v) => !v)}
          >
            {sortAscending ? 'کمترین فالوور' : 'بیشترین فالوور'}
          </Button>
        </div>

        {groupedAccounts.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <p className="py-6 text-center text-sm text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groupedAccounts.map(([platform, accounts]) => (
              <div key={platform} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
                  <SocialPlatformIcon
                    platform={platform}
                    className="h-6 w-6 rounded-md"
                    iconClassName="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {SOCIAL_PLATFORM_LABELS[platform]}
                  </span>
                  <span className="mr-auto text-[11px] text-muted-foreground">
                    {formatNumber(accounts.length)} اکانت
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {accounts.map((account, i) => (
                    <SocialAccountCard
                      key={`${account.brand}-${account.platform}-${account.handle}-${i}`}
                      account={account}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

function SocialDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
