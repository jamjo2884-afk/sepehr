'use client';

import { BarChart3, Eye, FileText, Heart, Percent, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SocialBrandOverview } from '@/types/social';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { GrowthPill, NoDataHint } from './shared';

/**
 * Brand KPI overview. Views / engagement / engagement rate / posts only
 * render a value when real data exists; otherwise a '—' with a short note
 * (never a fabricated zero).
 */
export function BrandKpis({ overview }: { overview: SocialBrandOverview }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        icon={Users}
        label="دنبال‌کنندگان"
        value={overview.followers > 0 ? formatNumber(overview.followers) : '—'}
      />
      <KpiCard
        icon={TrendingUpIcon}
        label="رشد دنبال‌کنندگان"
        custom={
          overview.growth === null ? (
            <>
              <span className="text-xl font-bold text-foreground">—</span>
              <NoDataHint />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <GrowthPill value={overview.growthPct} />
              <span className="text-sm tabular-nums text-muted-foreground">
                {overview.growth > 0 ? '+' : '−'}
                {formatNumber(Math.abs(overview.growth))}
              </span>
            </div>
          )
        }
      />
      <KpiCard
        icon={Eye}
        label="بازدید"
        value={null}
        custom={
          overview.views === null ? (
            <>
              <span className="text-xl font-bold text-foreground">—</span>
              <NoDataHint />
            </>
          ) : (
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatNumber(overview.views)}
            </span>
          )
        }
      />
      <KpiCard
        icon={Heart}
        label="تعامل"
        value={null}
        custom={
          overview.engagement === null ? (
            <>
              <span className="text-xl font-bold text-foreground">—</span>
              <NoDataHint />
            </>
          ) : (
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatNumber(overview.engagement)}
            </span>
          )
        }
      />
      <KpiCard
        icon={Percent}
        label="نرخ تعامل"
        value={null}
        custom={
          overview.engagementRate === null ? (
            <>
              <span className="text-xl font-bold text-foreground">—</span>
              <NoDataHint />
            </>
          ) : (
            <span className="text-xl font-bold tabular-nums text-foreground">
              {toPersianDigits(
                String(Math.round(overview.engagementRate * 10) / 10),
              )}
              ٪
            </span>
          )
        }
      />
      <KpiCard
        icon={FileText}
        label="محتوا (پست)"
        value={null}
        custom={
          overview.posts === null ? (
            <>
              <span className="text-xl font-bold text-foreground">—</span>
              <NoDataHint />
            </>
          ) : (
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatNumber(overview.posts)}
            </span>
          )
        }
      />
    </div>
  );
}

const TrendingUpIcon = BarChart3 as LucideIcon;

function KpiCard({
  icon: Icon,
  label,
  value,
  custom,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  custom?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {custom ?? (
        <span className="text-xl font-bold tabular-nums text-foreground">
          {value ?? '—'}
        </span>
      )}
    </div>
  );
}
