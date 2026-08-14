'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, History, Plus, Settings2 } from 'lucide-react';
import Link from 'next/link';
import {
  decodeAccountKey,
  getBrandSocialAnalytics,
  getSocialAccounts,
  getSocialMetrics,
} from '@/services/social.service';
import type { BrandSocialAnalytics } from '@/services/social.service';
import {
  buildBrandTrendSeries,
  compareBrandPeriods,
  jalaliMonthName,
  latestBrandPeriods,
} from '@/services/social-analytics';
import type { SocialBrandTrendMetric } from '@/services/social-analytics';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricFormDialog } from '@/components/social/metric-form-dialog';
import { MetricHistoryTable } from '@/components/social/metric-history-table';
import { MetricPeriodComparison } from '@/components/social/metric-period-comparison';
import { BrandHeader } from '@/components/social/brand/brand-header';
import { BrandKpis } from '@/components/social/brand/brand-kpis';
import { BrandTrendChart } from '@/components/social/brand/brand-trend-chart';
import {
  BestWorstPlatforms,
  PlatformPerformance,
} from '@/components/social/brand/platform-performance';
import {
  BrandRankings,
  GrowthDrivers,
  PeerComparison,
} from '@/components/social/brand/peer-comparison';
import { PlatformTimeline } from '@/components/social/brand/platform-timeline';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { Button } from '@/components/ui/button';

export default function BrandPerformancePage() {
  const params = useParams();

  const [analytics, setAnalytics] = useState<BrandSocialAnalytics | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [allMetrics, setAllMetrics] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Trend chart state.
  const [trendMetric, setTrendMetric] =
    useState<SocialBrandTrendMetric>('followers');
  const [trendRange, setTrendRange] = useState(12);

  // Metric record / edit dialog (per account).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMetric, setEditMetric] = useState<SocialMetric | null>(null);
  const [dialogAccountId, setDialogAccountId] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    setLoading(true);
    setError(false);
    const parsed = decodeAccountKey(id);
    if (!parsed) {
      setBrand(null);
      setLoading(false);
      return;
    }
    setBrand(parsed.brand);

    Promise.all([
      getBrandSocialAnalytics(parsed.brand),
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ])
      .then(([analytics, accounts, metrics]) => {
        setAnalytics(analytics);
        setAccounts(accounts);
        setAllMetrics(metrics);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [params.id, refreshKey]);

  const brandAccounts = useMemo(
    () => accounts.filter((a) => a.brand === brand),
    [accounts, brand],
  ); // Brand-level this-month vs last-month comparison (all fields).
  const brandComparison = useMemo(() => {
    if (!brand) return [];
    return compareBrandPeriods(accounts, allMetrics, brand);
  }, [accounts, allMetrics, brand]);

  const brandPeriodLabels = useMemo(() => {
    if (!brand) return { current: '', previous: '' };
    const { latest, previous } = latestBrandPeriods(
      accounts,
      allMetrics,
      brand,
    );
    return { current: latest ?? '', previous: previous ?? '' };
  }, [accounts, allMetrics, brand]);

  const trendSeries = useMemo(() => {
    if (!brand) return [];
    return buildBrandTrendSeries(accounts, allMetrics, brand, trendMetric);
  }, [accounts, allMetrics, brand, trendMetric]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || (!loading && !analytics)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">
          اطلاعات این برند یافت نشد یا دریافت نشد.
        </p>
        <Button variant="outline" asChild>
          <Link href="/social">بازگشت به شبکه‌های اجتماعی</Link>
        </Button>
      </div>
    );
  }

  if (!brand || !analytics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Brand header */}
      <BrandHeader brand={brand} overview={analytics.overview} />

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
          <Link href="/social/accounts">
            <Settings2 className="h-3.5 w-3.5" />
            مدیریت حساب‌ها
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
          <Link href="/social">
            <History className="h-3.5 w-3.5" />
            داشبورد شبکه‌های اجتماعی
          </Link>
        </Button>
      </div>

      {/* KPI overview */}
      <BrandKpis overview={analytics.overview} />

      {/* Trend chart */}
      <BrandTrendChart
        series={trendSeries}
        metric={trendMetric}
        onMetricChange={setTrendMetric}
        range={trendRange}
        onRangeChange={setTrendRange}
      />

      {/* Platform performance */}
      <PlatformPerformance rows={analytics.platforms} />

      {/* Best / worst platforms */}
      <BestWorstPlatforms rows={analytics.platforms} />

      {/* Period comparison (brand level) */}
      {brandPeriodLabels.current && brandPeriodLabels.previous ? (
        <MetricPeriodComparison
          items={brandComparison}
          currentPeriodLabel={jalaliMonthName(brandPeriodLabels.current)}
          previousPeriodLabel={jalaliMonthName(brandPeriodLabels.previous)}
        />
      ) : null}

      {/* Peer comparison + rankings */}
      <PeerComparison items={analytics.peers} />
      <BrandRankings items={analytics.rankings} brand={brand} />

      {/* Growth drivers (rule-based) */}
      <GrowthDrivers drivers={analytics.drivers} />

      {/* Freshness timeline */}
      <PlatformTimeline rows={analytics.timeline} />

      {/* Per-account record / history */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            ثبت آمار و تاریخچه حساب‌ها
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              setEditMetric(null);
              setDialogAccountId(brandAccounts[0]?.id ?? null);
              setDialogOpen(true);
            }}
            disabled={brandAccounts.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            ثبت آمار جدید
          </Button>
        </div>

        {brandAccounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
            برای این برند حسابی ثبت نشده است.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {brandAccounts.map((account) => {
              const metrics = allMetrics.filter(
                (m) => m.accountId === account.id,
              );
              return (
                <div
                  key={account.id}
                  className="rounded-xl border border-border bg-surface/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SocialPlatformIcon
                        platform={account.platform}
                        className="h-6 w-6 rounded-md"
                        iconClassName="h-3.5 w-3.5"
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {SOCIAL_PLATFORM_LABELS[account.platform]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {account.username}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setEditMetric(null);
                        setDialogAccountId(account.id);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      ثبت آمار
                    </Button>
                  </div>
                  <MetricHistoryTable
                    metrics={metrics}
                    onEdit={(m) => {
                      setDialogAccountId(account.id);
                      setEditMetric(m);
                      setDialogOpen(true);
                    }}
                    onRecordNew={() => {
                      setDialogAccountId(account.id);
                      setEditMetric(null);
                      setDialogOpen(true);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Record / edit dialog */}
      <MetricFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={
          dialogAccountId
            ? accounts.filter((a) => a.id === dialogAccountId)
            : []
        }
        metric={editMetric}
        onSaved={() => {
          setDialogOpen(false);
          setEditMetric(null);
          setDialogAccountId(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </motion.div>
  );
}
