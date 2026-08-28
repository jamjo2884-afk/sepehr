'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  UserCheck,
  Briefcase,
  Clock,
  DollarSign,
  Trash2,
  Inbox,
  X,
} from 'lucide-react';
import type {
  TeamMemberWithAllocations,
  EmploymentType,
} from '@/types/team';
import { EMPLOYMENT_TYPE_LABELS, TEAM_MEMBER_STATUS_LABELS } from '@/types/team';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FinanceSubNav } from '@/components/finance/finance-overview';

/* =========================================================================
 * FinanceSubNav shared component
 * ========================================================================= */

// We import from finance-overview which has the sub-nav already.
// But we can define it inline here if needed. For now, let's use the same pattern.

/* =========================================================================
 * Brand Filter
 * ========================================================================= */

function TeamMemberForm({
  brands,
  onClose,
  onSuccess,
}: {
  brands: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>('full_time');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<
    { brand: string; percentage: number }[]
  >([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalAllocated = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const unallocated = Math.max(0, 100 - totalAllocated);
  const overAllocated = totalAllocated > 100;

  const toggleBrand = (brand: string) => {
    setAllocations((prev) => {
      const exists = prev.find((a) => a.brand === brand);
      if (exists) return prev.filter((a) => a.brand !== brand);
      return [...prev, { brand, percentage: 0 }];
    });
  };

  const updatePercentage = (brand: string, value: number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.brand === brand ? { ...a, percentage: value } : a)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('نام الزامی است.');
      return;
    }
    if (!startDate) {
      setError('تاریخ شروع الزامی است.');
      return;
    }
    if (overAllocated) {
      setError('مجموع درصدهای تخصیص نمی‌تواند بیشتر از ۱۰۰٪ باشد.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/finance/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          employmentType,
          monthlyCost: Number(monthlyCost) || 0,
          startDate,
          endDate: endDate || null,
          status,
          notes,
          allocations: allocations
            .filter((a) => a.percentage > 0)
            .map((a) => ({
              brand: a.brand,
              allocationPercentage: a.percentage,
            })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'خطا در ایجاد عضو تیم.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'خطا در ایجاد عضو تیم.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">عضو جدید تیم</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              نام *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام و نام خانوادگی"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              required
            />
          </div>

          {/* Employment Type + Monthly Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                نوع همکاری *
              </label>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType)
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                هزینه ماهانه *
              </label>
              <input
                type="number"
                value={monthlyCost}
                onChange={(e) => setMonthlyCost(e.target.value)}
                placeholder="مبلغ به تومان"
                min="0"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                تاریخ شروع *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                تاریخ پایان
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          {/* Status + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                وضعیت
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'active' | 'inactive')
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                یادداشت
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اختیاری"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          {/* Brand Allocations */}
          <div className="rounded-lg border border-border bg-surface/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                تخصیص به برندها
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  overAllocated
                    ? 'text-destructive'
                    : unallocated > 0
                      ? 'text-warning'
                      : 'text-success',
                )}
              >
                تخصیص‌یافته: {totalAllocated}%
                {unallocated > 0 && !overAllocated
                  ? ` | تخصیص‌نیافته: ${unallocated}%`
                  : ''}
              </span>
            </div>
            {brands.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                هنوز برندی ثبت نشده است.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {brands.map((brand) => {
                  const alloc = allocations.find((a) => a.brand === brand);
                  const isSelected = !!alloc;
                  return (
                    <div key={brand} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBrand(brand)}
                        className="h-4 w-4 rounded"
                      />
                      <span className="min-w-[80px] text-xs text-foreground">
                        {brand}
                      </span>
                      {isSelected && (
                        <input
                          type="number"
                          value={alloc?.percentage ?? 0}
                          onChange={(e) =>
                            updatePercentage(
                              brand,
                              Math.min(100, Math.max(0, Number(e.target.value))),
                            )
                          }
                          min="0"
                          max="100"
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                        />
                      )}
                      {isSelected && (
                        <span className="text-xs text-muted-foreground">٪</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {overAllocated && (
              <p className="mt-2 text-xs text-destructive">
                مجموع تخصیص‌ها از ۱۰۰٪ بیشتر است.
              </p>
            )}
            {!overAllocated && unallocated > 0 && (
              <p className="mt-2 text-xs text-warning">
                {unallocated}٪ از ظرفیت این فرد تخصیص نیافته است.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || overAllocated}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              انصراف
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* =========================================================================
 * Team Page
 * ========================================================================= */

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberWithAllocations[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const membersRes = await fetch('/api/finance/team');
      const membersData = await membersRes.json();
      setMembers(membersData.members ?? []);
      // Extract unique brands from all members
      const allBrands = new Set<string>();
      for (const m of membersData.members ?? []) {
        for (const a of m.allocations ?? []) {
          allBrands.add(a.brand);
        }
      }
      setBrands([...allBrands].sort((a, b) => a.localeCompare(b, 'fa')));
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs
  const totalMembers = members.length;
  const fullTimeCount = members.filter(
    (m) => m.employmentType === 'full_time',
  ).length;
  const partTimeCount = members.filter(
    (m) => m.employmentType === 'part_time',
  ).length;

  const activeCount = members.filter((m) => m.status === 'active').length;
  const monthlyCostTotal = members.reduce(
    (sum, m) => sum + m.monthlyCost,
    0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تیم
          </h1>
          <p className="text-sm text-muted-foreground">
            مدیریت اعضای تیم و تخصیص هزینه نیروی انسانی به برندها
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="ml-1 h-4 w-4" />
          عضو جدید
        </Button>
      </header>

      <FinanceSubNav />

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-4 w-4" />
                تعداد کل نیرو
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatNumber(totalMembers)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                تمام‌وقت
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatNumber(fullTimeCount)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                پاره‌وقت
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatNumber(partTimeCount)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                فعال
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatNumber(activeCount)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                هزینه ماهانه
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatNumber(monthlyCostTotal)}
              </p>
            </div>
          </section>

          {/* Members Table */}
          <section className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                اعضای تیم
              </h2>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  هنوز عضوی برای تیم ثبت نشده است.
                </p>
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="ml-1 h-4 w-4" />
                  ثبت اولین عضو
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        نام
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        نوع همکاری
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        وضعیت
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        هزینه ماهانه
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        تعداد برند
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        تخصیص
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        تاریخ شروع
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        عملیات
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {m.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {EMPLOYMENT_TYPE_LABELS[m.employmentType]}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              m.status === 'active'
                                ? 'bg-success/15 text-success'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {TEAM_MEMBER_STATUS_LABELS[m.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">
                          {formatNumber(m.monthlyCost)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.allocations.length}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.allocations.length > 0
                            ? m.allocations
                                .map(
                                  (a) =>
                                    `${a.brand} ${a.allocationPercentage}%`,
                                )
                                .join(' | ')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.startDate}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `آیا از حذف «${m.name}» اطمینان دارید؟`,
                                  )
                                ) {
                                  await fetch(`/api/finance/team/${m.id}`, {
                                    method: 'DELETE',
                                  });
                                  fetchData();
                                }
                              }}
                              className="rounded p-1 text-muted-foreground hover:text-destructive"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {showForm && (
        <TeamMemberForm
          brands={brands}
          onClose={() => setShowForm(false)}
          onSuccess={fetchData}
        />
      )}
    </motion.div>
  );
}
