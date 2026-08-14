'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/persian';

/** '۱۲۳۴.۵٪' with sign. */
export function formatGrowthPct(value: number): string {
  const abs = formatNumber(Math.round(Math.abs(value) * 10) / 10);
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${abs}٪`;
}

/** '+۱۲۳' / '-۱۲' / '۰' with sign. */
export function formatSigned(value: number): string {
  const abs = formatNumber(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${abs}`;
}

/** Section title used across the analytics dashboard. */
export function SectionTitle({
  icon: Icon,
  title,
  extra,
}: {
  icon?: LucideIcon;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        {title}
      </h2>
      {extra}
    </div>
  );
}

/** Up / down / flat trend indicator with sign-aware coloring. */
export function TrendBadge({
  value,
  format,
  className,
}: {
  value: number;
  /** Formatting fn; defaults to percentage with sign. */
  format?: (v: number) => string;
  className?: string;
}) {
  const render = format ?? formatGrowthPct;
  if (value === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        <Minus className="h-3.5 w-3.5" />
        بدون تغییر
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold',
        positive ? 'text-success' : 'text-destructive',
        className,
      )}
    >
      {positive ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )}
      {render(value)}
    </span>
  );
}

/** Colored pill for a positive / negative / neutral value. */
export function GrowthPill({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {formatGrowthPct(value)}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        positive
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {formatGrowthPct(value)}
    </span>
  );
}
