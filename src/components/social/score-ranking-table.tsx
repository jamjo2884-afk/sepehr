'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown, Trophy } from 'lucide-react';
import type {
  SocialBrandScoreRow,
  SocialScoreConfidence,
} from '@/types/social';
import type { SocialAccount } from '@/types/social';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/common/brand-logo';
import { getBrandColor } from '@/constants/brand-colors';
import { SectionTitle } from './analytics/shared';

/**
 * Brand ranking by Social Performance Score. Columns: rank, brand, score,
 * confidence, growth, engagement, followers, trend. Sortable by score /
 * growth / engagement / followers.
 */

type SortKey = 'score' | 'growth' | 'engagement' | 'followers';

const SORT_LABELS: Array<{ key: SortKey; label: string }> = [
  { key: 'score', label: 'امتیاز' },
  { key: 'growth', label: 'رشد' },
  { key: 'engagement', label: 'تعامل' },
  { key: 'followers', label: 'دنبال‌کنندگان' },
];

const CONFIDENCE_LABELS: Record<SocialScoreConfidence, string> = {
  high: 'بالا',
  medium: 'متوسط',
  low: 'کم',
};

export function ScoreRankingTable({
  rows,
  accounts,
}: {
  rows: SocialBrandScoreRow[];
  accounts: SocialAccount[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [descending, setDescending] = useState(true);

  // Link each brand to its brand-performance page (via its first account).
  const hrefByBrand = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) {
      if (!map.has(account.brand)) {
        map.set(
          account.brand,
          `/social/${encodeURIComponent(
            [account.brand, account.platform, account.username].join('|'),
          )}`,
        );
      }
    }
    return map;
  }, [accounts]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      const diff = av - bv;
      return descending ? -diff : diff;
    });
  }, [rows, sortKey, descending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  };

  const ranked = rows.filter((r) => r.score !== null);

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
        دادهٔ کافی برای رتبه‌بندی برندها وجود ندارد.
      </div>
    );
  }

  return (
    <section>
      <SectionTitle
        icon={Trophy}
        title="رتبه‌بندی عملکرد برندها"
        extra={
          <span className="text-[11px] text-muted-foreground">
            امتیاز ۰ تا ۱۰۰ — بر اساس دادهٔ واقعی
          </span>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="w-14 px-3 py-2.5 text-right font-medium text-muted-foreground">
                رتبه
              </th>
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
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                اطمینان
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                روند
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const href = hrefByBrand.get(row.brand);
              return (
                <tr
                  key={row.brand}
                  className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                >
                  <td className="px-3 py-2.5">
                    {row.score !== null ? (
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                          row.rank === 1
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : row.rank <= 3
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {toPersianDigits(row.rank)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 font-medium" style={{ color: getBrandColor(row.brand).primary }}>
                      <BrandLogo
                        brand={row.brand}
                        className="h-6 w-6 rounded-md"
                        iconClassName="text-xs"
                      />
                      {href ? (
                        <Link href={href} className="hover:opacity-80 transition-colors">
                          {row.brand}
                        </Link>
                      ) : row.brand}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.score === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          'text-base font-bold tabular-nums',
                          scoreColor(row.score),
                        )}
                      >
                        {toPersianDigits(row.score)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.growth === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          'tabular-nums',
                          row.growth > 0
                            ? 'text-success'
                            : row.growth < 0
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        )}
                      >
                        {row.growth > 0 ? '+' : row.growth < 0 ? '−' : ''}
                        {toPersianDigits(
                          String(Math.round(Math.abs(row.growth) * 10) / 10),
                        )}
                        ٪
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.engagement === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="tabular-nums text-foreground">
                        {formatNumber(row.engagement)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(row.followers)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        row.confidence === 'high'
                          ? 'text-success'
                          : row.confidence === 'medium'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {CONFIDENCE_LABELS[row.confidence]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.trend === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                          row.trend > 0
                            ? 'text-success'
                            : row.trend < 0
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        )}
                      >
                        {row.trend > 0 ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : row.trend < 0 ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : null}
                        {row.trend > 0 ? '+' : row.trend < 0 ? '−' : ''}
                        {toPersianDigits(Math.abs(row.trend))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        امتیاز بر اساس داده‌های واقعی ثبت‌شده محاسبه می‌شود؛ شاخص‌هایی که برای
        برندی ثبت نشده‌اند در امتیاز آن لحاظ نمی‌شوند.
      </p>
    </section>
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

function scoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}
