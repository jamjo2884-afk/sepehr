'use client';

import { useMemo } from 'react';
import type { SocialAccount } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import { formatNumber } from '@/utils/persian';
import { cn } from '@/lib/utils';

/**
 * Audience share across platforms as a horizontal proportional bar plus a
 * ranked list. Each platform's width is its share of total followers.
 */
export function PlatformBreakdown({
  accounts,
}: {
  accounts: SocialAccount[];
}) {
  const ranked = useMemo(() => {
    const total = accounts.reduce((sum, a) => sum + a.followers, 0) || 1;
    return [...accounts]
      .sort((a, b) => b.followers - a.followers)
      .map((a) => ({
        platform: a.platform,
        followers: a.followers,
        share: (a.followers / total) * 100,
      }));
  }, [accounts]);

  return (
    <div className="flex flex-col gap-4">
      {/* Proportional bar */}
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

      {/* Ranked list */}
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
            <span
              className={cn(
                'w-14 text-left text-xs font-semibold text-foreground',
              )}
            >
              {formatNumber(Math.round(item.share))}٪
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
