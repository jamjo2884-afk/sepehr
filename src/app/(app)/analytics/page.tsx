'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  GitCompareArrows,
  Inbox,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import {
  buildBrandStats,
  buildBrandTrends,
  buildFollowersTrend,
  buildPlatformStats,
  buildPlatformTrends,
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
import type {
  SocialAccount,
  SocialMetric,
  SocialMonthRange,
  SocialRangePreset,
} from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import { AnalyticsFilterBar } from '@/components/social/analytics/filter-bar';
import { AnalyticsKpiCards } from '@/components/social/analytics/kpi-cards';
import { FollowersTrendChart } from '@/components/social/analytics/followers-trend-chart';
import { MonthlyGrowthChart } from '@/components/social/analytics/monthly-growth-chart';
import { PlatformBreakdownChart } from '@/components/social/analytics/platform-breakdown-chart';
import { BrandAudienceTrendChart } from '@/components/social/analytics/brand-audience-trend-chart';
import { PlatformAudienceTrendChart } from '@/components/social/analytics/platform-audience-trend-chart';
import { BrandComparisonTable } from '@/components/social/analytics/brand-comparison-table';
import { PeriodComparison } from '@/components/social/analytics/period-comparison';
import { SectionTitle } from '@/components/social/analytics/shared';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_COMPARE_BRANDS = 5;

export default function AnalyticsPage() {
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/social/analytics')
      .then((r) => r.json())
      .then((data: { ok: boolean; accounts: SocialAccount[]; metrics: SocialMetric[] }) => {
        if (active) {
          if (data.ok) {
            setRaw({ accounts: data.accounts, metrics: data.metrics });
          } else {
            setRaw(null);
          }
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
    () => [...new Set(accountsAll.map((a) => a.brand || a.brandId || ''))].filter(Boolean),
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

  // Drop selections that no longer exist.
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

  // Brand comparison table: filtered by platform only, so every brand is
  // always compared.
  const brandTableAccounts = useMemo(
    () => filterAccounts(accountsAll, [], selectedPlatforms),
    [accountsAll, selectedPlatforms],
  );

  // ---- Pure analytics computations ----
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
  const platformTrends = useMemo(
    () => buildPlatformTrends(filteredAccounts, metricsAll, range),
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

  const platformStats = useMemo(
    () => buildPlatformStats(filteredAccounts, metricsAll, range, prevRange),
    [filteredAccounts, metricsAll, range, prevRange],
  );
  const brandStats = useMemo(
    () => buildBrandStats(brandTableAccounts, metricsAll, range, prevRange),
    [brandTableAccounts, metricsAll, range, prevRange],
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

  if (loading) {
    return <AnalyticsSkeleton />;
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
          تحلیل عمیق عملکرد برندها، شبکهها و دورههای زمانی
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تحلیل عملکرد
          </h1>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 px-4 text-xs"
            asChild
          >
            <Link href="/social">
              <BarChart3 className="h-4 w-4" />
              داشبورد شبکههای اجتماعی
            </Link>
          </Button>
        </div>
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
          {/* KPI cards */}
          <section>
            <AnalyticsKpiCards kpis={kpis} comparison={kpiComparison} />
          </section>

          {/* Follower trend */}
          <section>
            <SectionTitle icon={TrendingUp} title="روند رشد دنبالکنندگان" />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <FollowersTrendChart
                series={trendSeries}
                overLimitNote={overLimitNote}
              />
            </div>
          </section>

          {/* Monthly growth + platform breakdown */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4">
              <SectionTitle icon={BarChart3} title="رشد ماهانه دنبالکنندگان" />
              <MonthlyGrowthChart points={monthlyGrowth} />
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4">
              <SectionTitle icon={PieChart} title="عملکرد شبکهها" />
              <PlatformBreakdownChart stats={platformStats} />
            </div>
          </section>

          {/* Brand audience trend */}
          <section>
            <SectionTitle
              icon={TrendingUp}
              title="روند مخاطبان برندها"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  مقایسه روند دنبال‌کنندگان برندها در بازه زمانی انتخابی
                </span>
              }
            />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <BrandAudienceTrendChart trends={brandTrends} />
            </div>
          </section>

          {/* Platform audience trend */}
          <section>
            <SectionTitle
              icon={BarChart3}
              title="روند مخاطبان سکوها"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  مقایسه روند دنبال‌کنندگان سکوها در بازه زمانی انتخابی
                </span>
              }
            />
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <PlatformAudienceTrendChart trends={platformTrends} />
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

          {/* Brand comparison table */}
          <section>
            <SectionTitle
              icon={GitCompareArrows}
              title="مقایسه برندها"
              extra={
                <span className="text-[11px] text-muted-foreground">
                  برای مقایسه در نمودار، برندها را از جدول انتخاب علامت بزنید
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
        </>
      )}
    </motion.div>
  );
}

function AnalyticsSkeleton() {
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
