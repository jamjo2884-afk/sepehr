'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { SocialAccountRow } from '@/services/social.service';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';

/**
 * Monthly follower-trend line chart with a platform selector.
 * For the selected platform, sums followers across all brands per month
 * and draws the trajectory over the full data range.
 */
export function EngagementChart({
  accounts,
  months,
  selected,
  onSelect,
}: {
  accounts: SocialAccountRow[];
  months: string[];
  selected: string;
  onSelect: (platform: string) => void;
}) {
  const platformsWith = useMemo(() => {
    const set = new Set<SocialPlatform>();
    for (const a of accounts) set.add(a.platform);
    return [...set];
  }, [accounts]);

  const active = (platformsWith.find((p) => p === selected) ??
    platformsWith[0]) as SocialPlatform | undefined;
  const brand = active ? SOCIAL_PLATFORM_BRAND[active] : null;

  const chartData = useMemo(() => {
    if (!active) return [];
    const series = accounts.filter((a) => a.platform === active);
    return months.map((m) => {
      let total = 0;
      for (const a of series) {
        const point = a.series.find((p) => p.month === m);
        if (point) total += point.value;
      }
      return { month: m, total };
    });
  }, [accounts, months, active]);

  const chartConfig: ChartConfig = active
    ? {
        total: {
          label: SOCIAL_PLATFORM_LABELS[active],
          color: brand?.color,
        },
      }
    : {};

  if (!active) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {platformsWith.map((platform) => {
          const isActive = platform === active;
          return (
            <button
              key={platform}
              type="button"
              onClick={() => onSelect(platform)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              <SocialPlatformIcon
                platform={platform}
                className="h-5 w-5 rounded-full"
                iconClassName="h-3 w-3"
              />
              {SOCIAL_PLATFORM_LABELS[platform]}
            </button>
          );
        })}
      </div>

      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={3}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={52}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">فالوور</span>
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
            dataKey="total"
            stroke={brand!.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
