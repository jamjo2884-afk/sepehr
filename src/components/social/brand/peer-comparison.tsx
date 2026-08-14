'use client';

import { Equal, TrendingUp } from 'lucide-react';
import type {
  SocialBrandRanking,
  SocialGrowthDriver,
  SocialPeerComparisonItem,
} from '@/types/social';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { BrandSectionTitle, ValueOrDash } from './shared';

/**
 * Brand vs the average of the other brands. Each average is computed only
 * from the brands that have real data for that indicator; a row without
 * data on either side renders as '—'.
 */
export function PeerComparison({
  items,
}: {
  items: SocialPeerComparisonItem[];
}) {
  return (
    <section>
      <BrandSectionTitle title="مقایسه با میانگین برندها" />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                شاخص
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                این برند
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                میانگین برندهای دیگر
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                وضعیت
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const delta = item.difference;
              return (
                <tr
                  key={item.key}
                  className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {item.label}
                  </td>
                  <td className="px-3 py-2.5">
                    <ValueOrDash value={item.brand} />
                  </td>
                  <td className="px-3 py-2.5">
                    {item.peersAverage !== null ? (
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(item.peersAverage)}
                        <span className="mr-1 text-[10px]">
                          ({toPersianDigits(String(item.peersCount))} برند)
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {delta === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : delta === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Equal className="h-3.5 w-3.5" />
                        هم‌سطح میانگین
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-semibold',
                          delta > 0 ? 'text-success' : 'text-destructive',
                        )}
                      >
                        <TrendingUp
                          className={cn(
                            'h-3.5 w-3.5',
                            delta < 0 && 'rotate-180',
                          )}
                        />
                        {delta > 0 ? 'بالاتر' : 'پایین‌تر'} از میانگین (
                        {formatNumber(Math.abs(delta))})
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
        میانگین هر شاخص فقط از برندهایی محاسبه می‌شود که برای همان شاخص دادهٔ
        واقعی دارند.
      </p>
    </section>
  );
}

/** Relative position (1-based rank) of the brand among all brands. */
export function BrandRankings({
  items,
  brand,
}: {
  items: SocialBrandRanking[];
  brand: string;
}) {
  const withRank = items.filter((i) => i.rank !== null);
  if (withRank.length === 0) {
    return (
      <section>
        <BrandSectionTitle title="جایگاه برند" />
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
          داده کافی برای تعیین جایگاه وجود ندارد.
        </div>
      </section>
    );
  }

  return (
    <section>
      <BrandSectionTitle title="جایگاه برند" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {withRank.map((item) => (
          <div
            key={item.key}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4"
          >
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <p className="text-sm font-semibold text-foreground">
              {brand} از نظر {item.label}، رتبهٔ{' '}
              <span className="text-primary">
                {toPersianDigits(String(item.rank))}
              </span>{' '}
              از {toPersianDigits(String(item.total))} برند را دارد.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Rule-based growth insights (no AI, no fabricated text). */
export function GrowthDrivers({ drivers }: { drivers: SocialGrowthDriver[] }) {
  if (drivers.length === 0) return null;
  return (
    <section>
      <BrandSectionTitle title="عوامل رشد" />
      <div className="flex flex-col gap-2">
        {drivers.map((driver, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border p-4 text-sm',
              driver.type === 'positive' &&
                'border-success/30 bg-success/10 text-success',
              driver.type === 'negative' &&
                'border-destructive/30 bg-destructive/10 text-destructive',
              driver.type === 'info' &&
                'border-border bg-surface/60 text-foreground',
            )}
          >
            {driver.text}
          </div>
        ))}
      </div>
    </section>
  );
}
