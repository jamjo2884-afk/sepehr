'use client';

import { Users, Hash, TrendingUp, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialSummary } from '@/services/social.service';
import { formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';

/** Grid of headline KPI cards shown at the top of the social dashboard. */
export function SocialSummaryCards({
  summary,
}: {
  summary: SocialSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        icon={Users}
        label="کل فالوور"
        value={formatNumber(summary.totalFollowers)}
        sub={`${formatNumber(summary.totalAccounts)} اکانت در ${formatNumber(summary.totalBrands)} برند`}
      />
      <SummaryCard
        icon={TrendingUp}
        label="میانگین رشد"
        value={`${formatNumber(Math.round(summary.avgGrowthPct * 10) / 10)}٪`}
        sub="از اولین تا آخرین اندازه‌گیری"
      />
      <SummaryCard
        icon={Calendar}
        label="بازهٔ زمانی"
        value={`${formatNumber(summary.monthCount)} ماه`}
        sub="دادهٔ ماهانه از شمسی"
      />
      <TopPlatformCard platform={summary.topPlatform} />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function TopPlatformCard({ platform }: { platform: SocialPlatform }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4')}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">بزرگ‌ترین مخاطب</span>
        <Hash className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-2">
        <SocialPlatformIcon
          platform={platform}
          className="h-9 w-9 rounded-lg"
          iconClassName="h-5 w-5"
        />
        <div className="flex flex-col">
          <span className="text-base font-semibold text-foreground">
            {SOCIAL_PLATFORM_LABELS[platform]}
          </span>
          <span className="text-[11px] text-muted-foreground">
            بیشترین مجموع فالوور
          </span>
        </div>
      </div>
    </div>
  );
}
