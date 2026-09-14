'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Award,
  CheckSquare,
  ClipboardList,
  FileText,
  ExternalLink,
  Loader2,
  Megaphone,
  Settings,
  Wallet,
} from 'lucide-react';

import type { SocialAccount, SocialMetric } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { BrandLogo } from '@/components/common/brand-logo';
import { getBrandColor, isBrandIgnored } from '@/constants/brand-colors';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { BrandManagement } from '@/components/brands/brand-management';
import { Progress } from '@/components/ui/progress';

interface BrandCard {
  name: string;
  accounts: SocialAccount[];
  totalFollowers: number;
  latestPeriod: string | null;
  platformCount: number;
  accountCount: number;
}

/** Fill state of the managerial status profile (null = none saved). */
interface StatusProfileCompleteness {
  filledCount: number;
  totalCount: number;
  percent: number;
}

interface BrandSummary {
  contentCount: number;
  taskCount: number;
  campaignCount: number;
  totalExpenses: number;
  statusProfile?: StatusProfileCompleteness | null;
}

export default function BrandsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [metrics, setMetrics] = useState<SocialMetric[]>([]);
  const [summary, setSummary] = useState<Record<string, BrandSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showManagement, setShowManagement] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/social/analytics').then((r) => r.json()),
      fetch('/api/brands/summary').then((r) => r.json()),
    ])
      .then(([analyticsData, summaryData]) => {
        if (!active) return;
        if (analyticsData.ok) {
          setAccounts(analyticsData.accounts);
          setMetrics(analyticsData.metrics);
        }
        if (summaryData.ok) {
          setSummary(summaryData.summary ?? {});
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const brands = useMemo<BrandCard[]>(() => {
    const brandMap = new Map<string, SocialAccount[]>();
    for (const account of accounts) {
      const brandKey = account.brand || account.brandId || '';
      if (!brandKey || isBrandIgnored(brandKey)) continue;
      const list = brandMap.get(brandKey) ?? [];
      list.push(account);
      brandMap.set(brandKey, list);
    }

    return [...brandMap.entries()]
      .map(([name, brandAccounts]) => {
        const accountIds = new Set(brandAccounts.map((a) => a.id));
        const brandMetrics = metrics.filter((m) => accountIds.has(m.accountId));
        const totalFollowers = brandAccounts.reduce((sum, a) => {
          const latest = brandMetrics
            .filter((m) => m.accountId === a.id)
            .sort((a, b) =>
              a.periodLabel < b.periodLabel
                ? -1
                : a.periodLabel > b.periodLabel
                  ? 1
                  : 0,
            )
            .pop();
          return sum + (latest?.followers ?? 0);
        }, 0);

        const periods = brandMetrics.map((m) => m.periodLabel);
        const latestPeriod =
          periods.length > 0 ? (periods.sort().pop() ?? null) : null;

        const platforms = new Set(brandAccounts.map((a) => a.platform));

        return {
          name,
          accounts: brandAccounts,
          totalFollowers,
          latestPeriod,
          platformCount: platforms.size,
          accountCount: brandAccounts.length,
        };
      })
      .sort((a, b) => b.totalFollowers - a.totalFollowers);
  }, [accounts, metrics]);

  // Get brand colors from centralized palette
  const brandColorMap = useMemo(() => {
    const map = new Map<string, { primary: string; light: string }>();
    brands.forEach((b) => {
      const { primary, light } = getBrandColor(b.name);
      map.set(b.name, { primary, light });
    });
    return map;
  }, [brands]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            در حال بارگذاری برندها...
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-border bg-surface/50"
            />
          ))}
        </div>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Award className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">هنوز هیچ برندی ثبت نشده است.</p>
        <p className="text-xs text-muted-foreground/60">
          ابتدا از بخش مدیریت حساب‌ها، حساب‌های شبکه اجتماعی را اضافه کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">برندها</h1>
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(String(brands.length))} برند — روی هر برند کلیک
            کنید تا جزئیات آن را ببینید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManagement(!showManagement)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
          مدیریت برندها
        </button>
      </div>

      {/* Management section */}
      {showManagement && (
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <BrandManagement />
        </div>
      )}

      {/* Brand mosaic grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand, i) => {
          const bc = brandColorMap.get(brand.name) ?? {
            primary: '#6B7280',
            light: '#6B728018',
          };
          // Status-profile completeness for this brand (null = no profile yet).
          const completeness = summary[brand.name]?.statusProfile ?? null;

          return (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/brands/${brand.accounts[0]?.brandId ?? encodeURIComponent(brand.name)}`}
                className="group block rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${bc.light}, transparent)`,
                  borderColor: `${bc.primary}30`,
                }}
              >
                {/* Brand name + follower count */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <BrandLogo
                      brand={brand.name}
                      className="h-8 w-8 rounded-lg"
                      iconClassName="text-xs"
                    />
                    <div>
                      <h2
                        className="text-base font-bold text-foreground"
                        style={{ color: bc.primary }}
                      >
                        {brand.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {toPersianDigits(String(brand.accountCount))} حساب در{' '}
                        {toPersianDigits(String(brand.platformCount))} پلتفرم
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
                </div>

                {/* Total followers */}
                <div className="mb-4">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {brand.totalFollowers > 0
                      ? toPersianDigits(
                          brand.totalFollowers.toLocaleString('en'),
                        )
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    دنبال‌کننده کل
                  </p>
                </div>

                {/* Brand summary stats */}
                {(() => {
                  // Find matching summary by brand name
                  const s = summary[brand.name];
                  if (!s) return null;
                  const hasAny =
                    s.contentCount > 0 ||
                    s.taskCount > 0 ||
                    s.campaignCount > 0 ||
                    s.totalExpenses > 0;
                  if (!hasAny) return null;
                  return (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {s.contentCount > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1">
                          <FileText className="h-3 w-3 text-blue-500" />
                          <span className="text-[10px] text-muted-foreground">
                            {toPersianDigits(String(s.contentCount))} محتوا
                          </span>
                        </div>
                      )}
                      {s.taskCount > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1">
                          <CheckSquare className="h-3 w-3 text-purple-500" />
                          <span className="text-[10px] text-muted-foreground">
                            {toPersianDigits(String(s.taskCount))} تسک
                          </span>
                        </div>
                      )}
                      {s.campaignCount > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1">
                          <Megaphone className="h-3 w-3 text-cyan-500" />
                          <span className="text-[10px] text-muted-foreground">
                            {toPersianDigits(String(s.campaignCount))} کمپین
                          </span>
                        </div>
                      )}
                      {s.totalExpenses > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1">
                          <Wallet className="h-3 w-3 text-amber-500" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatNumber(s.totalExpenses)} تومان
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Status profile completeness (صورت وضعیت برند) */}
                <ProfileCompletenessIndicator
                  completeness={completeness}
                  barColor={bc.primary}
                />

                {/* Platform icons */}
                <div className="flex flex-wrap gap-2">
                  {[...new Set(brand.accounts.map((a) => a.platform))].map(
                    (platform) => (
                      <div
                        key={platform}
                        className="flex items-center gap-1.5 rounded-lg bg-surface/80 px-2 py-1"
                      >
                        <SocialPlatformIcon
                          platform={platform}
                          className="h-4 w-4 rounded"
                          iconClassName="h-2.5 w-2.5"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {SOCIAL_PLATFORM_LABELS[platform]}
                        </span>
                      </div>
                    ),
                  )}
                </div>

                {/* Latest period */}
                {brand.latestPeriod && (
                  <p className="mt-3 text-[10px] text-muted-foreground/60">
                    آخرین به‌روزرسانی: {brand.latestPeriod}
                  </p>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
 * Profile completeness indicator
 * ========================================================================= */

function ProfileCompletenessIndicator({
  completeness,
  barColor,
}: {
  completeness: StatusProfileCompleteness | null;
  barColor: string;
}) {
  if (!completeness) {
    return (
      <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1.5">
        <ClipboardList className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/60">
          صورت وضعیت ثبت نشده
        </span>
      </div>
    );
  }

  const { percent, filledCount, totalCount } = completeness;
  const tone =
    percent >= 75
      ? { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500' }
      : percent >= 25
        ? { text: 'text-amber-500', bg: 'bg-amber-500' }
        : { text: 'text-muted-foreground', bg: 'bg-muted-foreground/40' };

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ClipboardList className="h-3 w-3" />
          صورت وضعیت برند
        </span>
        <span className={`text-[10px] font-bold tabular-nums ${tone.text}`}>
          {toPersianDigits(String(percent))}٪
        </span>
      </div>
      <Progress
        value={percent}
        className="h-1.5 bg-surface"
        aria-label={`صورت وضعیت برند ${toPersianDigits(String(percent))} درصد تکمیل`}
        // Bar color follows the brand palette; percent drives the tone of the label.
        style={
          {
            '--progress-indicator-color': barColor,
          } as React.CSSProperties
        }
      />
      <p className="mt-1 text-[10px] text-muted-foreground/60">
        {toPersianDigits(String(filledCount))} از{' '}
        {toPersianDigits(String(totalCount))} بخش تکمیل شده
      </p>
      {percent >= 75 && <span className="sr-only">پرونده کامل</span>}
    </div>
  );
}
