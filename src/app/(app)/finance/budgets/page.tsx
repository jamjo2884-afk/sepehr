'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Edit,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { FinanceBudget } from '@/types/finance';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FinanceSubNav,
  BrandFilter,
} from '@/components/finance/finance-overview';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinanceBudget | null>(null);
  const [form, setForm] = useState({
    brand: '',
    period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    periodLabel: '',
    amount: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = () => {
    setLoading(true);
    const params = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '';
    Promise.all([
      fetch(`/api/finance/budgets${params}`).then((r) => r.json()),
      fetch('/api/finance/analytics').then((r) => r.json()),
    ])
      .then(([budgetRes, analyticsRes]) => {
        if (budgetRes.ok) setBudgets(budgetRes.budgets ?? []);
        if (analyticsRes.ok) setBrands(analyticsRes.brands ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchBudgets();
  }, [selectedBrand]);

  const openCreate = () => {
    setEditingBudget(null);
    setForm({ brand: '', period: 'monthly', periodLabel: '', amount: '', notes: '' });
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (budget: FinanceBudget) => {
    setEditingBudget(budget);
    setForm({
      brand: budget.brand,
      period: budget.period,
      periodLabel: budget.periodLabel,
      amount: String(budget.amount),
      notes: budget.notes,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.brand.trim() || !form.periodLabel.trim() || !form.amount) {
      setError('فیلدهای الزامی را پر کنید.');
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) {
      setError('مبلغ باید عدد معتبر باشد.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      brand: form.brand.trim(),
      period: form.period,
      periodLabel: form.periodLabel.trim(),
      amount,
      notes: form.notes,
    };

    try {
      if (editingBudget) {
        const res = await fetch(`/api/finance/budgets/${editingBudget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? 'خطا در به‌روزرسانی.');
          return;
        }
      } else {
        const res = await fetch('/api/finance/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? 'خطا در ایجاد.');
          return;
        }
      }
      setDialogOpen(false);
      fetchBudgets();
    } catch {
      setError('خطای شبکه.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این بودجه مطمئن هستید؟')) return;
    try {
      await fetch(`/api/finance/budgets/${id}`, { method: 'DELETE' });
      fetchBudgets();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-96 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          بودجه‌ها
        </h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          بودجه جدید
        </Button>
      </header>

      <FinanceSubNav />

      {brands.length > 0 && (
        <BrandFilter
          brands={brands}
          selected={selectedBrand}
          onSelect={setSelectedBrand}
        />
      )}

      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            هنوز بودجه‌ای ثبت نشده است.
          </p>
          <Button size="sm" onClick={openCreate}>
            ثبت اولین بودجه
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {budget.brand}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {budget.periodLabel} — {budget.period === 'monthly' ? 'ماهانه' : budget.period === 'quarterly' ? 'فصلی' : 'سالانه'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-foreground">
                  {formatNumber(budget.amount)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(budget)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(budget.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'ویرایش بودجه' : 'بودجه جدید'}
            </DialogTitle>
            <DialogDescription>
              اطلاعات بودجه را وارد کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                برند *
              </label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="نام برند"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  دوره *
                </label>
                <select
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value as typeof form.period })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="monthly">ماهانه</option>
                  <option value="quarterly">فصلی</option>
                  <option value="yearly">سالانه</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  برچسب دوره *
                </label>
                <Input
                  value={form.periodLabel}
                  onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
                  placeholder="مثلاً ۱۴۰۵-۰۵"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                مبلغ *
              </label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="مبلغ به تومان"
                min="0"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                یادداشت
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="توضیحات اختیاری"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
