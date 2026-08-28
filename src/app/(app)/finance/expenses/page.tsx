'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Edit,
  Inbox,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { FinanceExpense, ExpenseCategory, FinanceCampaign } from '@/types/finance';
import { EXPENSE_CATEGORY_LABELS } from '@/types/finance';
import { SOCIAL_PLATFORM_LABELS, type SocialPlatform } from '@/types/domain';
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

const PLATFORMS: SocialPlatform[] = [
  'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
  'rubika', 'aparat', 'threads', 'facebook',
];

interface AllocationDraft {
  platform: SocialPlatform;
  amount: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<FinanceCampaign[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceExpense | null>(null);
  const [form, setForm] = useState({
    brand: '',
    expenseDate: '',
    amount: '',
    category: 'advertising' as ExpenseCategory,
    campaignId: '',
    description: '',
  });
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchExpenses = () => {
    setLoading(true);
    const params = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '';
    Promise.all([
      fetch(`/api/finance/expenses${params}`).then((r) => r.json()),
      fetch('/api/finance/analytics').then((r) => r.json()),
      fetch('/api/finance/campaigns').then((r) => r.json()),
    ])
      .then(([expenseRes, analyticsRes, campaignRes]) => {
        if (expenseRes.ok) setExpenses(expenseRes.expenses ?? []);
        if (analyticsRes.ok) setBrands(analyticsRes.brands ?? []);
        if (campaignRes.ok) setCampaigns(campaignRes.campaigns ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedBrand]);

  const pagedExpenses = expenses.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(expenses.length / pageSize);

  const openCreate = () => {
    setEditingExpense(null);
    const today = new Date();
    const jy = today.getFullYear();
    const jm = String(today.getMonth() + 1).padStart(2, '0');
    const jd = String(today.getDate()).padStart(2, '0');
    setForm({
      brand: '',
      expenseDate: `${jy}-${jm}-${jd}`,
      amount: '',
      category: 'advertising',
      campaignId: '',
      description: '',
    });
    setAllocations([]);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (expense: FinanceExpense) => {
    setEditingExpense(expense);
    setForm({
      brand: expense.brand,
      expenseDate: expense.expenseDate,
      amount: String(expense.amount),
      category: expense.category,
      campaignId: expense.campaignId ?? '',
      description: expense.description,
    });
    setAllocations([]);
    setError(null);
    setDialogOpen(true);
  };

  const totalAllocation = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0,
  );
  const expenseAmount = parseFloat(form.amount) || 0;
  const allocationValid = totalAllocation <= expenseAmount;

  const addAllocation = () => {
    setAllocations([...allocations, { platform: 'instagram', amount: '' }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (
    index: number,
    field: 'platform' | 'amount',
    value: string,
  ) => {
    const updated = [...allocations];
    if (field === 'platform') {
      updated[index] = { ...updated[index], platform: value as SocialPlatform };
    } else {
      updated[index] = { ...updated[index], amount: value };
    }
    setAllocations(updated);
  };

  const handleSave = async () => {
    if (!form.brand.trim() || !form.expenseDate || !form.amount) {
      setError('فیلدهای الزامی را پر کنید.');
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('مبلغ باید عدد مثبت باشد.');
      return;
    }

    if (!allocationValid) {
      setError('مجموع تخصیص‌ها نمی‌تواند از مبلغ هزینه بیشتر باشد.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      brand: form.brand.trim(),
      expenseDate: form.expenseDate,
      amount,
      category: form.category,
      campaignId: form.campaignId || null,
      description: form.description,
      allocations: allocations
        .filter((a) => parseFloat(a.amount) > 0)
        .map((a) => ({
          platform: a.platform,
          amount: parseFloat(a.amount),
        })),
    };

    try {
      if (editingExpense) {
        const res = await fetch(`/api/finance/expenses/${editingExpense.id}`, {
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
        const res = await fetch('/api/finance/expenses', {
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
      fetchExpenses();
    } catch {
      setError('خطای شبکه.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این هزینه مطمئن هستید؟')) return;
    try {
      await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE' });
      fetchExpenses();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-96 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
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
          هزینه‌ها
        </h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          ثبت هزینه
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

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            هنوز هزینه‌ای ثبت نشده است.
          </p>
          <Button size="sm" onClick={openCreate}>
            ثبت اولین هزینه
          </Button>
        </div>
      ) : (
        <>
          {/* Expense table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60">
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">تاریخ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">برند</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">دسته</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">مبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">توضیحات</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {pagedExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{expense.expenseDate}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{expense.brand}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">
                      {formatNumber(expense.amount)}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {expense.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                قبلی
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} از {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                بعدی
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}
            </DialogTitle>
            <DialogDescription>
              اطلاعات هزینه و تخصیص پلتفرم‌ها را وارد کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">برند *</label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="نام برند"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">تاریخ *</label>
                <Input
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  placeholder="۱۴۰۵-۰۵-۲۸"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">دسته *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">مبلغ *</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="مبلغ به تومان"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">کمپین (اختیاری)</label>
                <select
                  value={form.campaignId}
                  onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">بدون کمپین</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">شرح</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="توضیحات هزینه"
              />
            </div>

            {/* Allocations */}
            <div className="rounded-lg border border-border bg-surface/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">تخصیص پلتفرم</span>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addAllocation}>
                  <Plus className="h-3 w-3" />
                  افزودن پلتفرم
                </Button>
              </div>

              {allocations.length > 0 && (
                <div className="space-y-2">
                  {allocations.map((alloc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={alloc.platform}
                        onChange={(e) => updateAllocation(i, 'platform', e.target.value)}
                        className="flex h-8 w-32 rounded border border-input bg-background px-2 text-xs"
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>{SOCIAL_PLATFORM_LABELS[p]}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        value={alloc.amount}
                        onChange={(e) => updateAllocation(i, 'amount', e.target.value)}
                        placeholder="مبلغ"
                        className="h-8 flex-1 text-xs"
                        min="0"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeAllocation(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">مجموع تخصیص:</span>
                    <span className={`text-xs font-medium ${allocationValid ? 'text-foreground' : 'text-destructive'}`}>
                      {formatNumber(totalAllocation)} از {formatNumber(expenseAmount)}
                    </span>
                  </div>
                </div>
              )}

              {allocations.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  بدون تخصیص — هزینه کل به عنوان «نام分配» در نظر گرفته می‌شود.
                </p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
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
