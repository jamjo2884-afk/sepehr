'use client';

import { CalendarRange } from 'lucide-react';
import type { SocialKpiComparison } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import { TrendBadge } from './shared';

/** Compares every KPI between the current window and the previous one. */
export function PeriodComparison({
  items,
  rangeLabel,
}: {
  items: SocialKpiComparison[];
  rangeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" />
        مقایسه بازه فعلی ({rangeLabel}) با دوره قبلِ هم‌طول
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                شاخص
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                این دوره
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                دوره قبل
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                تغییر
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.key}
                className="border-b border-border/50 last:border-0 hover:bg-surface/40"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {item.label}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {item.key === 'engagementRate'
                    ? `${formatNumber(Math.round(item.current * 10) / 10)}٪`
                    : formatNumber(item.current)}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {item.key === 'engagementRate'
                    ? `${formatNumber(Math.round(item.previous * 10) / 10)}٪`
                    : formatNumber(item.previous)}
                </td>
                <td className="px-4 py-3">
                  <TrendBadge value={item.changePct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
