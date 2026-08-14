'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SocialBrandTrendMetric } from '@/services/social-analytics';
import {
  jalaliAddMonths,
  jalaliMonthName,
  currentJalaliMonth,
} from '@/services/social-analytics';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandSectionTitle } from './shared';

const METRIC_OPTIONS: Array<{
  key: SocialBrandTrendMetric;
  label: string;
}> = [
  { key: 'followers', label: 'دنبال‌کنندگان' },
  { key: 'views', label: 'بازدید' },
  { key: 'engagement', label: 'تعامل' },
];

const RANGE_OPTIONS = [3, 6, 12, 24] as const;

/**
 * Brand performance trend: followers / views / engagement over a selectable
 * window (3 / 6 / 12 / 24 months). Only months with real data are plotted;
 * a metric with no data at all shows an empty state instead of a chart.
 */
export function BrandTrendChart({
  series,
  metric,
  onMetricChange,
  range,
  onRangeChange,
}: {
  series: Array<{ month: string; monthLabel: string; value: number | null }>;
  metric: SocialBrandTrendMetric;
  onMetricChange: (m: SocialBrandTrendMetric) => void;
  range: number;
  onRangeChange: (r: number) => void;
}) {
  const now = currentJalaliMonth();
  const rangeStart = jalaliAddMonths(now, -(range - 1));

  const data = useMemo(
    () => series.filter((p) => p.month >= rangeStart && p.value !== null),
    [series, rangeStart],
  );

  const hasData = data.some((p) => p.value !== null && p.value > 0);

  return (
    <section>
      <BrandSectionTitle
        title="روند عملکرد برند"
        extra={
          <div className="flex items-center gap-1.5">
            {METRIC_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  metric === opt.key &&
                    'bg-surface text-foreground ring-1 ring-border',
                )}
                onClick={() => onMetricChange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {RANGE_OPTIONS.map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  range === r &&
                    'bg-surface text-foreground ring-1 ring-border',
                )}
                onClick={() => onRangeChange(r)}
              >
                {toPersianDigits(String(r))} ماه
              </Button>
            ))}
          </div>
        }
      />
      <div className="rounded-xl border border-border bg-surface/60 p-4">
        {!hasData ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              برای این شاخص در این بازه داده‌ای ثبت نشده است.
            </p>
            <p className="text-[11px] text-muted-foreground">
              {jalaliMonthName(rangeStart)} تا {jalaliMonthName(now)}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  formatter={(value) => [
                    formatNumber(Number(value) || 0),
                    METRIC_OPTIONS.find((o) => o.key === metric)?.label,
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {METRIC_OPTIONS.find((o) => o.key === metric)?.label} — فقط
              ماه‌هایی که داده دارند نمایش داده می‌شوند.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
