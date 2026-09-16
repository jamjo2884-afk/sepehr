'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, LineChart as LineChartIcon, TrendingUp, Users, Waypoints } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { TrendLineChart } from '@/components/common/trend-line-chart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/persian';
import type { SocialTrendsPayload, SocialTrendSeries } from '@/services/social-trends.service';

/**
 * Time presets are MONTHLY because social_metrics is monthly-only (verified
 * production reality). "کل تاریخچه" (months: 0) shows the full window the API
 * returned — no fake zero-padding beyond real data.
 */
const TIME_PRESETS = [
  { value: '3m', label: '۳ ماه اخیر', months: 3 },
  { value: '6m', label: '۶ ماه اخیر', months: 6 },
  { value: '12m', label: '۱۲ ماه اخیر', months: 12 },
  { value: 'all', label: 'کل تاریخچه', months: 0 },
] as const;

type TimePreset = (typeof TIME_PRESETS)[number]['value'];

/**
 * The 5 social trend charts with ONE shared filter state (brand multi-select
 * + time window). Rendered by both /social and /command-center — filters are
 * component-local so the two pages stay independent.
 *
 * Server contract: brand_ids is only a NARROWING filter; the API always
 * intersects it with the caller's workspace brands (workspace isolation is
 * enforced server-side, never by the UI).
 */
