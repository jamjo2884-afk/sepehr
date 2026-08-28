'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  PieChart,
  Plus,
  Wallet,
} from 'lucide-react';
import type {
  FinanceOverviewKpis,
  FinanceExpenseBreakdown,
  FinanceBudgetVsActual,
  FinanceBrandCost,
} from '@/types/finance';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FinanceKpiCards,
  BudgetVsActualChart,
  ExpenseBreakdownChart,
  BrandCostChart,
  FinanceSubNav,
  BrandFilter,
} from '@/components/finance/finance-overview';

export default function FinancePage() {
  const [overview, setOverview] = useState<FinanceOverviewKpis | null>(null);
  const [budgetVsActual, setBudgetVsActual] = useState<FinanceBudgetVsActual[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<FinanceExpenseBreakdown[]>([]);
  const [brandCosts, setBrandCosts] = useState<FinanceBrandCost[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '';

    Promise.all([
      fetch(`/api/finance/overview${params}`).then((r) => r.json()),
      fetch(`/api/finance/analytics${params}`).then((r) => r.json()),
    ])
      .then(([overviewRes, analyticsRes]) => {
        if (!active) return;
        if (overviewRes.ok) setOverview(overviewRes.overview);
        if (analyticsRes.ok) {
          setBudgetVsActual(analyticsRes.budgetVsActual ?? []);
          setExpenseBreakdown(analyticsRes.expenseBreakdown ?? []);
          setBrandCosts(analyticsRes.brandCosts ?? []);
          setBrands(analyticsRes.brands ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedBrand, reloadKey]);

  if (loading) {
    return <FinanceSkeleton />;
  }

  if (!overview) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface/60 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-foreground">
          خطا در دریافت داده‌های مالی. لطفاً دوباره تلاش کنید.
        </p>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          تلاش دوباره
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            مدیریت مالی
          </h1>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 text-xs" asChild>
              <Link href="/finance/expenses">
                <Plus className="h-3.5 w-3.5" />
                ثبت هزینه
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
              <Link href="/finance/budgets">
                <Wallet className="h-3.5 w-3.5" />
                ثبت بودجه
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          مدیریت بودجه، هزینه و بازدهی برندهای رسانه‌ای
        </p>
      </header>

      {/* Sub-navigation */}
      <FinanceSubNav />

      {/* Brand filter */}
      {brands.length > 0 && (
        <BrandFilter
          brands={brands}
          selected={selectedBrand}
          onSelect={setSelectedBrand}
        />
      )}

      {/* KPI Cards */}
      <section>
        <FinanceKpiCards kpis={overview} />
      </section>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Budget vs Actual */}
        <section className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              بودجه در مقابل هزینه واقعی
            </h2>
          </div>
          <BudgetVsActualChart data={budgetVsActual} />
        </section>

        {/* Expense Breakdown */}
        <section className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              تفکیک هزینه‌ها
            </h2>
          </div>
          <ExpenseBreakdownChart data={expenseBreakdown} />
        </section>
      </div>

      {/* Brand Cost Comparison */}
      <section className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            مقایسه هزینه برندها
          </h2>
        </div>
        <BrandCostChart data={brandCosts} />
      </section>
    </motion.div>
  );
}

function FinanceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-96 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
