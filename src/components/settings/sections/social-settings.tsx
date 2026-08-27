'use client';

import { useMemo } from 'react';
import { SettingsSection } from '@/components/settings/settings-section';
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import { PLATFORM_METRIC_FIELDS } from '@/constants/social-fields';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';

interface SocialSettingsProps {
  /** Platform account counts keyed by platform key. */
  platformCounts?: Partial<Record<SocialPlatform, number>>;
}

const ALL_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'telegram',
  'youtube',
  'twitter',
  'bale',
  'eita',
  'rubika',
  'rubino',
  'soroushplus',
  'aparat',
  'threads',
  'clubhouse',
  'shad',
  'igap',
  'site',
  'gap',
  'virasty',
  'facebook',
];

export function SocialSettings({ platformCounts = {} }: SocialSettingsProps) {
  const sortedPlatforms = useMemo(() => {
    return [...ALL_PLATFORMS].sort((a, b) => {
      const ca = platformCounts[a] ?? 0;
      const cb = platformCounts[b] ?? 0;
      return cb - ca;
    });
  }, [platformCounts]);

  return (
    <SettingsSection
      title="شبکه‌های اجتماعی"
      description="وضعیت پلتفرم‌ها و شاخص‌های قابل ثبت"
    >
      <div className="flex flex-col gap-2">
        {sortedPlatforms.map((platform) => {
          const count = platformCounts[platform] ?? 0;
          const brand = SOCIAL_PLATFORM_BRAND[platform];
          const metrics = PLATFORM_METRIC_FIELDS[platform];

          return (
            <div
              key={platform}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3"
            >
              <SocialPlatformIcon
                platform={platform}
                className="h-8 w-8 rounded-md"
                iconClassName="h-4 w-4"
              />
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {SOCIAL_PLATFORM_LABELS[platform]}
                  </span>
                  {count > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {count} اکانت
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {metrics.length} شاخص قابل ثبت
                </span>
              </div>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: brand.color, opacity: 0.8 }}
              />
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
