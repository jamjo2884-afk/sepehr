'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  LineChart,
  PieChart,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  buildSocialOverview,
  getSocialAccounts,
  getSocialMetrics,
  summarizeAccounts,
} from '@/services/social.service';
import type {
  SocialAccountRow,
  SocialOverview,
} from '@/services/social.service';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialSummaryCards } from '@/components/social/summary-cards';
import { EngagementChart } from '@/components/social/engagement-chart';
import { SocialAccountCard } from '@/components/social/account-card';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { PlatformBreakdown } from '@/components/social/platform-breakdown';
import { useSocialBrandEdits } from '@/stores/social-brands.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function SocialPage() {
  const [data, setData] = useState<SocialOverview | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [manageOpen, setManageOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(false);

  const { added, removed, setEdits } = useSocialBrandEdits();

  // Draft edits inside the manage dialog; applied to the store only when
  // the user clicks "ذخیره اطلاعات".
  const [draftAdded, setDraftAdded] = useState<string[]>([]);
  const [draftRemoved, setDraftRemoved] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    // Read from the normalized tables (social_accounts + social_metrics)
    // through the service layer; never touch Supabase directly.
    Promise.all([
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]).then(([accounts, metrics]) => {
      if (!active) return;
      const overview = buildSocialOverview(accounts, metrics);
      setData(overview);
      setSelectedPlatform(overview.summary.topPlatform);
    });
    return () => {
      active = false;
    };
  }, []);

  // Brands visible in the dashboard: base brands minus the removed ones,
  // plus manually added brands.
  const visibleBrands = useMemo(() => {
    if (!data) return [];
    const base = data.brands.filter((b) => !removed.includes(b));
    return [...base, ...added.filter((a) => !base.includes(a))];
  }, [data, added, removed]);

  // All accounts of the visible brands (added brands have no accounts yet).
  const visibleAccounts = useMemo(
    () => (data ? data.accounts.filter((a) => !removed.includes(a.brand)) : []),
    [data, removed],
  );

  // Recompute the summary over the visible accounts so KPIs follow the
  // manual edits; totalBrands counts visible brands (added ones included).
  const summary = useMemo(() => {
    const base = summarizeAccounts(visibleAccounts);
    return { ...base, totalBrands: visibleBrands.length };
  }, [visibleAccounts, visibleBrands]);

  const filteredAccounts = useMemo(() => {
    const accounts =
      selectedBrand === 'all'
        ? visibleAccounts
        : visibleAccounts.filter((a) => a.brand === selectedBrand);
    return [...accounts].sort((a, b) => {
      const av = a.latest?.value ?? 0;
      const bv = b.latest?.value ?? 0;
      return sortAscending ? av - bv : bv - av;
    });
  }, [visibleAccounts, selectedBrand, sortAscending]);

  // Accounts grouped by platform; platforms ordered by total followers.
  const groupedAccounts = useMemo(() => {
    const byPlatform = new Map<SocialPlatform, SocialAccountRow[]>();
    for (const account of filteredAccounts) {
      const list = byPlatform.get(account.platform) ?? [];
      list.push(account);
      byPlatform.set(account.platform, list);
    }
    const totals = new Map<SocialPlatform, number>();
    for (const [platform, list] of byPlatform) {
      totals.set(
        platform,
        list.reduce((sum, a) => sum + (a.latest?.value ?? 0), 0),
      );
    }
    return [...byPlatform.entries()].sort(
      (a, b) => (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0),
    );
  }, [filteredAccounts]);

  // If the selected brand was removed, fall back to "all".
  const activeBrand = visibleBrands.includes(selectedBrand)
    ? selectedBrand
    : 'all';

  // Draft-visible brands inside the dialog: base minus draft-removed, plus
  // draft-added. Declared before the early return (hooks rules).
  const dialogBrands = useMemo(() => {
    if (!data) return [];
    const base = data.brands.filter((b) => !draftRemoved.includes(b));
    return [...base, ...draftAdded.filter((a) => !base.includes(a))];
  }, [data, draftAdded, draftRemoved]);

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleOpenManage = (open: boolean) => {
    setManageOpen(open);
    if (open) {
      // Start a fresh draft from the saved state.
      setDraftAdded(added);
      setDraftRemoved(removed);
      setNewBrandName('');
      setAddError(null);
    }
  };

  const handleAddBrand = () => {
    const name = newBrandName.trim();
    if (!name) {
      setAddError('نام برند را وارد کنید.');
      return;
    }
    if (data.brands.includes(name) || draftAdded.includes(name)) {
      setAddError('این برند قبلاً وجود دارد.');
      return;
    }
    setDraftAdded((prev) => [...prev, name]);
    setDraftRemoved((prev) => prev.filter((r) => r !== name));
    setNewBrandName('');
    setAddError(null);
  };

  const handleRemoveBrand = (name: string) => {
    setDraftRemoved((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setDraftAdded((prev) => prev.filter((a) => a !== name));
  };

  const handleRestoreBrand = (name: string) => {
    setDraftRemoved((prev) => prev.filter((r) => r !== name));
  };

  const handleSave = () => {
    setEdits(draftAdded, draftRemoved);
    setManageOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">آمار شبکه‌های اجتماعی</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          شبکه‌های اجتماعی
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatCount(summary.totalBrands)} برند در{' '}
          {formatCount(data.platforms.length)} پلتفرم —{' '}
          {formatCount(summary.totalAccounts)} اکانت
        </p>
      </header>

      {/* Summary KPI cards */}
      <section>
        <SocialSummaryCards summary={summary} />
      </section>

      {/* Brand selector */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle icon={Users} title="برند" />
          <Dialog open={manageOpen} onOpenChange={handleOpenManage}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                مدیریت برندها
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>مدیریت برندها</DialogTitle>
                <DialogDescription>
                  برندها را به‌صورت دستی اضافه یا حذف کنید. این تغییرات فقط در
                  این مرورگر ذخیره می‌شوند.
                </DialogDescription>
              </DialogHeader>

              {/* Add brand */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={newBrandName}
                    onChange={(e) => {
                      setNewBrandName(e.target.value);
                      setAddError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddBrand();
                    }}
                    placeholder="نام برند جدید…"
                  />
                  <Button onClick={handleAddBrand} className="shrink-0 gap-1.5">
                    <Plus className="h-4 w-4" />
                    افزودن
                  </Button>
                </div>
                {addError ? (
                  <p className="text-xs text-destructive">{addError}</p>
                ) : null}
              </div>

              {/* Visible brands (draft) */}
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {dialogBrands.map((brand) => (
                  <div
                    key={brand}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {brand}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveBrand(brand)}
                      aria-label={`حذف ${brand}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {dialogBrands.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    برندی وجود ندارد.
                  </p>
                ) : null}
              </div>

              {/* Removed brands (draft) */}
              {draftRemoved.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    برندهای حذف‌شده
                  </p>
                  {draftRemoved.map((brand) => (
                    <div
                      key={brand}
                      className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface/20 px-3 py-2"
                    >
                      <span className="truncate text-sm text-muted-foreground line-through">
                        {brand}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => handleRestoreBrand(brand)}
                        aria-label={`بازگردانی ${brand}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Save / cancel */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setManageOpen(false)}>
                  انصراف
                </Button>
                <Button onClick={handleSave}>ذخیره اطلاعات</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          <BrandChip
            label="همه برندها"
            active={activeBrand === 'all'}
            onClick={() => setSelectedBrand('all')}
          />
          {visibleBrands.map((brand) => (
            <BrandChip
              key={brand}
              label={brand}
              active={activeBrand === brand}
              onClick={() => setSelectedBrand(brand)}
            />
          ))}
        </div>
      </section>

      {/* Follower trend chart */}
      <section>
        <SectionTitle icon={LineChart} title="روند فالوور در طول زمان" />
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <EngagementChart
            accounts={filteredAccounts}
            months={data.months}
            selected={selectedPlatform}
            onSelect={setSelectedPlatform}
          />
        </div>
      </section>

      {/* Per-account cards, grouped by platform */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle icon={Share2} title="اکانت‌ها" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setSortAscending((v) => !v)}
          >
            {sortAscending ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
            {sortAscending ? 'کمترین فالوور' : 'بیشترین فالوور'}
          </Button>
        </div>

        {groupedAccounts.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <p className="py-6 text-center text-sm text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groupedAccounts.map(([platform, accounts]) => (
              <div key={platform} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
                  <SocialPlatformIcon
                    platform={platform}
                    className="h-6 w-6 rounded-md"
                    iconClassName="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {SOCIAL_PLATFORM_LABELS[platform]}
                  </span>
                  <span className="mr-auto text-[11px] text-muted-foreground">
                    {formatCount(accounts.length)} اکانت
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {accounts.map((account, i) => (
                    <SocialAccountCard
                      key={`${account.brand}-${account.platform}-${account.handle}-${i}`}
                      account={account}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audience breakdown */}
      <section>
        <SectionTitle icon={PieChart} title="سهم مخاطب میان شبکه‌ها" />
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <PlatformBreakdown accounts={filteredAccounts} />
        </div>
      </section>
    </motion.div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        {title}
      </h2>
    </div>
  );
}

function BrandChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
      )}
    >
      {label}
    </button>
  );
}

function formatCount(n: number): string {
  return n.toLocaleString('fa-IR');
}