export function SocialTrendsSection({ className }: { className?: string }) {
  const [data, setData] = useState<SocialTrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [timePreset, setTimePreset] = useState<TimePreset>('12m');

  /** Debounced brand selection that re-queries the server aggregation. */
  const [brandQuery, setBrandQuery] = useState<string[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setBrandQuery(selectedBrands), 350);
    return () => clearTimeout(t);
  }, [selectedBrands]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Server re-aggregates for the selected brands (brand_ids is a
      // narrowing filter — the API still intersects it with the workspace).
      const qs = new URLSearchParams({ months: '36' });
      if (brandQuery.length > 0) qs.set('brand_ids', brandQuery.join(','));
      const r = await fetch(`/api/social/trends?${qs.toString()}`, { cache: 'no-store' });
      const body = (await r.json()) as { ok: boolean } & SocialTrendsPayload;
      if (!r.ok || !body.ok) throw new Error('failed');
      setData(body);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [brandQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Client-side narrowing of already workspace-scoped series. Instant
   * feedback for chart 4 while the debounced server re-query is in flight;
   * the server still re-aggregates (this is a UI nicety, not the boundary). */
  const narrowByBrand = useCallback(
    (series: SocialTrendSeries[]): SocialTrendSeries[] =>
      selectedBrands.length === 0
        ? series
        : series.filter((s) => selectedBrands.includes(s.name)),
    [selectedBrands],
  );

  const cutByWindow = useCallback(
    (series: SocialTrendSeries[]): SocialTrendSeries[] => {
      const preset = TIME_PRESETS.find((p) => p.value === timePreset)!;
      if (!data || data.months.length === 0 || preset.months === 0) return series;
      const months = data.months;
      const startIdx = Math.max(0, months.length - preset.months);
      const window = new Set(months.slice(startIdx));
      return series
        .map((s) => ({ ...s, points: s.points.filter((p) => window.has(p.month)) }))
        .filter((s) => s.points.length > 0);
    },
    [data, timePreset],
  );

  const totalFollowers = useMemo(
    () => cutByWindow([{ name: 'کل', points: data?.totalFollowers ?? [] }]).at(0)?.points ?? [],
    [cutByWindow, data],
  );
  const totalReach = useMemo(
    () => cutByWindow([{ name: 'کل', points: data?.totalReach ?? [] }]).at(0)?.points ?? [],
    [cutByWindow, data],
  );
  const viewsByPlatform = useMemo(
    () => cutByWindow(data?.viewsByPlatform ?? []),
    [cutByWindow, data],
  );
  const followersByBrand = useMemo(
    () => narrowByBrand(cutByWindow(data?.followersByBrand ?? [])),
    [cutByWindow, narrowByBrand, data],
  );
  const followersByPlatform = useMemo(
    () => cutByWindow(data?.followersByPlatform ?? []),
    [cutByWindow, data],
  );

  const hasAnyData =
    totalFollowers.length > 0 ||
    totalReach.length > 0 ||
    viewsByPlatform.length > 0 ||
    followersByBrand.length > 0 ||
    followersByPlatform.length > 0;

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      {/* Shared filters — one state drives all 5 charts */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LineChartIcon className="h-4 w-4 text-primary" />
          روند شبکه‌های اجتماعی
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            برند ({selectedBrands.length === 0 ? 'همه' : `${formatNumber(selectedBrands.length)} انتخاب‌شده`})
          </span>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={selectedBrands.length === 0}
              onClick={() => setSelectedBrands([])}
              label="همه برندها"
            />
            {(data?.brands ?? []).map((brand) => (
              <Chip
                key={brand}
                active={selectedBrands.includes(brand)}
                onClick={() =>
                  setSelectedBrands((prev) =>
                    prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
                  )
                }
                icon={<BrandLogo brand={brand} className="h-6 w-6 rounded-full" iconClassName="text-[11px]" />}
                label={brand}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">بازه زمانی</span>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <Chip
                key={p.value}
                active={timePreset === p.value}
                onClick={() => setTimePreset(p.value)}
                label={p.label}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            واحد زمان نمودارها «ماه» است (تقویم جلالی) — دیتای متریک ماهانه ثبت می‌شود.
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 animate-pulse items-center justify-center rounded-xl border border-border bg-surface" />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-sm text-foreground">خطا در دریافت روند‌ها.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            تلاش دوباره
          </Button>
        </div>
      ) : !hasAnyData ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
          برای این بازه زمانی داده‌ای ثبت نشده است.
        </div>
      ) : (
        <>
          <ChartCard
            icon={<Users className="h-4 w-4 text-primary" />}
            title="روند کل دنبال‌کنندگان"
          >
            <TrendLineChart series={[{ name: 'کل', points: totalFollowers }]} />
          </ChartCard>

          <ChartCard
            icon={<Eye className="h-4 w-4 text-primary" />}
            title="روند بازدید به تفکیک پلتفرم"
            extra={viewsByPlatform.length === 0 ? 'بازدیدی ثبت نشده است' : undefined}
          >
            {viewsByPlatform.length > 0 ? (
              <TrendLineChart series={viewsByPlatform} />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={<Waypoints className="h-4 w-4 text-primary" />}
            title="روند ریچ"
            extra={totalReach.length === 0 ? 'ریچی ثبت نشده است' : undefined}
          >
            {totalReach.length > 0 ? (
              <TrendLineChart series={[{ name: 'کل', points: totalReach }]} />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="روند دنبال‌کنندگان به تفکیک برند"
            extra={
              <span className="text-[11px] text-muted-foreground">
                {selectedBrands.length === 0
                  ? `${formatNumber(followersByBrand.length)} برند`
                  : `${formatNumber(followersByBrand.length)} از ${formatNumber(selectedBrands.length)} برند انتخابی`}
              </span>
            }
          >
            {followersByBrand.length > 0 ? (
              <TrendLineChart series={followersByBrand} height="h-[320px]" />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={<Waypoints className="h-4 w-4 text-primary" />}
            title="روند دنبال‌کنندگان به تفکیک شبکه اجتماعی"
          >
            {followersByPlatform.length > 0 ? (
              <TrendLineChart series={followersByPlatform} height="h-[320px]" />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>
        </>
      )}
    </section>
  );
}

function ChartCard({
  icon,
  title,
  extra,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function EmptyNote() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      برای این بازه زمانی داده‌ای ثبت نشده است.
    </p>
  );
}

function Chip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
