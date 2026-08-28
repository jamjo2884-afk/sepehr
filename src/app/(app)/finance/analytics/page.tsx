'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Inbox,
  Minus,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  FinancePlatformEfficiency,
  FinanceBrandPerformance,
  FinanceScatterPoint,
  FinanceBrandCost,
} from '@/types/finance';
import { formatNumber } from '@/utils/persian';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { BrandHumanCost, BrandTotalCost } from '@/types/team';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  FinanceSubNav,
  BrandFilter,
  BrandCostChart,
} from '@/components/finance/finance-overview';

export default function FinanceAnalyticsPage() {
  const [platformEfficiency, setPlatformEfficiency] = useState<FinancePlatformEfficiency[]>([]);
  const [brandPerformance, setBrandPerformance] = useState<FinanceBrandPerformance[]>([]);
  const [scatterData, setScatterData] = useState<FinanceScatterPoint[]>([]);
  const [brandCosts, setBrandCosts] = useState<FinanceBrandCost[]>([]);
  const [humanCosts, setHumanCosts] = useState<BrandHumanCost[]>([]);
  const [brandTotalCosts, setBrandTotalCosts] = useState<BrandTotalCost[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '';

    fetch(`/api/finance/analytics${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.ok) {
          setPlatformEfficiency(data.platformEfficiency ?? []);
          setBrandPerformance(data.brandPerformance ?? []);
          setScatterData(data.scatterData ?? []);
          setBrandCosts(data.brandCosts ?? []);
          setHumanCosts(data.humanCosts ?? []);
          setBrandTotalCosts(data.brandTotalCosts ?? []);
          setBrands(data.brands ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedBrand, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-96 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            بازدهی مالی
          </h1>
          <p className="text-sm text-muted-foreground">
            اتصال هزینه‌ها به رشد شبکه‌های اجتماعی
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          به‌روزرسانی
        </Button>
      </header>

      <FinanceSubNav />

      {brands.length > 0 && (
        <BrandFilter
          brands={brands}
          selected={selectedBrand}
          onSelect={setSelectedBrand}
        />
      )}

      {/* Platform Efficiency Table */}
      <section className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            بازدهی پلتفرم‌ها (هزینه به ازای هر دنبال‌کننده)
          </h2>
        </div>

        {platformEfficiency.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">
              داده‌ای برای تحلیل بازدهی پلتفرم‌ها وجود ندارد.
            </p>
            <p className="text-xs text-muted-foreground">
              ابتدا هزینه‌هایی با تخصیص پلتفرم ثبت کنید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">پلتفرم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه تخصیص‌یافته</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">رشد دنبال‌کنندگان</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه هر دنبال‌کننده</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {platformEfficiency.map((item) => (
                  <tr key={item.platform} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {item.platformLabel}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {formatNumber(item.allocatedSpend)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={cn(
                        'flex items-center gap-1',
                        item.followerGrowth > 0 ? 'text-success' : item.followerGrowth < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {item.followerGrowth > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : item.followerGrowth < 0 ? (
                          <ArrowDownRight className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {formatNumber(item.followerGrowth)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {item.costPerNewFollower !== null
                        ? formatNumber(Math.round(item.costPerNewFollower))
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        item.growthStatus === 'positive' ? 'bg-success/15 text-success' :
                        item.growthStatus === 'negative' ? 'bg-destructive/15 text-destructive' :
                        item.growthStatus === 'zero' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {item.growthStatus === 'positive' ? 'رشد مثبت' :
                         item.growthStatus === 'negative' ? 'رشد منفی' :
                         item.growthStatus === 'zero' ? 'بدون رشد' :
                         'بدون داده'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Brand Performance */}
      <section className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            عملکرد برندها
          </h2>
        </div>

        {brandPerformance.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">
              داده‌ای برای مقایسه برندها وجود ندارد.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برند</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه کل</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">رشد دنبال‌کنندگان</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه هر دنبال‌کننده</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">مصرف بودجه</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {brandPerformance.map((item) => (
                  <tr key={item.brand} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {item.brand}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {formatNumber(item.totalSpend)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={cn(
                        'flex items-center gap-1',
                        item.followerGrowth > 0 ? 'text-success' : item.followerGrowth < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {item.followerGrowth > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : item.followerGrowth < 0 ? (
                          <ArrowDownRight className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {formatNumber(item.followerGrowth)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {item.costPerNewFollower !== null
                        ? formatNumber(Math.round(item.costPerNewFollower))
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.budgetUsagePercent !== null
                        ? `${formatNumber(Math.round(item.budgetUsagePercent))}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        item.growthStatus === 'positive' ? 'bg-success/15 text-success' :
                        item.growthStatus === 'negative' ? 'bg-destructive/15 text-destructive' :
                        item.growthStatus === 'zero' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {item.growthStatus === 'positive' ? 'رشد مثبت' :
                         item.growthStatus === 'negative' ? 'رشد منفی' :
                         item.growthStatus === 'zero' ? 'بدون رشد' :
                         'بدون داده'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Scatter: Spend vs Growth */}
      <section className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            هزینه در مقابل رشد دنبال‌کنندگان
          </h2>
        </div>

        {scatterData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">
              داده کافی برای نمودار پراکندگی وجود ندارد.
            </p>
            <p className="text-xs text-muted-foreground">
              حداقل به هزینه و رشد یک پلتفرم نیاز است.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برند</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">پلتفرم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">رشد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه/رشد</th>
                </tr>
              </thead>
              <tbody>
                {scatterData.map((point, i) => {
                  const cpf =
                    point.followerGrowth > 0
                      ? Math.round(point.spend / point.followerGrowth)
                      : null;
                  return (
                    <tr key={`${point.brand}-${point.platform}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{point.brand}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{SOCIAL_PLATFORM_LABELS[point.platform] ?? point.platform}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{formatNumber(point.spend)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={cn(
                          point.followerGrowth > 0 ? 'text-success' : point.followerGrowth < 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}>
                          {formatNumber(point.followerGrowth)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {cpf !== null ? formatNumber(cpf) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Human Cost by Brand */}
      {humanCosts.length > 0 && (
        <section className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              هزینه نیروی انسانی به تفکیک برند
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برند</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه ماهانه</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">تعداد نفر</th>
                </tr>
              </thead>
              <tbody>
                {humanCosts.map((hc) => (
                  <tr key={hc.brand} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{hc.brand}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{formatNumber(hc.humanCost)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{hc.memberCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Brand Total Cost (Operational + Human) */}
      {brandTotalCosts.length > 0 && (
        <section className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              هزینه کل برند (عملیاتی + نیروی انسانی)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برند</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه عملیاتی</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه نیروی انسانی</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه کل</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">رشد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه نیرو/رشد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">هزینه کل/رشد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {brandTotalCosts.map((btc) => (
                  <tr key={btc.brand} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{btc.brand}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{formatNumber(btc.operationalCost)}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{formatNumber(btc.humanCost)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{formatNumber(btc.totalCost)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={cn(
                        'flex items-center gap-1',
                        btc.followerGrowth > 0 ? 'text-success' : btc.followerGrowth < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {btc.followerGrowth > 0 ? <ArrowUpRight className="h-3 w-3" /> : btc.followerGrowth < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {formatNumber(btc.followerGrowth)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {btc.humanCostPerNewFollower !== null ? formatNumber(btc.humanCostPerNewFollower) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {btc.totalCostPerNewFollower !== null ? formatNumber(btc.totalCostPerNewFollower) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        btc.growthStatus === 'positive' ? 'bg-success/15 text-success' :
                        btc.growthStatus === 'negative' ? 'bg-destructive/15 text-destructive' :
                        btc.growthStatus === 'zero' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {btc.growthStatus === 'positive' ? 'رشد مثبت' :
                         btc.growthStatus === 'negative' ? 'رشد منفی' :
                         btc.growthStatus === 'zero' ? 'بدون رشد' : 'بدون داده'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Brand Cost Comparison */}
      <section className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            مقایسه هزینه برندها
          </h2>
        </div>
        <BrandCostChart data={brandCosts} />
      </section>
    </motion.div>
  );
}
