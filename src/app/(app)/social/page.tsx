'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, PieChart, Share2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSocialOverview } from '@/services/social.service';
import type { SocialOverview } from '@/services/social.service';
import { SocialSummaryCards } from '@/components/social/summary-cards';
import { EngagementChart } from '@/components/social/engagement-chart';
import { SocialAccountCard } from '@/components/social/account-card';
import { PlatformBreakdown } from '@/components/social/platform-breakdown';
import { cn } from '@/lib/utils';

export default function SocialPage() {
  const [data, setData] = useState<SocialOverview | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  useEffect(() => {
    let active = true;
    getSocialOverview().then((overview) => {
      if (!active) return;
      setData(overview);
      setSelectedPlatform(overview.summary.topPlatform);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    if (!data) return [];
    const accounts =
      selectedBrand === 'all'
        ? data.accounts
        : data.accounts.filter((a) => a.brand === selectedBrand);
    return [...accounts].sort((a, b) => {
      const av = a.latest?.value ?? 0;
      const bv = b.latest?.value ?? 0;
      return bv - av;
    });
  }, [data, selectedBrand]);

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const { summary } = data;

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
          {formatCount(summary.totalBrands)} برند در {formatCount(data.platforms.length)}{' '}
          پلتفرم — {formatCount(summary.totalAccounts)} اکانت
        </p>
      </header>

      {/* Summary KPI cards */}
      <section>
        <SocialSummaryCards summary={summary} />
      </section>

      {/* Brand selector */}
      <section>
        <SectionTitle icon={Users} title="برند" />
        <div className="flex flex-wrap gap-2">
          <BrandChip
            label="همه برندها"
            active={selectedBrand === 'all'}
            onClick={() => setSelectedBrand('all')}
          />
          {data.brands.map((brand) => (
            <BrandChip
              key={brand}
              label={brand}
              active={selectedBrand === brand}
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

      {/* Per-account cards */}
      <section>
        <SectionTitle icon={Share2} title="اکانت‌ها" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredAccounts.map((account, i) => (
            <SocialAccountCard
              key={`${account.brand}-${account.platform}-${account.handle}-${i}`}
              account={account}
            />
          ))}
        </div>
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
    <div className="mb-3 flex items-center gap-2">
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
