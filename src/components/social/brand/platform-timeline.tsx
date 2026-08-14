'use client';

import { Clock } from 'lucide-react';
import type { SocialBrandPlatformTimelineRow } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { jalaliMonthName } from '@/services/social-analytics';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';
import { BrandSectionTitle } from './shared';

const FRESHNESS_LABEL = {
  'up-to-date': 'به‌روز',
  stale: 'قدیمی',
  'no-data': 'بدون داده',
} as const;

const FRESHNESS_CLASS = {
  'up-to-date': 'bg-success/10 text-success',
  stale: 'bg-warning/10 text-warning',
  'no-data': 'bg-muted text-muted-foreground',
} as const;

/**
 * Latest status of each platform of the brand. A platform is 'قدیمی' when
 * its newest metric is older than SOCIAL_DATA_STALE_DAYS (see
 * social-analytics.ts); 'بدون داده' when it has no metric at all.
 */
export function PlatformTimeline({
  rows,
}: {
  rows: SocialBrandPlatformTimelineRow[];
}) {
  return (
    <section>
      <BrandSectionTitle
        title="آخرین وضعیت شبکه‌ها"
        extra={
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            تشخیص به‌روز بودن بر اساس آخرین متریک ثبت‌شده
          </span>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                شبکه
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                آخرین آمار
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                وضعیت
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.platform}
                className="border-b border-border/50 last:border-0 hover:bg-surface/40"
              >
                <td className="px-4 py-2.5">
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
                <td className="px-3 py-2.5 text-muted-foreground">
                  {row.latestPeriodLabel
                    ? jalaliMonthName(row.latestPeriodLabel)
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      FRESHNESS_CLASS[row.freshness],
                    )}
                  >
                    {FRESHNESS_LABEL[row.freshness]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
