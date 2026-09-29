'use client';

import { Eye, FileText, Heart, Percent, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SocialKpiComparison, SocialKpis } from '@/types/social';
import { formatNumber, toPersianDigits } from '@/utils/persian';
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

const NO_COMPARISON_DATA = 'داده‌ی مقایسه موجود نیست';

/** How much of the comparison basis window actually has data. */
export type ComparisonCoverage = {
  /** Months inside the basis window with at least one metric row. */
  covered: number;
  /** Total months in the basis window. */
  total: number;
};

/**
 * Headline KPI cards driven by the analytics service output.
 *
 * Comparison-basis states, checked in this order:
 * 1. no data at all in the basis window → «داده‌ی مقایسه موجود نیست»
 *    and every growth badge is suppressed;
 * 2. partial coverage (`covered < total`, e.g. the basis window reaches
 *    back before the first import) → «مقایسه با داده‌ی ناقص (x از y ماه)»
 *    and growth percentages are hidden — a period-over-period percentage
 *    against a partial sum would be misleading;
 * 3. full coverage → percentage + «نسبت به {basisLabel}» as before.
 */
export function AnalyticsKpiCards({
  kpis,
  comparison,
  /** Human label of the comparison basis month, e.g. «مرداد ۱۴۰۵». */
  basisLabel,
  /** False when the comparison window has no metric rows at all. */
  hasComparisonData = true,
  /** Month coverage of the basis window; undefined = unknown/full. */
  coverage,
}: {
  kpis: SocialKpis;
  comparison: SocialKpiComparison[];
  basisLabel?: string;
  hasComparisonData?: boolean;
  coverage?: ComparisonCoverage;
}) {
  const byKey = new Map(comparison.map((c) => [c.key, c]));
  const followers = byKey.get('followers');

  const partial =
    hasComparisonData &&
    coverage != null &&
    coverage.total > 0 &&
    coverage.covered < coverage.total;

  /** «مقایسه با داده‌ی ناقص (x از y ماه)» — x/y in Persian digits. */
  const partialWarning = partial
    ? `مقایسه با داده‌ی ناقص (${toPersianDigits(String(coverage.covered))} از ${toPersianDigits(String(coverage.total))} ماه)`
    : undefined;

  /** Percentage hidden both when there is no data and when it is partial. */
  const showPct = hasComparisonData && !partial;

  /** «نسبت به مرداد ۱۴۰۵» — falls back to «نسبت به دوره‌ی قبل». */
  const vsBasis = basisLabel ? `نسبت به ${basisLabel}` : 'نسبت به دوره‌ی قبل';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        icon={Users}
        tint={KPI_TINTS.followers}
        label="مجموع دنبالکنندگان"
        value={formatNumber(kpis.followers)}
        trend={
          showPct && followers ? <TrendBadge value={followers.changePct} /> : undefined
        }
        sub={
          partial
            ? partialWarning
            : hasComparisonData && followers
              ? `${formatSigned(followers.absoluteChange)} ${vsBasis}`
              : NO_COMPARISON_DATA
        }
      />
      <KpiCard
        icon={TrendingUp}
        tint={KPI_TINTS.growth}
        label="رشد دنبالکنندگان"
        value={
          showPct && followers
            ? `${formatSigned(followers.absoluteChange)} (${formatGrowthPct(
                followers.changePct,
              )})`
            : showPct
              ? '—'
              : hasComparisonData
                ? formatSigned(followers?.absoluteChange ?? 0)
                : '—'
        }
        sub={partial ? partialWarning : hasComparisonData ? vsBasis : NO_COMPARISON_DATA}
      />
      <KpiCard
        icon={Eye}
        tint={KPI_TINTS.views}
        label="مجموع بازدید"
        value={formatNumber(kpis.views)}
        trend={renderTrend(byKey.get('views'), showPct)}
        sub={partial ? partialWarning : hasComparisonData ? undefined : NO_COMPARISON_DATA}
      />
      <KpiCard
        icon={Heart}
        tint={KPI_TINTS.engagement}
        label="مجموع تعامل"
        value={formatNumber(kpis.engagement)}
        trend={renderTrend(byKey.get('engagement'), showPct)}
        sub={
          partial
            ? partialWarning
            : hasComparisonData
              ? 'لایک، کامنت، اشتراک و ذخیره'
              : NO_COMPARISON_DATA
        }
      />
      <KpiCard
        icon={Percent}
        tint={KPI_TINTS.rate}
        label="نرخ تعامل"
        value={`${formatNumber(Math.round(kpis.engagementRate * 10) / 10)}٪`}
        trend={renderTrend(byKey.get('engagementRate'), showPct)}
        sub={partial ? partialWarning : hasComparisonData ? undefined : NO_COMPARISON_DATA}
      />
      <KpiCard
        icon={FileText}
        tint={KPI_TINTS.posts}
        label="محتوا"
        value={formatNumber(kpis.posts)}
        trend={renderTrend(byKey.get('posts'), showPct)}
        sub={partial ? partialWarning : hasComparisonData ? undefined : NO_COMPARISON_DATA}
      />
    </div>
  );
}

function renderTrend(
  item: SocialKpiComparison | undefined,
  showPct: boolean,
): React.ReactNode {
  if (!item || !showPct) return undefined;
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
