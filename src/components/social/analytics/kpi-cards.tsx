'use client';

import { Eye, FileText, Heart, Percent, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SocialKpiComparison, SocialKpis } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import { formatGrowthPct, formatSigned, TrendBadge } from './shared';

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
        label="مجموع بازدید"
        value={formatNumber(kpis.views)}
        trend={renderTrend(byKey.get('views'))}
      />
      <KpiCard
        icon={Heart}
        label="مجموع تعامل"
        value={formatNumber(kpis.engagement)}
        trend={renderTrend(byKey.get('engagement'))}
        sub="لایک، کامنت، اشتراک و ذخیره"
      />
      <KpiCard
        icon={Percent}
        label="نرخ تعامل"
        value={`${formatNumber(Math.round(kpis.engagementRate * 10) / 10)}٪`}
        trend={renderTrend(byKey.get('engagementRate'))}
      />
      <KpiCard
        icon={FileText}
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
  label,
  value,
  sub,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {trend ? <div>{trend}</div> : null}
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
