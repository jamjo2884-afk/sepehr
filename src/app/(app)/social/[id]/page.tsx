'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Eye,
  Plus,
  Repeat2,
  TrendingUp,
  Users,
  Youtube,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  buildAccountRows,
  decodeAccountKey,
  getSocialAccounts,
  getSocialMetrics,
  socialAccountUrl,
} from '@/services/social.service';
import type { SocialAccountRow } from '@/services/social.service';
import {
  compareMetricValues,
  latestMetric as latestMetricOf,
  sortMetricsByPeriod,
} from '@/services/social-metrics';
import { PLATFORM_METRIC_FIELDS } from '@/constants/social-fields';
import { jalaliMonthName } from '@/services/social-analytics';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { MetricFormDialog } from '@/components/social/metric-form-dialog';
import { MetricHistoryTable } from '@/components/social/metric-history-table';
import { MetricPeriodComparison } from '@/components/social/metric-period-comparison';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [account, setAccount] = useState<SocialAccountRow | null>(null);
  const [accountRecord, setAccountRecord] = useState<SocialAccount | null>(
    null,
  );
  const [latestMetric, setLatestMetric] = useState<SocialMetric | null>(null);
  const [metricsAll, setMetricsAll] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Metric record / edit dialog.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMetric, setEditMetric] = useState<SocialMetric | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    setLoading(true);
    // Read from the normalized tables (social_accounts + social_metrics)
    // through the service layer; never touch Supabase directly.
    const parsed = decodeAccountKey(id);
    if (!parsed) {
      setAccount(null);
      setAccountRecord(null);
      setLatestMetric(null);
      setMetricsAll([]);
      setLoading(false);
      return;
    }
    Promise.all([
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]).then(([accounts, metrics]) => {
      const account = accounts.find(
        (a) =>
          a.brand === parsed.brand &&
          a.platform === parsed.platform &&
          a.username === (parsed.handle ?? ''),
      );
      if (!account) {
        setAccount(null);
        setAccountRecord(null);
        setLatestMetric(null);
        setMetricsAll([]);
        setLoading(false);
        return;
      }
      const rows = buildAccountRows([account], metrics);
      setAccount(rows[0] ?? null);
      setAccountRecord(account);
      setMetricsAll(metrics);
      setLatestMetric(
        latestMetricOf(metrics.filter((m) => m.accountId === account.id)) ??
          null,
      );
      setLoading(false);
    });
  }, [params.id, refreshKey]);

  const accountMetrics = useMemo(
    () =>
      accountRecord
        ? metricsAll.filter((m) => m.accountId === accountRecord.id)
        : [],
    [metricsAll, accountRecord],
  );

  // This month vs last month, per recorded field.
  const periodComparison = useMemo(() => {
    if (!accountRecord) return [];
    return compareMetricValues(
      accountMetrics,
      PLATFORM_METRIC_FIELDS[accountRecord.platform],
    );
  }, [accountRecord, accountMetrics]);

  const periodLabels = useMemo(() => {
    const sorted = sortMetricsByPeriod(accountMetrics);
    const cur = sorted[sorted.length - 1]?.periodLabel;
    const prev = sorted[sorted.length - 2]?.periodLabel;
    return {
      current: cur ? jalaliMonthName(cur) : '',
      previous: prev ? jalaliMonthName(prev) : '',
    };
  }, [accountMetrics]);

  // Prepare chart data (declared before any early returns — Rules of Hooks).
  const chartData = useMemo(() => {
    return (account?.series ?? []).map((point) => ({
      month: point.month,
      value: point.value,
    }));
  }, [account]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">اکانت یافت نشد.</p>
        <Button variant="outline" onClick={() => router.push('/social')}>
          بازگشت به شبکه‌های اجتماعی
        </Button>
      </div>
    );
  }

  const latest = account.latest?.value ?? 0;
  const first = account.first?.value ?? 0;
  const growthPct = account.growthPct;
  const growthPositive = growthPct >= 0;

  // Deep link to the public page of this account on its platform.
  const externalUrl = socialAccountUrl(account.platform, account.handle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-1">
        <Button
          variant="ghost"
          className="w-fit gap-2 text-muted-foreground"
          onClick={() => router.push('/social')}
        >
          <ArrowLeft className="h-4 w-4" />
          بازگشت
        </Button>

        <div className="flex items-center gap-4">
          <SocialPlatformIcon
            platform={account.platform}
            className="h-16 w-16 shrink-0 rounded-2xl"
            iconClassName="h-8 w-8"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {account.brand}
            </h1>
            <p className="text-sm text-muted-foreground">
              {SOCIAL_PLATFORM_LABELS[account.platform]}
              {account.handle ? ` · ${account.handle}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            className="gap-2"
            onClick={() => {
              setEditMetric(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            ثبت آمار جدید
          </Button>
          {externalUrl ? (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                مشاهده در {SOCIAL_PLATFORM_LABELS[account.platform]}
              </Button>
            </a>
          ) : null}
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Users}
          label="فالوور فعلی"
          value={formatNumber(latest)}
        />
        <KPICard
          icon={Calendar}
          label="فالوور اولیه"
          value={formatNumber(first)}
        />
        <KPICard
          icon={TrendingUp}
          label="رشد"
          value={`${growthPositive ? '+' : ''}${formatNumber(Math.round(Math.abs(growthPct) * 10) / 10)}٪`}
          valueClassName={growthPositive ? 'text-success' : 'text-destructive'}
        />
        <KPICard
          icon={Calendar}
          label="مدت زمان"
          value={`${formatNumber(account.series.length)} ماه`}
        />
      </section>

      {/* Platform-specific metric cards */}
      <PlatformMetricCards platform={account.platform} metric={latestMetric} />

      {/* This month vs last month, per metric field */}
      <MetricPeriodComparison
        items={periodComparison}
        currentPeriodLabel={periodLabels.current}
        previousPeriodLabel={periodLabels.previous}
      />

      {/* Follower Trend Chart */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          روند فالوور در طول زمان
        </h2>
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد.
            </p>
          )}
        </div>
      </section>

      {/* Metric history */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          تاریخچه آمار
        </h2>
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <MetricHistoryTable
            metrics={accountMetrics}
            onEdit={(m) => {
              setEditMetric(m);
              setDialogOpen(true);
            }}
            onRecordNew={() => {
              setEditMetric(null);
              setDialogOpen(true);
            }}
          />
        </div>
      </section>

      {/* Record / edit dialog */}
      <MetricFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accountRecord ? [accountRecord] : []}
        metric={editMetric}
        onSaved={() => {
          setDialogOpen(false);
          setEditMetric(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </motion.div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p
        className={`mt-2 text-xl font-bold ${valueClassName ?? 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Platform-specific indicators for one account, read from the latest
 * metric row. Only cards whose platform has a dedicated metric (and whose
 * value is present) are rendered.
 */
interface PlatformMetricSpec {
  key: keyof SocialMetric;
  label: string;
  icon: LucideIcon;
}

const PLATFORM_SPECIFIC_METRICS: Partial<
  Record<SocialPlatform, PlatformMetricSpec[]>
> = {
  instagram: [{ key: 'storyViews', label: 'بازدید استوری', icon: Eye }],
  telegram: [{ key: 'channelMembers', label: 'اعضای کانال', icon: Users }],
  bale: [{ key: 'channelMembers', label: 'اعضای کانال', icon: Users }],
  eita: [{ key: 'channelMembers', label: 'اعضای کانال', icon: Users }],
  rubika: [{ key: 'channelMembers', label: 'اعضای کانال', icon: Users }],
  soroushplus: [{ key: 'channelMembers', label: 'اعضای کانال', icon: Users }],
  twitter: [{ key: 'retweets', label: 'بازتوییت', icon: Repeat2 }],
  youtube: [{ key: 'subscribers', label: 'مشترکین', icon: Youtube }],
};

function PlatformMetricCards({
  platform,
  metric,
}: {
  platform: SocialPlatform;
  metric: SocialMetric | null;
}) {
  const specs = PLATFORM_SPECIFIC_METRICS[platform] ?? [];
  const cards = specs.filter((spec) => {
    const value = metric?.[spec.key];
    return typeof value === 'number' && value > 0;
  });
  if (cards.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((spec) => (
        <KPICard
          key={spec.key}
          icon={spec.icon}
          label={spec.label}
          value={formatNumber(metric?.[spec.key] as number)}
        />
      ))}
    </section>
  );
}
