'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BrainCircuit, Lightbulb, PieChart, Trophy } from 'lucide-react';

import {
  buildBrandGrowthDrivers,
  buildBrandOverview,
  buildBrandPeerComparison,
  buildBrandPlatformPerformance,
  buildBrandPlatformTimeline,
  buildBrandRankings,
} from '@/services/social-analytics';
import { rankBrandsByScore } from '@/services/social-score';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { ScoreRankingTable } from '@/components/social/score-ranking-table';
import { BrandKpis } from '@/components/social/brand/brand-kpis';
import {
  BrandRankings,
  GrowthDrivers,
  PeerComparison,
} from '@/components/social/brand/peer-comparison';
import { PlatformTimeline } from '@/components/social/brand/platform-timeline';
import { SectionTitle } from '@/components/social/analytics/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/utils/persian';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function IntelligencePage() {
  const [raw, setRaw] = useState<{
    accounts: SocialAccount[];
    metrics: SocialMetric[];
  } | null>(null);
  const [intelligence, setIntelligence] = useState<Array<{
    brand: string;
    brandId: string | null;
    totalSpend: number;
    totalBudget: number;
    budgetUtilization: number;
    totalFollowers: number;
    followerGrowth: number;
    growthRate: number;
    costPerFollower: number;
    costPerNewFollower: number | null;
    operationalCost: number;
    humanCost: number;
    totalCost: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch('/api/social/analytics').then((r) => r.json()),
      fetch('/api/intelligence').then((r) => r.json()),
    ])
      .then(([socialData, intelData]) => {
        if (active) {
          if (socialData.ok) {
            setRaw({ accounts: socialData.accounts, metrics: socialData.metrics });
          } else {
            setRaw(null);
          }
          if (intelData.ok) {
            setIntelligence(intelData.brands ?? []);
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

  // Default to the highest-scored brand so the page opens on something
  // meaningful.
  const brandRanking = useMemo(
    () => rankBrandsByScore(accountsAll, metricsAll),
    [accountsAll, metricsAll],
  );

  useEffect(() => {
    if (selectedBrand) return;
    const top = brandRanking
      .filter((r) => r.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    setSelectedBrand(top?.brand ?? brands[0] ?? '');
  }, [brandRanking, brands, selectedBrand]);

  // Keep the selection valid when the dataset changes.
  useEffect(() => {
    if (selectedBrand && !brands.includes(selectedBrand)) {
      setSelectedBrand(brands[0] ?? '');
    }
  }, [brands, selectedBrand]);

  const brandInsights = useMemo(() => {
    if (!selectedBrand) return null;
    const platforms = buildBrandPlatformPerformance(
      accountsAll,
      metricsAll,
      selectedBrand,
    );
    return {
      overview: buildBrandOverview(accountsAll, metricsAll, selectedBrand),
      platforms,
      peers: buildBrandPeerComparison(accountsAll, metricsAll, selectedBrand),
      rankings: buildBrandRankings(accountsAll, metricsAll, selectedBrand),
      drivers: buildBrandGrowthDrivers(platforms),
      timeline: buildBrandPlatformTimeline(
        accountsAll,
        metricsAll,
        selectedBrand,
      ),
    };
  }, [accountsAll, metricsAll, selectedBrand]);

  if (loading) {
    return <IntelligenceSkeleton />;
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
          بینشهای هوشمند از دادههای واقعی — بدون متن ساختگی
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          هوش رسانهای
        </h1>
        <p className="text-sm text-muted-foreground">
          امتیاز عملکرد برندها و تحلیل عمیق هر برند نسبت به میانگین بازار
        </p>
      </header>

      {/* Overall brand ranking */}
      <ScoreRankingTable rows={brandRanking} accounts={accountsAll} />

      {/* Cross-Domain Intelligence: Finance + Social */}
      {intelligence.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle
            icon={PieChart}
            title="بینش مالی و اجتماعی"
            extra={
              <span className="text-[11px] text-muted-foreground">
                هزینه، رشد و بازدهی هر برند
              </span>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {intelligence.slice(0, 9).map((item) => (
              <div
                key={item.brandId ?? item.brand}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {item.brand}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatNumber(item.totalFollowers)} فالوور
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">هزینه کل:</span>{' '}
                    <span className="font-medium text-foreground">
                      {formatNumber(item.totalCost)} تومان
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">رشد:</span>{' '}
                    <span className="font-medium text-foreground">
                      {item.followerGrowth > 0 ? '+' : ''}{formatNumber(item.followerGrowth)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">هزینه/فالوور:</span>{' '}
                    <span className="font-medium text-foreground">
                      {item.costPerFollower > 0 ? formatNumber(Math.round(item.costPerFollower)) : '—'} تومان
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">بازدهی بودجه:</span>{' '}
                    <span className="font-medium text-foreground">
                      {Math.round(item.budgetUtilization)}٪
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(item.budgetUtilization, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Brand deep-dive */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            icon={BrainCircuit}
            title="تحلیل عمیق برند"
            extra={
              <span className="text-[11px] text-muted-foreground">
                برند را برای تحلیل انتخاب کنید
              </span>
            }
          />
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue placeholder="انتخاب برند" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {brandInsights ? (
          <>
            <BrandKpis overview={brandInsights.overview} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface/60 p-4">
                <PeerComparison items={brandInsights.peers} />
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-surface/60 p-4">
                  <GrowthDrivers drivers={brandInsights.drivers} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BrandRankings
                items={brandInsights.rankings}
                brand={selectedBrand}
              />
              <div className="rounded-xl border border-border bg-surface/60 p-4">
                <PlatformTimeline rows={brandInsights.timeline} />
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 p-4 text-xs text-muted-foreground">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
              همهٔ بینشها مستقیماً از دادههای واقعی ثبتشده استخراج میشوند و هیچ
              گزارهٔ ساختگی یا تولیدشده توسط هوش مصنوعی وجود ندارد.
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
            برندی انتخاب نشده است.
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-warning" />
        امتیاز برندها ۰ تا ۱۰۰ — بر اساس دادههای واقعی
      </p>
    </motion.div>
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-10 w-56" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
