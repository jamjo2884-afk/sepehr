'use client';

import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Receipt,
  Building2,
  PieChart,
} from 'lucide-react';
import type { FinanceOverviewKpis, FinanceExpenseBreakdown, FinanceBudgetVsActual } from '@/types/finance';
import { formatNumber } from '@/utils/persian';

/* =========================================================================
 * KPI Cards
 * ========================================================================= */

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}

function KpiCard({ icon, label, value, subtext, color = 'text-primary' }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold text-foreground">{value}</p>
        {subtext && (
          <p className="text-[11px] text-muted-foreground">{subtext}</p>
        )}
      </div>
    </motion.div>
  );
}

export function FinanceKpiCards({ kpis }: { kpis: FinanceOverviewKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        icon={<Wallet className="h-5 w-5" />}
        label="بودجه کل"
        value={formatNumber(kpis.totalBudget)}
      />
      <KpiCard
        icon={<Receipt className="h-5 w-5" />}
        label="هزینه‌شده"
        value={formatNumber(kpis.totalSpent)}
        color="text-warning"
      />
      <KpiCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="مانده بودجه"
        value={formatNumber(kpis.remainingBudget)}
        color="text-success"
      />
      <KpiCard
        icon={<PieChart className="h-5 w-5" />}
        label="درصد مصرف"
        value={`${formatNumber(Math.round(kpis.budgetUsagePercent))}%`}
        subtext={`${formatNumber(kpis.expenseCount)} هزینه`}
      />
      <KpiCard
        icon={<Building2 className="h-5 w-5" />}
        label="تعداد برندها"
        value={formatNumber(kpis.brandCount)}
      />
      <KpiCard
        icon={<TrendingDown className="h-5 w-5" />}
        label="باقی‌مانده"
        value={`${formatNumber(Math.round(100 - kpis.budgetUsagePercent))}%`}
        subtext="از بودجه کل"
        color="text-cyan"
      />
    </div>
  );
}

/* =========================================================================
 * Budget vs Actual Chart (bar chart)
 * ========================================================================= */

export function BudgetVsActualChart({
  data,
}: {
  data: FinanceBudgetVsActual[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Math.max(d.budget, d.actual)), 1);

  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => (
        <div key={item.periodLabel} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
            {item.periodLabel}
          </span>
          <div className="flex-1 space-y-1">
            {/* Budget bar */}
            <div className="flex items-center gap-2">
              <div
                className="h-4 rounded bg-primary/30"
                style={{ width: `${(item.budget / maxValue) * 100}%`, minWidth: item.budget > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(item.budget)}
              </span>
            </div>
            {/* Actual bar */}
            <div className="flex items-center gap-2">
              <div
                className="h-4 rounded bg-warning/60"
                style={{ width: `${(item.actual / maxValue) * 100}%`, minWidth: item.actual > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(item.actual)}
              </span>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-primary/30" /> بودجه
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-warning/60" /> واقعی
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
 * Expense Breakdown (horizontal bars)
 * ========================================================================= */

export function ExpenseBreakdownChart({
  data,
}: {
  data: FinanceExpenseBreakdown[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        هزینه‌ای ثبت نشده است.
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-2">
      {data.map((item) => (
        <div key={item.category} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-right text-xs text-foreground">
            {item.label}
          </span>
          <div className="flex-1">
            <div
              className="h-5 rounded bg-primary/40"
              style={{
                width: `${(item.total / maxTotal) * 100}%`,
                minWidth: item.total > 0 ? 4 : 0,
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-left text-[11px] text-muted-foreground">
            {formatNumber(item.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
 * Brand Cost Bar
 * ========================================================================= */

export function BrandCostChart({
  data,
}: {
  data: Array<{ brand: string; totalSpend: number; expenseCount: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        داده‌ای وجود ندارد.
      </div>
    );
  }

  const maxSpend = Math.max(...data.map((d) => d.totalSpend), 1);

  return (
    <div className="flex flex-col gap-2">
      {data.map((item) => (
        <div key={item.brand} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-right text-xs font-medium text-foreground">
            {item.brand}
          </span>
          <div className="flex-1">
            <div
              className="h-5 rounded bg-accent/50"
              style={{
                width: `${(item.totalSpend / maxSpend) * 100}%`,
                minWidth: item.totalSpend > 0 ? 4 : 0,
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-left text-[11px] text-muted-foreground">
            {formatNumber(item.totalSpend)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
 * Finance Sub-Navigation
 * ========================================================================= */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const FINANCE_TABS = [
  { label: 'نمای کلی', href: '/finance' },
  { label: 'بودجه‌ها', href: '/finance/budgets' },
  { label: 'هزینه‌ها', href: '/finance/expenses' },
  { label: 'کمپین‌ها', href: '/finance/campaigns' },
  { label: 'تیم', href: '/finance/team' },
  { label: 'بازدهی', href: '/finance/analytics' },
];

export function FinanceSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
      {FINANCE_TABS.map((tab) => {
        const active =
          tab.href === '/finance'
            ? pathname === '/finance'
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary bg-primary/5 text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* =========================================================================
 * Brand Filter
 * ========================================================================= */

export function BrandFilter({
  brands,
  selected,
  onSelect,
}: {
  brands: string[];
  selected: string | null;
  onSelect: (brand: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          selected === null
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:bg-secondary',
        )}
      >
        همه برندها
      </button>
      {brands.map((brand) => (
        <button
          key={brand}
          type="button"
          onClick={() => onSelect(brand)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            selected === brand
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          {brand}
        </button>
      ))}
    </div>
  );
}
