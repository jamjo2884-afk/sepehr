'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Edit,
  Inbox,
  Megaphone,
  Plus,
  Trash2,
} from 'lucide-react';
import type { FinanceCampaign, FinanceCampaignStatus } from '@/types/finance';
import { FINANCE_CAMPAIGN_STATUS_LABELS } from '@/types/finance';
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

const STATUS_COLORS: Record<FinanceCampaignStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  active: 'bg-success/15 text-success',
  completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<FinanceCampaign[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<FinanceCampaign | null>(null);
  const [form, setForm] = useState({
    brand: '',
    name: '',
    startDate: '',
    endDate: '',
    budget: '',
    status: 'planned' as FinanceCampaignStatus,
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = () => {
    setLoading(true);
    const params = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '';
    Promise.all([
      fetch(`/api/finance/campaigns${params}`).then((r) => r.json()),
      fetch('/api/finance/analytics').then((r) => r.json()),
    ])
      .then(([campaignRes, analyticsRes]) => {
        if (campaignRes.ok) setCampaigns(campaignRes.campaigns ?? []);
        if (analyticsRes.ok) setBrands(analyticsRes.brands ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, [selectedBrand]);

  const openCreate = () => {
    setEditingCampaign(null);
    setForm({
      brand: '',
      name: '',
      startDate: '',
      endDate: '',
      budget: '',
      status: 'planned',
      description: '',
    });
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (campaign: FinanceCampaign) => {
    setEditingCampaign(campaign);
    setForm({
      brand: campaign.brand,
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate ?? '',
      budget: String(campaign.budget),
      status: campaign.status,
      description: campaign.description,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.brand.trim() || !form.name.trim() || !form.startDate || !form.budget) {
      setError('فیلدهای الزامی را پر کنید.');
      return;
    }

    const budget = parseFloat(form.budget);
    if (isNaN(budget) || budget < 0) {
      setError('بودجه باید عدد معتبر باشد.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      brand: form.brand.trim(),
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate || null,
      budget,
      status: form.status,
      description: form.description,
    };

    try {
      if (editingCampaign) {
        const res = await fetch(`/api/finance/campaigns/${editingCampaign.id}`, {
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
        const res = await fetch('/api/finance/campaigns', {
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
      fetchCampaigns();
    } catch {
      setError('خطای شبکه.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این کمپین مطمئن هستید؟')) return;
    try {
      await fetch(`/api/finance/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
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
          <Skeleton key={i} className="h-24 rounded-xl" />
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
          کمپین‌ها
        </h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          کمپین جدید
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

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-foreground">
            هنوز کمپینی ثبت نشده است.
          </p>
          <Button size="sm" onClick={openCreate}>
            ثبت اولین کمپین
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex flex-col rounded-xl border border-border bg-surface/60 p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {campaign.name}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[campaign.status]}`}>
                  {FINANCE_CAMPAIGN_STATUS_LABELS[campaign.status]}
                </span>
              </div>

              <p className="mb-2 text-xs text-muted-foreground">
                {campaign.brand}
              </p>

              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">شروع:</span>{' '}
                  <span className="text-foreground">{campaign.startDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">پایان:</span>{' '}
                  <span className="text-foreground">{campaign.endDate ?? '—'}</span>
                </div>
              </div>

              <div className="mb-3 text-sm font-bold text-foreground">
                بودجه: {formatNumber(campaign.budget)}
              </div>

              {campaign.description && (
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                  {campaign.description}
                </p>
              )}

              <div className="mt-auto flex items-center gap-1 border-t border-border pt-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(campaign)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(campaign.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'ویرایش کمپین' : 'کمپین جدید'}
            </DialogTitle>
            <DialogDescription>
              اطلاعات کمپین را وارد کنید.
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
                <label className="mb-1 block text-xs font-medium text-foreground">وضعیت</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as FinanceCampaignStatus })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(FINANCE_CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">نام کمپین *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="نام کمپین"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">تاریخ شروع *</label>
                <Input
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  placeholder="۱۴۰۵-۰۵-۰۱"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">تاریخ پایان</label>
                <Input
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  placeholder="اختیاری"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">بودجه *</label>
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="بودجه به تومان"
                min="0"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">توضیحات</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="توضیحات کمپین"
              />
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
