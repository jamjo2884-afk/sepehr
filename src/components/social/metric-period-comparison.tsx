'use client';

import { ArrowLeftRight, Calendar } from 'lucide-react';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import type { SocialMetricValueComparison } from '@/types/social';
import { SectionTitle, TrendBadge, formatSigned } from './analytics/shared';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { cn } from '@/lib/utils';

function isPercentField(key: SocialMetricFieldKey): boolean {
  return SOCIAL_METRIC_FIELDS[key].kind === 'percent';
}

/** Format one side of the comparison (the stored value). */
function formatValue(key: SocialMetricFieldKey, value: number | null): string {
  if (value === null) return '—';
  if (isPercentField(key)) {
    const rounded = Math.round(value * 100) / 100;
    return `${toPersianDigits(String(rounded))}٪`;
  }
  return formatNumber(value);
}

/**
 * Account-detail section comparing every recorded metric field between the
 * latest period and the one before it. Only fields with a value on at least
 * one side are shown; missing sides render as '—' instead of 0.
 */
export function MetricPeriodComparison({
  items,
  currentPeriodLabel,
  previousPeriodLabel,
}: {
  items: SocialMetricValueComparison[];
  currentPeriodLabel: string;
  previousPeriodLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionTitle
        icon={ArrowLeftRight}
        title="مقایسه این ماه با ماه قبل"
        extra={
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {currentPeriodLabel} در برابر {previousPeriodLabel}
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const hasBoth = item.current !== null && item.previous !== null;
          const change = item.absoluteChange ?? 0;
          const showBadge = hasBoth && item.changePct !== null;
          return (
            <div
              key={item.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4"
            >
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>

              <div className="flex flex-col gap-1">
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatValue(item.key, item.current)}
                </p>
                {showBadge ? (
                  <TrendBadge
                    value={change}
                    format={(v) =>
                      isPercentField(item.key)
                        ? `${formatSigned(Math.round(v * 100) / 100)}٪`
                        : `${formatSigned(v)} (${formatSigned(Math.round((item.changePct ?? 0) * 10) / 10)}٪)`
                    }
                  />
                ) : null}
              </div>

              <p
                className={cn(
                  'mt-auto border-t border-border/50 pt-2 text-[11px] text-muted-foreground',
                )}
              >
                ماه قبل: {formatValue(item.key, item.previous)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
