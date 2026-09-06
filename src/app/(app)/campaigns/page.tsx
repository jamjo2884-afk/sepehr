'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Megaphone, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  FINANCE_CAMPAIGN_STATUS_LABELS,
  type FinanceCampaign,
  type FinanceCampaignStatus,
} from '@/types/finance';
import { formatJalaliDate } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUS_BADGE: Record<FinanceCampaignStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  active: 'bg-success/10 text-success',
  completed: 'bg-cyan-500/10 text-cyan-500',
  cancelled: 'bg-destructive/10 text-destructive',
};

interface BrandOption {
  id: string;
  name: string;
}

interface CampaignFormState {
  name: string;
  brandId: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: FinanceCampaignStatus;
  description: string;
}

const EMPTY_FORM: CampaignFormState = {
  name: '',
  brandId: '',
  startDate: '',
  endDate: '',
  budget: '',
  status: 'planned',
  description: '',
};

type LoadState = 'loading' | 'ready' | 'error';

export default function CampaignsPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [campaigns, setCampaigns] = useState<FinanceCampaign[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [campaignsRes, brandsRes] = await Promise.all([
        fetch('/api/finance/campaigns', { cache: 'no-store' }),
        fetch('/api/brands', { cache: 'no-store' }),
      ]);
      if (!campaignsRes.ok || !brandsRes.ok) throw new Error('failed');
      const campaignsBody = (await campaignsRes.json()) as {
        ok: boolean;
        campaigns: FinanceCampaign[];
      };
      const brandsBody = (await brandsRes.json()) as {
        ok: boolean;
        brands: BrandOption[];
      };
      setCampaigns(campaignsBody.campaigns ?? []);
      setBrands(brandsBody.brands ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [campaigns],
  );

  const brandName = useCallback(
    (id: string | null | undefined) =>
      brands.find((b) => b.id === id)?.name ?? id ?? '—',
    [brands],
  );

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('نام کمپین الزامی است.');
      return;
    }
    if (!form.brandId) {
      toast.error('برند کمپین را انتخاب کنید.');
      return;
    }
    if (!form.startDate) {
      toast.error('تاریخ شروع الزامی است.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brandId: form.brandId,
        startDate: form.startDate,
        endDate: form.endDate || null,
        budget: Number(form.budget) || 0,
        status: form.status,
        description: form.description,
      };
      const res = await fetch('/api/finance/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? 'ایجاد کمپین ناموفق بود.');
        return;
      }
      toast.success('کمپین ایجاد شد.');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      toast.error('ایجاد کمپین ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            کمپین‌ها
          </h1>
          <p className="text-sm text-muted-foreground">
            کمپین‌های رسانه‌ای و بودجه آن‌ها — متصل به برندها و محتوا
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            کمپین جدید
          </Button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : state === 'error' ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            دریافت کمپین‌ها ممکن نشد.
          </p>
          <Button onClick={() => void load()}>تلاش دوباره</Button>
        </section>
      ) : sorted.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            هنوز کمپینی ثبت نشده است.
          </p>
          <Button onClick={() => setDialogOpen(true)}>ایجاد اولین کمپین</Button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((campaign) => (
            <div
              key={campaign.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {campaign.name}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[campaign.status]}`}
                >
                  {FINANCE_CAMPAIGN_STATUS_LABELS[campaign.status]}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span>برند: {brandName(campaign.brandId)}</span>
                <span>
                  بازه: {formatJalaliDate(new Date(campaign.startDate))}
                  {campaign.endDate
                    ? ` تا ${formatJalaliDate(new Date(campaign.endDate))}`
                    : ' — ادامه‌دار'}
                </span>
                <span>بودجه: {campaign.budget.toLocaleString('fa-IR')}</span>
              </div>
              {campaign.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {campaign.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>کمپین جدید</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-name">نام کمپین</Label>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثلاً: کمپین تابستانه ازما"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>برند</Label>
              <Select
                value={form.brandId}
                onValueChange={(v) => setForm({ ...form, brandId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب برند" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>تاریخ شروع</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>تاریخ پایان</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>بودجه</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>وضعیت</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as FinanceCampaignStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FINANCE_CAMPAIGN_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>توضیحات</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="هدف، مخاطب، نکات..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                انصراف
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'در حال ثبت...' : 'ثبت'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}