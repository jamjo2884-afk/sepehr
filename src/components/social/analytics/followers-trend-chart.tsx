'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { SocialTrendPoint } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { getBrandColor, CHART_PALETTE } from '@/constants/brand-colors';

/** Get brand color for chart series. */
function brandChartColor(brandName: string, index: number): string {
  return getBrandColor(brandName).chart ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

export interface TrendSeries {
  name: string;
  points: SocialTrendPoint[];
}

/** Follower trend over the selected range; one line per series. */
export function FollowersTrendChart({
  series,
  overLimitNote,
}: {
  series: TrendSeries[];
  overLimitNote?: string;
}) {
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) for (const p of s.points) set.add(p.month);
    return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [series]);

  const chartData = useMemo(() => {
    // month → Persian label (e.g. 'مرداد ۱۴۰۴'), from any series having it.
    const labelOf = new Map<string, string>();
    for (const s of series)
      for (const p of s.points) {
        labelOf.set(p.month, p.monthLabel);
      }
    return months.map((month) => {
      const row: Record<string, string | number> = {
        monthLabel: labelOf.get(month) ?? month,
      };
      series.forEach((s, i) => {
        const point = s.points.find((p) => p.month === month);
        row[`s${i}`] = point?.followers ?? 0;
      });
      return row;
    });
  }, [months, series]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((s, i) => {
      config[`s${i}`] = {
        label: s.name,
        color: brandChartColor(s.name, i),
      };
    });
    return config;
  }, [series]);

  if (series.length === 0 || chartData.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای این ترکیب برند، شبکه و بازه زمانی داده‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {overLimitNote ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {overLimitNote}
        </p>
      ) : null}
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatNumber(v)}
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
          {series.map((_, i) => (
            <Line
              key={`s${i}`}
              type="monotone"
              dataKey={`s${i}`}
              stroke={`var(--color-s${i})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          {series.map((s, i) => (
            <span
              key={s.name}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{
                  backgroundColor: brandChartColor(s.name, i),
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
