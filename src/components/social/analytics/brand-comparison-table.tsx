'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SocialBrandStat } from '@/types/social';
import { formatNumber } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { BrandLogo } from '@/components/common/brand-logo';
import { formatSigned, GrowthPill } from './shared';

type SortKey =
  | 'followers'
  | 'growth'
  | 'growthPct'
  | 'views'
  | 'engagement'
  | 'engagementRate'
  | 'posts';

const SORT_LABELS: Array<{ key: SortKey; label: string }> = [
  { key: 'followers', label: 'دنبال‌کننده' },
  { key: 'growth', label: 'رشد' },
  { key: 'growthPct', label: 'رشد٪' },
  { key: 'views', label: 'بازدید' },
  { key: 'engagement', label: 'تعامل' },
  { key: 'engagementRate', label: 'نرخ تعامل' },
  { key: 'posts', label: 'محتوا' },
];

/** Sortable brand comparison table; checkboxes select brands for the chart. */
export function BrandComparisonTable({
  stats,
  selectedBrands,
  onToggle,
  note,
}: {
  stats: SocialBrandStat[];
  selectedBrands: string[];
  onToggle: (brand: string) => void;
  note?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('followers');
  const [descending, setDescending] = useState(true);

  const rows = useMemo(() => {
    return [...stats].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = av - bv;
      return descending ? -diff : diff;
    });
  }, [stats, sortKey, descending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  };

  if (stats.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        برای این ترکیب برند، شبکه و بازه زمانی داده‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {note ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {note}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="w-10 px-3 py-2.5" />
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                برند
              </th>
              {SORT_LABELS.map(({ key, label }) => (
                <SortHeader
                  key={key}
                  label={label}
                  active={sortKey === key}
                  descending={descending}
                  onClick={() => toggleSort(key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selectedBrands.includes(row.brand);
              return (
                <tr
                  key={row.brand}
                  className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(row.brand)}
                      aria-label={`انتخاب ${row.brand} برای مقایسه`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <BrandLogo
                        brand={row.brand}
                        className="h-6 w-6 rounded-md"
                        iconClassName="text-xs"
                      />
                      {row.brand}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-foreground">
                    {formatNumber(row.followers)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 tabular-nums',
                      row.growth > 0
                        ? 'text-success'
                        : row.growth < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                    )}
                  >
                    {formatSigned(row.growth)}
                  </td>
                  <td className="px-3 py-2.5">
                    <GrowthPill value={row.growthPct} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(row.views)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(row.engagement)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(Math.round(row.engagementRate * 10) / 10)}٪
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(row.posts)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  descending,
  onClick,
}: {
  label: string;
  active: boolean;
  descending: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2.5 text-right font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-xs transition-colors',
          active
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        {active ? (
          descending ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );
}
