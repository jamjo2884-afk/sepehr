'use client';

import { useMemo } from 'react';
import type { SocialAccountRow } from '@/services/social.service';
import { platformTotals } from '@/services/social.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import { formatNumber } from '@/utils/persian';

/**
 * Audience share across platforms as a horizontal proportional bar plus a
 * ranked list. Each platform's width is its share of total followers (latest).
 */
export function PlatformBreakdown({
  accounts,
}: {
  accounts: SocialAccountRow[];
}) {
  const ranked = useMemo(() => {
    const totals = platformTotals(accounts);
    const total = totals.reduce((sum, t) => sum + t.total, 0) || 1;
    return totals
      .map((t) => ({
        platform: t.platform,
        followers: t.total,
        share: (t.total / total) * 100,
      }))
      .sort((a, b) => b.followers - a.followers);
  }, [accounts]);

  if (ranked.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {ranked.map((item) => (
          <div
            key={item.platform}
            className="h-full"
            style={{
              width: `${item.share}%`,
              backgroundColor: SOCIAL_PLATFORM_BRAND[item.platform].color,
            }}
            title={`${SOCIAL_PLATFORM_LABELS[item.platform]} — ${formatNumber(
              item.followers,
            )}`}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {ranked.map((item, index) => (
          <li
            key={item.platform}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2"
          >
            <span className="w-5 text-center text-xs font-medium text-muted-foreground">
              {formatNumber(index + 1)}
            </span>
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: SOCIAL_PLATFORM_BRAND[item.platform].color,
              }}
            />
            <span className="flex-1 text-sm font-medium text-foreground">
              {SOCIAL_PLATFORM_LABELS[item.platform]}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatNumber(item.followers)}
            </span>
            <span className="w-14 text-left text-xs font-semibold text-foreground">
              {formatNumber(Math.round(item.share))}٪
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
