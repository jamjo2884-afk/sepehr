'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, TrendingUp, Users } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getAccountByKey } from '@/services/social.service';
import type { SocialAccountRow } from '@/services/social.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [account, setAccount] = useState<SocialAccountRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    setLoading(true);
    getAccountByKey(id).then((acc) => {
      setAccount(acc);
      setLoading(false);
    });
  }, [params.id]);

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

      {/* Follower Trend Chart */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          روند فالوور در طول زمان
        </h2>
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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

      {/* Monthly Data Table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          جزئیات ماهانه
        </h2>
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-right font-medium text-muted-foreground">
                    ماه
                  </th>
                  <th className="py-2 text-right font-medium text-muted-foreground">
                    فالوور
                  </th>
                  <th className="py-2 text-right font-medium text-muted-foreground">
                    تغییر
                  </th>
                </tr>
              </thead>
              <tbody>
                {account.series.map((point, index) => {
                  const prev = index > 0 ? account.series[index - 1].value : null;
                  const change = prev !== null ? point.value - prev : null;
                  return (
                    <tr
                      key={point.month}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 text-foreground">{point.month}</td>
                      <td className="py-2 font-medium text-foreground">
                        {formatNumber(point.value)}
                      </td>
                      <td className="py-2">
                        {change !== null ? (
                          <span
                            className={
                              change >= 0 ? 'text-success' : 'text-destructive'
                            }
                          >
                            {change >= 0 ? '+' : ''}
                            {formatNumber(change)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
      <p className={`mt-2 text-xl font-bold ${valueClassName ?? 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
