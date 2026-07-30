'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { SocialTrendSeries } from '@/types/domain';
import { SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatNumber, toJalali } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';

/**
 * 30-day engagement line chart with a platform selector.
 * The first series in `trends` is selected by default.
 */
export function EngagementChart({
  trends,
  selected,
  onSelect,
}: {
  trends: SocialTrendSeries[];
  selected: string;
  onSelect: (platform: string) => void;
}) {
  const active = useMemo(
    () =>
      trends.find((t) => t.platform === selected) ?? trends[0] ?? {
        platform: 'instagram' as const,
        label: '',
        points: [],
      },
    [trends, selected],
  );

  const brand = SOCIAL_PLATFORM_BRAND[active.platform];
  const chartData = useMemo(
    () =>
      active.points.map((p) => ({
        date: p.date,
        engagement: p.engagement,
        label: toJalali(new Date(p.date)).day.toString(),
      })),
    [active],
  );

  const chartConfig: ChartConfig = {
    engagement: {
      label: active.label,
      color: brand.color,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {trends.map((series) => {
          const isActive = series.platform === active.platform;
          return (
            <button
              key={series.platform}
              type="button"
              onClick={() => onSelect(series.platform)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              <SocialPlatformIcon
                platform={series.platform}
                className="h-5 w-5 rounded-full"
                iconClassName="h-3 w-3"
              />
              {series.label}
            </button>
          );
        })}
      </div>

      <ChartContainer config={chartConfig} className="h-[260px] w-full">
        <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={4}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const raw = payload?.[0]?.payload?.date as string | undefined;
                  return raw ? toJalali(new Date(raw)).day.toString() : '';
                }}
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">تعامل</span>
                    <span className="font-semibold text-foreground">
                      {formatNumber(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="engagement"
            stroke={brand.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
