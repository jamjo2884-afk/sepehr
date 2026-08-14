'use client';

import { Trophy } from 'lucide-react';
import type { SocialBrandPlatformRow } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { BrandSectionTitle, GrowthPill, ValueOrDash } from './shared';

/**
 * Per-platform performance of one brand. Missing values render as '—';
 * each platform's growth is measured against its own previous period.
 */
export function PlatformPerformance({
  rows,
}: {
  rows: SocialBrandPlatformRow[];
}) {
  if (rows.length === 0) {
    return (
      <section>
        <BrandSectionTitle title="عملکرد شبکه‌ها" />
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
          برای این برند شبکه‌ای ثبت نشده است.
        </div>
      </section>
    );
  }

  return (
    <section>
      <BrandSectionTitle title="عملکرد شبکه‌ها" />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                شبکه
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                دنبال‌کننده
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                رشد
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
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                آخرین به‌روزرسانی
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
                <td className="px-3 py-2.5">
                  <ValueOrDash
                    value={row.followers > 0 ? row.followers : null}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {row.growthPct !== null ? (
                    <GrowthPill value={row.growthPct} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <ValueOrDash value={row.views} />
                </td>
                <td className="px-3 py-2.5">
                  <ValueOrDash value={row.engagement} />
                </td>
                <td className="px-3 py-2.5">
                  {row.engagementRate !== null ? (
                    <span className="tabular-nums text-foreground">
                      {formatNumber(Math.round(row.engagementRate * 10) / 10)}٪
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <ValueOrDash value={row.posts} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {row.latestPeriodLabel
                    ? jalaliMonthName(row.latestPeriodLabel)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Best / worst platform, derived purely from the data: highest follower
 * growth and highest engagement. No composite score is fabricated.
 */
export function BestWorstPlatforms({
  rows,
}: {
  rows: SocialBrandPlatformRow[];
}) {
  const withGrowth = rows
    .filter((r) => r.growth !== null)
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0));
  const withEngagement = rows
    .filter((r) => typeof r.engagement === 'number' && r.engagement > 0)
    .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));

  const hasAnything = withGrowth.length > 0 || withEngagement.length > 0;
  if (!hasAnything) {
    return (
      <section>
        <BrandSectionTitle title="بهترین و ضعیف‌ترین شبکه" />
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
          داده کافی برای مقایسه وجود ندارد.
        </div>
      </section>
    );
  }

  return (
    <section>
      <BrandSectionTitle title="بهترین و ضعیف‌ترین شبکه" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-success" />
            <span className="text-xs font-medium text-muted-foreground">
              بیشترین رشد دنبال‌کنندگان
            </span>
          </div>
          {withGrowth.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {SOCIAL_PLATFORM_LABELS[withGrowth[0].platform]}
              </span>
              <GrowthPill value={withGrowth[0].growthPct} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              داده کافی برای مقایسه رشد وجود ندارد.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              بیشترین تعامل
            </span>
          </div>
          {withEngagement.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {SOCIAL_PLATFORM_LABELS[withEngagement[0].platform]}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(withEngagement[0].engagement ?? 0)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              داده کافی برای مقایسه تعامل وجود ندارد.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
