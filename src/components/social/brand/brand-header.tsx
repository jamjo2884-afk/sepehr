'use client';

import { ArrowLeft, Calendar, Layers, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import type { SocialBrandOverview } from '@/types/social';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/common/brand-logo';
import { GrowthPill, ValueOrDash } from './shared';

/**
 * Brand header: name, active platform count, total followers, recent
 * growth and the latest recorded period. Missing values render as '—'.
 */
export function BrandHeader({
  brand,
  overview,
}: {
  brand: string;
  overview: SocialBrandOverview;
}) {
  return (
    <header className="flex flex-col gap-4">
      <Button
        variant="ghost"
        className="w-fit gap-2 text-muted-foreground"
        asChild
      >
        <Link href="/social">
          <ArrowLeft className="h-4 w-4" />
          بازگشت به داشبورد شبکه‌های اجتماعی
        </Link>
      </Button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <BrandLogo
            brand={brand}
            className="h-11 w-11 shrink-0 rounded-xl"
            iconClassName="text-lg"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {brand}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          تحلیل عملکرد برند در شبکه‌های اجتماعی
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeaderStat
          icon={Layers}
          label="شبکه‌های فعال"
          value={formatNumber(overview.activeAccounts)}
        />
        <HeaderStat
          icon={Users}
          label="مجموع دنبال‌کنندگان"
          value={
            overview.followers > 0 ? formatNumber(overview.followers) : null
          }
        />
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">رشد اخیر</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {overview.growth !== null ? (
              <GrowthPill value={overview.growthPct} />
            ) : (
              <ValueOrDash value={null} />
            )}
            {overview.growth !== null ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {overview.growth > 0 ? '+' : '−'}
                {formatNumber(Math.abs(overview.growth))}
              </span>
            ) : null}
          </div>
        </div>
        <HeaderStat
          icon={Calendar}
          label="آخرین دوره ثبت‌شده"
          value={
            overview.latestPeriodLabel
              ? jalaliMonthName(overview.latestPeriodLabel)
              : null
          }
        />
      </div>
    </header>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-foreground">{value ?? '—'}</p>
    </div>
  );
}
