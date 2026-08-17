'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Inbox,
  LayoutGrid,
  Share2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  buildAccountRows,
  getSocialDashboardData,
} from '@/services/social.service';
import {
  buildFollowersTrend,
  buildPlatformStats,
  computeKpiComparison,
  computeKpisForAccounts,
  distinctMonths,
  filterAccounts,
  jalaliMonthName,
  metricsInMonthRange,
  monthRangeOfPreset,
  previousMonthRange,
} from '@/services/social-analytics';
import type {
  SocialAccount,
  SocialMetric,
  SocialMonthRange,
  SocialRangePreset,
} from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { AnalyticsFilterBar } from '@/components/social/analytics/filter-bar';
import { FollowersTrendChart } from '@/components/social/analytics/followers-trend-chart';
import { PlatformBreakdown } from '@/components/social/platform-breakdown';
import { PlatformComparisonTable } from '@/components/social/analytics/platform-comparison-table';
import { SectionTitle } from '@/components/social/analytics/shared';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { formatNumber } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AudiencePage() {
  const [raw, setRaw] = useState<{
    accounts: SocialAccount[];
    metrics: SocialMetric[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    [],
  );
  const [rangePreset, setRangePreset] = useState<SocialRangePreset>('24m');
  const [customRange, setCustomRange] = useState<SocialMonthRange | null>(null);

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

  const brands = useMemo(
    () => [...new Set(accountsAll.map((a) => a.brand))],
    [accountsAll],
  );
  const presentPlatforms = useMemo(
    () => [...new Set(accountsAll.map((a) => a.platform))] as SocialPlatform[],
    [accountsAll],
  );
  const availableMonths = useMemo(
    () => distinctMonths(metricsAll),
    [metricsAll],
  );

  useEffect(() => {
    setSelectedBrands((prev) => prev.filter((b) => brands.includes(b)));
  }, [brands]);
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
    () => filterAccounts(accountsAll, selectedBrands, selectedPlatforms),
    [accountsAll, selectedBrands, selectedPlatforms],
  );

  // ---- Pure analytics ----
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
  const followersComparison = kpiComparison.find((c) => c.key === 'followers');

  const aggregateTrend = useMemo(
    () => buildFollowersTrend(filteredAccounts, metricsAll, range),
    [filteredAccounts, metricsAll, range],
  );
  const trendSeries = useMemo(
    () => [{ name: 'کل مخاطبان', points: aggregateTrend }],
    [aggregateTrend],
  );

  const platformStats = useMemo(
    () => buildPlatformStats(filteredAccounts, metricsAll, range, prevRange),
    [filteredAccounts, metricsAll, range, prevRange],
  );

  // Platform share across ALL accounts (latest snapshot) — audience is a
  // portfolio snapshot, not a period flow.
  const accountRows = useMemo(
    () => buildAccountRows(accountsAll, metricsAll),
    [accountsAll, metricsAll],
  );
  const visibleAccountRows = useMemo(
    () =>
      accountRows.filter(
        (a) =>
          (selectedBrands.length === 0 || selectedBrands.includes(a.brand)) &&
          (selectedPlatforms.length === 0 ||
            selectedPlatforms.includes(a.platform)),
      ),
    [accountRows, selectedBrands, selectedPlatforms],
  );

  const topAccounts = useMemo(
    () =>
      [...visibleAccountRows]
        .sort((a, b) => (b.latest?.value ?? 0) - (a.latest?.value ?? 0))
        .slice(0, 10),
    [visibleAccountRows],
  );

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

  const handleToggleBrand = (brand: string) => {
    if (brand === '__all__') {
      setSelectedBrands([]);
      return;
    }
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
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
  };

  if (loading) {
    return <AudienceSkeleton />;
  }

  if (!raw) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface/60 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-foreground">
          خطا در دریافت دادههای شبکههای اجتماعی. لطفاً دوباره تلاش کنید.
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
          شناخت مخاطبان، توزیع شبکهها و اکانتهای برتر
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          تحلیل مخاطبان
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(brandCount)} برند در {formatNumber(platformCount)}{' '}
          پلتفرم — {formatNumber(filteredAccounts.length)} اکانت
        </p>
      </header>

      <AnalyticsFilterBar
        brands={brands}
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
      />

      {/* Audience KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AudienceKpi
          icon={Users}
          label="کل مخاطبان"
          value={formatNumber(kpis.followers)}
          trend={followersComparison?.changePct ?? 0}
        />
        <AudienceKpi
          icon={LayoutGrid}
          label="اکانتهای فعال"
          value={formatNumber(kpis.accountCount)}
        />
        <AudienceKpi
          icon={Building2}
          label="برندها"
          value={formatNumber(brandCount)}
        />
        <AudienceKpi
          icon={Share2}
          label="شبکهها"
          value={formatNumber(platformCount)}
        />
      </section>

      {!hasRangeData ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            برای این ترکیب برند، شبکه و بازه زمانی دادهای ثبت نشده است.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            بازه انتخابشده: {jalaliMonthName(range.start)} —{' '}
            {jalaliMonthName(range.end)}
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            بازنشانی فیلترها
          </Button>
        </div>
      ) : (
        <>
          {/* Audience share + trend */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4">
              <SectionTitle
                icon={Share2}
                title="توزیع مخاطبان بر اساس شبکه"
                extra={
                  <span className="text-[11px] text-muted-foreground">
                    آخرین آمار ثبتشده
                  </span>
                }
              />
              <PlatformBreakdown accounts={visibleAccountRows} />
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4">
              <SectionTitle icon={TrendingUp} title="روند رشد مخاطبان" />
              <FollowersTrendChart series={trendSeries} />
            </div>
          </section>

          {/* Top accounts */}
          <section>
            <SectionTitle
              icon={Users}
              title="اکانتهای برتر"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  بر اساس آخرین تعداد دنبالکننده
                </span>
              }
            />
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/40 text-xs text-muted-foreground">
                    <th className="w-14 px-4 py-3 text-right font-medium">
                      رتبه
                    </th>
                    <th className="px-3 py-3 text-right font-medium">اکانت</th>
                    <th className="px-3 py-3 text-right font-medium">شبکه</th>
                    <th className="px-3 py-3 text-right font-medium">برند</th>
                    <th className="px-3 py-3 text-right font-medium">
                      دنبالکنندگان
                    </th>
                    <th className="px-4 py-3 text-right font-medium">رشد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topAccounts.map((account, index) => (
                    <tr
                      key={`${account.brand}-${account.platform}-${account.handle}`}
                      className="transition-colors duration-150 hover:bg-primary/5"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                            index === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : index < 3
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {formatNumber(index + 1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground">
                        {account.handle ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <SocialPlatformIcon
                            platform={account.platform}
                            className="h-5 w-5 rounded-md"
                            iconClassName="h-3 w-3"
                          />
                          <span className="text-muted-foreground">
                            {SOCIAL_PLATFORM_LABELS[account.platform]}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {account.brand}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-foreground">
                        {formatNumber(account.latest?.value ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <AccountGrowth value={account.growthPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Platform comparison */}
          <section>
            <SectionTitle
              icon={Share2}
              title="مقایسه عملکرد شبکهها"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  {jalaliMonthName(range.start)} — {jalaliMonthName(range.end)}
                </span>
              }
            />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <PlatformComparisonTable stats={platformStats} brand={null} />
            </div>
          </section>
        </>
      )}
    </motion.div>
  );
}

function AudienceKpi({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend?: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {trend !== undefined ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              trend > 0
                ? 'bg-success/10 text-success'
                : trend < 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
            )}
            dir="ltr"
          >
            {trend > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : trend < 0 ? (
              <ArrowDown className="h-3 w-3" />
            ) : null}
            {formatNumber(Math.abs(Math.round(trend * 10) / 10))}٪
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function AccountGrowth({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {formatNumber(0)}٪
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold',
        value > 0 ? 'text-success' : 'text-destructive',
      )}
    >
      {value > 0 ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {formatNumber(Math.abs(Math.round(value * 10) / 10))}٪
    </span>
  );
}

function AudienceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
