'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, PieChart, Share2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSocialOverview } from '@/services/social.service';
import type { SocialOverview } from '@/services/social.service';
import { SocialSummaryCards } from '@/components/social/summary-cards';
import { EngagementChart } from '@/components/social/engagement-chart';
import { SocialAccountCard } from '@/components/social/account-card';
import { PlatformBreakdown } from '@/components/social/platform-breakdown';

export default function SocialPage() {
  const [data, setData] = useState<SocialOverview | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');

  useEffect(() => {
    let active = true;
    getSocialOverview().then((overview) => {
      if (active) {
        setData(overview);
        // Default to the platform with the largest audience.
        setSelectedPlatform(overview.summary.topPlatform);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const { accounts, trends, summary } = data;

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
          نمای کلی عملکرد اکانت‌ها در ۸ پلتفرم — {accounts.length} اکانت متصل
        </p>
      </header>

      {/* Summary KPI cards */}
      <section>
        <SocialSummaryCards summary={summary} />
      </section>

      {/* Engagement trend chart */}
      <section>
        <SectionTitle
          icon={LineChart}
          title="روند تعامل ۳۰ روز اخیر"
        />
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <EngagementChart
            trends={trends}
            selected={selectedPlatform}
            onSelect={setSelectedPlatform}
          />
        </div>
      </section>

      {/* Per-account cards */}
      <section>
        <SectionTitle icon={Share2} title="اکانت‌های متصل" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accounts.map((account) => (
            <SocialAccountCard key={account.id} account={account} />
          ))}
        </div>
      </section>

      {/* Audience breakdown */}
      <section>
        <SectionTitle
          icon={PieChart}
          title="سهم مخاطب میان شبکه‌ها"
        />
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <PlatformBreakdown accounts={accounts} />
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
