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
import type {
  SocialTrendSeries,
  SocialTrendSeriesPoint,
} from '@/services/social-trends.service';

/** Human label for a series name — brands pass through, platforms localize. */
function seriesLabel(name: string): string {
  return (SOCIAL_PLATFORM_LABELS as Record<string, string>)[name] ?? name;
}

function seriesColor(_name: string, index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export interface TrendLineChartProps {
  series: SocialTrendSeries[];
  height?: string;
  /**
   * ZERO-FILL mode (flow metrics like views): months a series has no point
   * for render as 0 so every platform stays visible across the whole window.
   * Default (snapshot metrics like followers): missing months stay gaps —
   * no fabricated values between real snapshots.
   */
  zeroFill?: boolean;
  /**
   * Two-level tooltip: when a series carries a `byBrand` split, the tooltip
   * shows the brand breakdown under the platform value for the hovered
   * month. Only meaningful with per-platform series.
   */
  tooltipBreakdown?: boolean;
}

/**
 * Shared time-series line chart (Recharts) used by BOTH /social and
 * /command-center. One line per series; X axis is the Jalali month label.
 */
export function TrendLineChart({
  series,
  height = 'h-[280px]',
  zeroFill = false,
  tooltipBreakdown = false,
}: TrendLineChartProps) {
  const chartData = useMemo(() => {
    // Union of months across series (sorted); each row carries every series'
    // value (zero-filled when zeroFill) or undefined (gap).
    const monthSet = new Set<string>();
    for (const s of series) for (const p of s.points) monthSet.add(p.month);
    const months = [...monthSet].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const labelOf = new Map<string, string>();
    for (const s of series)
      for (const p of s.points) labelOf.set(p.month, p.monthLabel);
    return months.map((month) => {
      const row: Record<string, unknown> = {
        monthLabel: labelOf.get(month) ?? month,
        month,
      };
      series.forEach((s, i) => {
        const point: SocialTrendSeriesPoint | undefined = s.points.find(
          (p) => p.month === month,
        );
        row[`s${i}`] =
          point?.value ?? (zeroFill && months.length > 0 ? 0 : undefined);
      });
      // Second-level data: per-brand values of each platform series at this
      // month (only series that actually have a split at this month).
      if (tooltipBreakdown) {
        series.forEach((s, i) => {
          if (!s.byBrand) return;
          const parts: { brand: string; value: number }[] = [];
          for (const b of s.byBrand) {
            const bp = b.points.find((p) => p.month === month);
            if (bp) parts.push({ brand: b.name, value: bp.value });
          }
          if (parts.length > 0) row[`b${i}`] = parts;
        });
      }
      return row;
    });
  }, [series, zeroFill, tooltipBreakdown]);

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

  // Any series with ≤1 real point (or sparse snapshot gaps) needs visible
  // dots — a lone point otherwise renders nothing at all.
  const hasSparseSeries = series.some((s) => s.points.length <= 1);

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
                formatter={(value, _name, payload) => {
                  const idx = series.findIndex((_s, i) => `s${i}` === _name);
                  const row =
                    payload && typeof payload === 'object'
                      ? (payload as Record<string, unknown>)
                      : undefined;
                  const breakdown =
                    tooltipBreakdown && idx >= 0
                      ? (row?.[`b${idx}`] as
                          { brand: string; value: number }[] | undefined)
                      : undefined;
                  return (
                    <div className="flex w-full flex-col gap-1 text-xs">
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {String(_name)}
                        </span>
                        <span className="font-semibold text-foreground">
                          {value === undefined || value === null
                            ? '—'
                            : formatNumber(Number(value))}
                        </span>
                      </div>
                      {breakdown && breakdown.length > 0 ? (
                        <div className="flex w-full flex-col gap-0.5 border-t border-border/60 pt-1">
                          {breakdown.map((b) => (
                            <div
                              key={b.brand}
                              className="flex w-full items-center justify-between gap-3"
                            >
                              <span className="text-muted-foreground/80">
                                {b.brand}
                              </span>
                              <span className="font-medium text-foreground/90">
                                {formatNumber(b.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }}
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
              // A single-point series draws no line segment — without a dot
              // it would be INVISIBLE (e.g. a brand with one month of data).
              dot={hasSparseSeries ? { r: 3 } : false}
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
