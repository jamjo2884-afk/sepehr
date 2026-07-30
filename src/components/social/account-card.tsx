'use client';

import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import type { SocialAccount } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';

/** A single platform's headline metrics shown as a compact card. */
export function SocialAccountCard({ account }: { account: SocialAccount }) {
  const growthPositive = account.followersGrowth >= 0;
  const GrowthIcon = growthPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SocialPlatformIcon
            platform={account.platform}
            className="h-11 w-11 rounded-xl"
            iconClassName="h-6 w-6"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {SOCIAL_PLATFORM_LABELS[account.platform]}
            </span>
            <span className="text-xs text-muted-foreground">
              {account.handle}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            growthPositive
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          <GrowthIcon className="h-3 w-3" />
          {formatNumber(Math.abs(account.followersGrowth))}٪
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="فالوور" value={formatNumber(account.followers)} />
        <Metric label="پست" value={formatNumber(account.posts)} />
        <Metric
          label={account.secondaryMetricLabel}
          value={formatNumber(account.secondaryMetricValue)}
        />
        <Metric
          label="میانگین تعامل"
          value={formatNumber(account.avgEngagement)}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">نرخ تعامل</span>
        <span className="text-xs font-semibold text-foreground">
          {toPersianDigits(account.engagementRate)}٪
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
