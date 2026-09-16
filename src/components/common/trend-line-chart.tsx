'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/utils/persian';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { CHART_PALETTE } from '@/constants/brand-colors';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialTrendSeries, SocialTrendSeriesPoint } from '@/services/social-trends.service';

/** Human label for a series name — brands pass through, platforms localize. */
function seriesLabel(name: string): string {
  return (SOCIAL_PLATFORM_LABELS as Record<string, string>)[name] ?? name;
}

function seriesColor(_name: string, index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/**
 * Shared time-series line chart (Recharts) used by BOTH /social and
 * /command-center. One line per series; X axis is the Jalali month label;
 * months a series lacks data for are rendered as gaps (connectNulls off).
 * Zero fabricated values — whatever the aggregated API returns is what draws.
 */
export function TrendLineChart({
  series,
  height = 'h-[280px]',
}: {
  series: SocialTrendSeries[];
  height?: string;
}) {
  const chartData = useMemo(() => {
    // Union of months across series (sorted); each row carries every series'
    // value or undefined (gap) — no fake zeros between real points.
    const monthSet = new Set<string>();
    for (const s of series) for (const p of s.points) monthSet.add(p.month);
    const months = [...monthSet].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const labelOf = new Map<string, string>();
    for (const s of series)
      for (const p of s.points) labelOf.set(p.month, p.monthLabel);
    return months.map((month) => {
      const row: Record<string, string | number | undefined> = {
        monthLabel: labelOf.get(month) ?? month,
      };
      series.forEach((s, i) => {
        const point: SocialTrendSeriesPoint | undefined = s.points.find(
          (p) => p.month === month,
        );
        row[`s${i}`] = point?.value;
      });
      return row;
    });
  }, [series]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((s, i) => {
      config[`s${i}`] = {
        label: seriesLabel(s.name),
        color: seriesColor(s.name, i),
      };
    });
    return config;
  }, [series]);

  if (series.length === 0 || chartData.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای این بازه زمانی داده‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={chartConfig} className={`${height} w-full`}>
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
                formatter={(value, _name) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{String(_name)}</span>
                    <span className="font-semibold text-foreground">
                      {value === undefined || value === null
                        ? '—'
                        : formatNumber(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          {series.map((_s, i) => (
            <Line
              key={`s${i}`}
              type="monotone"
              dataKey={`s${i}`}
              connectNulls={false}
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
                style={{ backgroundColor: seriesColor(s.name, i) }}
              />
              {seriesLabel(s.name)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
