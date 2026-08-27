'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import type { SocialPlatformStat } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import { formatNumber } from '@/utils/persian';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

type MetricKey = 'followers' | 'views' | 'engagement';

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: 'followers', label: 'دنبال‌کنندگان' },
  { key: 'views', label: 'بازدید' },
  { key: 'engagement', label: 'تعامل' },
];

/** Performance of each platform as horizontal bars; metric is switchable. */
export function PlatformBreakdownChart({
  stats,
}: {
  stats: SocialPlatformStat[];
}) {
  const [metric, setMetric] = useState<MetricKey>('followers');

  const data = useMemo(
    () =>
      [...stats]
        .sort((a, b) => b[metric] - a[metric])
        .map((s) => ({
          platform: s.platform,
          label: SOCIAL_PLATFORM_LABELS[s.platform],
          value: s[metric],
          color: SOCIAL_PLATFORM_BRAND[s.platform].color,
        })),
    [stats, metric],
  );

  const chartConfig: ChartConfig = {
    value: { label: METRIC_OPTIONS.find((o) => o.key === metric)?.label },
  };

  if (stats.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای این ترکیب برند، شبکه و بازه زمانی داده‌ای ثبت نشده است.
      </p>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMetric(option.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              metric === option.key
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full" style={{ direction: 'ltr' }}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 24, top: 4, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, textAnchor: 'end' }}
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {METRIC_OPTIONS.find((o) => o.key === metric)?.label}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatNumber(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((d) => (
              <Cell key={d.platform} fill={d.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {total === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          برای شاخص «{METRIC_OPTIONS.find((o) => o.key === metric)?.label}» در
          این بازه داده‌ای ثبت نشده است.
        </p>
      ) : null}
    </div>
  );
}
