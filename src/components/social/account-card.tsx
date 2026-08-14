'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { SocialAccountRow } from '@/services/social.service';
import { encodeAccountKey } from '@/services/social.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { formatNumber } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/** A single account (brand × platform × handle) shown as a compact card. */
export function SocialAccountCard({ account }: { account: SocialAccountRow }) {
  const growthPositive = account.growthPct >= 0;
  const GrowthIcon = growthPositive ? ArrowUpRight : ArrowDownRight;
  const latest = account.latest?.value ?? 0;
  const first = account.first?.value ?? 0;
  const href = `/social/${encodeAccountKey(account)}`;

  return (
    <Link href={href} className="block">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SocialPlatformIcon
            platform={account.platform}
            className="h-11 w-11 shrink-0 rounded-xl"
            iconClassName="h-6 w-6"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {account.brand}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {SOCIAL_PLATFORM_LABELS[account.platform]}
              {account.handle ? ` · ${account.handle}` : ''}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            growthPositive
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          <GrowthIcon className="h-3 w-3" />
          {formatNumber(Math.round(Math.abs(account.growthPct) * 10) / 10)}٪
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
        <Metric label="فالوور فعلی" value={formatNumber(latest)} />
        <Metric label="فالوور اولیه" value={formatNumber(first)} />
        <Metric label="داده‌ها" value={`${formatNumber(account.series.length)} ماه`} />
      </div>

      {account.latest ? (
        <p className="text-[11px] text-muted-foreground">
          آخرین به‌روزرسانی: {account.latest.month}
        </p>
      ) : null}
    </div>
    </Link>
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
