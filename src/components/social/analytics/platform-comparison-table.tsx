'use client';

import type { SocialPlatformStat } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { formatNumber } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { formatSigned, GrowthPill } from './shared';

/** Per-platform performance of one brand (or the whole portfolio). */
export function PlatformComparisonTable({
  stats,
  brand,
}: {
  stats: SocialPlatformStat[];
  /** Non-null only when exactly one brand is selected. */
  brand: string | null;
}) {
  if (!brand) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای مشاهده مقایسه عملکرد شبکه‌ها، یک برند را از فیلتر برند انتخاب کنید.
      </p>
    );
  }

  if (stats.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای این ترکیب برند، شبکه و بازه زمانی داده‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/40">
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              شبکه
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              دنبال‌کننده
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              رشد
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              رشد٪
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              بازدید
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              تعامل
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              نرخ تعامل
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
              محتوا
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr
              key={row.platform}
              className="border-b border-border/50 last:border-0 hover:bg-surface/40"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <SocialPlatformIcon
                    platform={row.platform}
                    className="h-6 w-6 rounded-md"
                    iconClassName="h-3.5 w-3.5"
                  />
                  <span className="font-medium text-foreground">
                    {SOCIAL_PLATFORM_LABELS[row.platform]}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-foreground">
                {formatNumber(row.followers)}
              </td>
              <td
                className={cn(
                  'px-3 py-2.5 tabular-nums',
                  row.growth > 0
                    ? 'text-success'
                    : row.growth < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                )}
              >
                {formatSigned(row.growth)}
              </td>
              <td className="px-3 py-2.5">
                <GrowthPill value={row.growthPct} />
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {formatNumber(row.views)}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {formatNumber(row.engagement)}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {formatNumber(Math.round(row.engagementRate * 10) / 10)}٪
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {formatNumber(row.posts)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
