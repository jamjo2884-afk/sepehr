'use client';

import { formatNumber, toPersianDigits } from '@/utils/persian';
import { cn } from '@/lib/utils';

/**
 * Shared helpers for the brand performance page. All value formatters are
 * NULL-aware: a missing value renders '—' (never a fabricated zero).
 */

/** '—' for null, formatted number otherwise. */
export function ValueOrDash({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{formatNumber(value)}</span>;
}

/** '—' for null, signed number with Persian digits otherwise. */
export function SignedOrDash({
  value,
  suffix = '',
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = formatNumber(Math.abs(value));
  return (
    <span className="tabular-nums">
      {sign}
      {abs}
      {suffix}
    </span>
  );
}

/** Colored pill for a signed percentage (positive / negative / neutral). */
export function GrowthPill({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (value === 0) {
    return (
      <span
        className={cn(
          'inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        ۰٪
      </span>
    );
  }
  const positive = value > 0;
  const abs = toPersianDigits(String(Math.round(Math.abs(value) * 10) / 10));
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        positive
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {positive ? '+' : '−'}
      {abs}٪
    </span>
  );
}

/** Section title used across the brand page. */
export function BrandSectionTitle({
  title,
  extra,
}: {
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {extra}
    </div>
  );
}

/** Small neutral note shown under a NULL indicator. */
export function NoDataHint({ text }: { text?: string }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      {text ?? 'برای این دوره داده‌ای ثبت نشده است.'}
    </p>
  );
}
