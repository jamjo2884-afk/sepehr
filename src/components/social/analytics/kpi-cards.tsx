'use client';

import { Eye, FileText, Heart, Percent, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SocialKpiComparison, SocialKpis } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import { formatGrowthPct, formatSigned, TrendBadge } from './shared';

/**
 * v2 per-metric accent colors (design-tokens §1.3). Follower = the social
 * section cyan; the rest spread across the v2 chart palette so each KPI is
 * identifiable at a glance.
 */
const KPI_TINTS: Record<'followers' | 'growth' | 'views' | 'engagement' | 'rate' | 'posts', string> = {
  followers: 'var(--section-social)',
  growth: 'var(--chart-4)',
  views: 'var(--chart-1)',
  engagement: 'var(--section-content)',
  rate: 'var(--chart-5)',
  posts: 'var(--chart-3)',
};

/** Headline KPI cards driven by the analytics service output. */
export function AnalyticsKpiCards({
  kpis,
  comparison,
}: {
  kpis: SocialKpis;
  comparison: SocialKpiComparison[];
}) {
  const byKey = new Map(comparison.map((c) => [c.key, c]));
  const followers = byKey.get('followers');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        icon={Users}
        tint={KPI_TINTS.followers}
        label="مجموع دنبالکنندگان"
        value={formatNumber(kpis.followers)}
        trend={
          followers ? <TrendBadge value={followers.changePct} /> : undefined
        }
        sub={
          followers
            ? `${formatSigned(followers.absoluteChange)} نسبت به دوره قبل`
            : undefined
        }
      />
      <KpiCard
        icon={TrendingUp}
        tint={KPI_TINTS.growth}
        label="رشد دنبالکنندگان"
        value={
          followers
            ? `${formatSigned(followers.absoluteChange)} (${formatGrowthPct(
                followers.changePct,
              )})`
            : '۰'
        }
        sub={followers ? 'مقایسه با دوره قبل' : undefined}
      />
      <KpiCard
        icon={Eye}
        tint={KPI_TINTS.views}
        label="مجموع بازدید"
        value={formatNumber(kpis.views)}
        trend={renderTrend(byKey.get('views'))}
      />
      <KpiCard
        icon={Heart}
        tint={KPI_TINTS.engagement}
        label="مجموع تعامل"
        value={formatNumber(kpis.engagement)}
        trend={renderTrend(byKey.get('engagement'))}
        sub="لایک، کامنت، اشتراک و ذخیره"
      />
      <KpiCard
        icon={Percent}
        tint={KPI_TINTS.rate}
        label="نرخ تعامل"
        value={`${formatNumber(Math.round(kpis.engagementRate * 10) / 10)}٪`}
        trend={renderTrend(byKey.get('engagementRate'))}
      />
      <KpiCard
        icon={FileText}
        tint={KPI_TINTS.posts}
        label="محتوا"
        value={formatNumber(kpis.posts)}
        trend={renderTrend(byKey.get('posts'))}
      />
    </div>
  );
}

function renderTrend(item: SocialKpiComparison | undefined): React.ReactNode {
  if (!item) return undefined;
  return <TrendBadge value={item.changePct} />;
}

function KpiCard({
  icon: Icon,
  tint,
  label,
  value,
  sub,
  trend,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  sub?: string;
  trend?: React.ReactNode;
}) {
  return (
    <div
      className="kpi-card-gradient flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ ['--tint' as string]: tint }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="icon-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-xl font-extrabold tracking-tight text-foreground persian-nums">
        {value}
      </p>
      {trend ? <div>{trend}</div> : null}
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
