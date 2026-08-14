'use client';

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import type { SocialMonthlyGrowthPoint } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatGrowthPct } from './shared';

/** Month-over-month follower growth as a green/red bar chart. */
export function MonthlyGrowthChart({
  points,
}: {
  points: SocialMonthlyGrowthPoint[];
}) {
  const chartConfig: ChartConfig = {
    growth: { label: 'رشد ماهانه' },
  };

  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای نمایش رشد ماهانه حداقل به دو ماه داده در بازه انتخاب‌شده نیاز است.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart
        data={points}
        margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
      >
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
          width={44}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${formatNumber(v)}٪`}
        />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">رشد</span>
                  <span className="font-semibold text-foreground">
                    {formatGrowthPct(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="growthPct" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {points.map((point) => (
            <Cell
              key={point.month}
              fill={
                point.growthPct >= 0
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--destructive))'
              }
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
