'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { SocialEngagementTrend } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { getBrandColor, CHART_PALETTE } from '@/constants/brand-colors';

/** Get brand color for chart series — uses centralized palette. */
function brandChartColor(brandName: string, index: number): string {
  return getBrandColor(brandName).chart ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

type BrandFilterPreset = 'all' | 'top5' | 'top10';

const PRESET_LABELS: Record<BrandFilterPreset, string> = {
  all: 'همه برندها',
  top5: '۵ برند برتر',
  top10: '۱۰ برند برتر',
};

function formatCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (v >= 1_000) {
    const k = v / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(v);
}

interface EngagementTrendChartProps {
  trends: SocialEngagementTrend[];
}

/**
 * Multi-brand engagement trend line chart (likes + comments + shares).
 * Follows the same pattern as BrandAudienceTrendChart but plots
 * engagement totals instead of followers.
 */
export function EngagementTrendChart({ trends }: EngagementTrendChartProps) {
  const [activeFilter, setActiveFilter] = useState<BrandFilterPreset>('all');
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggleSeries = (brand: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const sortedTrends = useMemo(
    () =>
      [...trends].sort((a, b) => {
        const aMax = a.points.length > 0 ? a.points[a.points.length - 1].engagement : 0;
        const bMax = b.points.length > 0 ? b.points[b.points.length - 1].engagement : 0;
        return bMax - aMax;
      }),
    [trends],
  );

  const filteredTrends = useMemo(() => {
    if (activeFilter === 'top5') return sortedTrends.slice(0, 5);
    if (activeFilter === 'top10') return sortedTrends.slice(0, 10);
    return sortedTrends;
  }, [sortedTrends, activeFilter]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of filteredTrends) {
      for (const p of t.points) set.add(p.month);
    }
    return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [filteredTrends]);

  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of filteredTrends) {
      for (const p of t.points) map.set(p.month, p.monthLabel);
    }
    return map;
  }, [filteredTrends]);

  const chartData = useMemo(
    () =>
      months.map((month) => {
        const row: Record<string, string | number> = {
          monthLabel: labelOf.get(month) ?? month,
        };
        filteredTrends.forEach((t, i) => {
          const point = t.points.find((p) => p.month === month);
          row[`s${i}`] = point?.engagement ?? 0;
        });
        return row;
      }),
    [months, filteredTrends, labelOf],
  );

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    filteredTrends.forEach((t, i) => {
      config[`s${i}`] = {
        label: t.brand,
        color: brandChartColor(t.brand, i),
      };
    });
    return config;
  }, [filteredTrends]);

  const hasData = filteredTrends.length > 0 && chartData.length > 0;

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(['all', 'top5', 'top10'] as BrandFilterPreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setActiveFilter(preset)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              activeFilter === preset
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          برای این ترکیب برند و بازه زمانی داده‌ای ثبت نشده است.
        </p>
      ) : (
        <div className="flex gap-4">
          {/* Chart area */}
          <div className="min-w-0 flex-1">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <LineChart
                data={chartData}
                margin={{ left: 8, right: 8, top: 8, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={true}
                  vertical={true}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border) / 0.4)"
                />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  reversed
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={56}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-semibold text-foreground">
                            {formatNumber(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                {filteredTrends.map(
                  (t, i) =>
                    !hidden.has(t.brand) && (
                      <Line
                        key={`s${i}`}
                        type="monotone"
                        dataKey={`s${i}`}
                        stroke={`var(--color-s${i})`}
                        strokeWidth={2}
                        dot={{ r: 3, fill: `var(--color-s${i})` }}
                        activeDot={{ r: 5 }}
                      />
                    ),
                )}
              </LineChart>
            </ChartContainer>
          </div>

          {/* Legend — right side, scrollable, toggleable */}
          {filteredTrends.length > 0 && (
            <div className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-2">
              <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                برندها
              </span>
              {filteredTrends.map((t, i) => {
                const isHidden = hidden.has(t.brand);
                return (
                  <button
                    key={t.brand}
                    type="button"
                    onClick={() => toggleSeries(t.brand)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs transition-colors',
                      isHidden
                        ? 'text-muted-foreground/50'
                        : 'text-foreground hover:bg-muted/50',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: brandChartColor(t.brand, i),
                        opacity: isHidden ? 0.3 : 1,
                      }}
                    />
                    <span className="truncate">{t.brand}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
