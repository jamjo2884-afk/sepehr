'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Award, ExternalLink, Loader2 } from 'lucide-react';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { toPersianDigits } from '@/utils/persian';

interface BrandCard {
  name: string;
  accounts: SocialAccount[];
  totalFollowers: number;
  latestPeriod: string | null;
  platformCount: number;
  accountCount: number;
}

export default function BrandsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [metrics, setMetrics] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ])
      .then(([acc, met]) => {
        setAccounts(acc);
        setMetrics(met);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const brands = useMemo<BrandCard[]>(() => {
    const brandMap = new Map<string, SocialAccount[]>();
    for (const account of accounts) {
      const list = brandMap.get(account.brand) ?? [];
      list.push(account);
      brandMap.set(account.brand, list);
    }

    return [...brandMap.entries()]
      .map(([name, brandAccounts]) => {
        const accountIds = new Set(brandAccounts.map((a) => a.id));
        const brandMetrics = metrics.filter((m) =>
          accountIds.has(m.accountId),
        );
        const totalFollowers = brandAccounts.reduce((sum, a) => {
          const latest = brandMetrics
            .filter((m) => m.accountId === a.id)
            .sort((a, b) =>
              a.periodLabel < b.periodLabel ? -1 : a.periodLabel > b.periodLabel ? 1 : 0,
            )
            .pop();
          return sum + (latest?.followers ?? 0);
        }, 0);

        const periods = brandMetrics.map((m) => m.periodLabel);
        const latestPeriod =
          periods.length > 0
            ? periods.sort().pop() ?? null
            : null;

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

  // Generate a deterministic color for each brand
  const brandColors = useMemo(() => {
    const palette = [
      'from-blue-500/20 to-blue-600/10 border-blue-500/30',
      'from-purple-500/20 to-purple-600/10 border-purple-500/30',
      'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
      'from-amber-500/20 to-amber-600/10 border-amber-500/30',
      'from-rose-500/20 to-rose-600/10 border-rose-500/30',
      'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
      'from-violet-500/20 to-violet-600/10 border-violet-500/30',
      'from-teal-500/20 to-teal-600/10 border-teal-500/30',
      'from-pink-500/20 to-pink-600/10 border-pink-500/30',
      'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
    ];
    const map = new Map<string, string>();
    brands.forEach((b, i) => {
      map.set(b.name, palette[i % palette.length]);
    });
    return map;
  }, [brands]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">در حال بارگذاری برندها...</p>
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
        <p className="text-muted-foreground">
          هنوز هیچ برندی ثبت نشده است.
        </p>
        <p className="text-xs text-muted-foreground/60">
          ابتدا از بخش مدیریت حساب‌ها، حساب‌های شبکه اجتماعی را اضافه کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">برندها</h1>
        <p className="text-sm text-muted-foreground">
          {toPersianDigits(String(brands.length))} برند — روی هر برند کلیک کنید تا جزئیات آن را ببینید.
        </p>
      </div>

      {/* Brand mosaic grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand, i) => {
          // Use the first account's brand name for the encoded key
          const encodedKey = encodeURIComponent(
            [brand.name, brand.accounts[0]?.platform ?? 'instagram', brand.accounts[0]?.username ?? ''].join('|'),
          );
          const colorClass = brandColors.get(brand.name) ?? 'from-blue-500/20 to-blue-600/10 border-blue-500/30';

          return (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/social/${encodedKey}`}
                className={`group block rounded-2xl border bg-gradient-to-br p-5 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${colorClass}`}
              >
                {/* Brand name + follower count */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {brand.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {toPersianDigits(String(brand.accountCount))} حساب در{' '}
                      {toPersianDigits(String(brand.platformCount))} پلتفرم
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>

                {/* Total followers */}
                <div className="mb-4">
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {brand.totalFollowers > 0
                      ? toPersianDigits(brand.totalFollowers.toLocaleString('en'))
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    دنبال‌کننده کل
                  </p>
                </div>

                {/* Platform icons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    ...new Set(brand.accounts.map((a) => a.platform)),
                  ].map((platform) => (
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
                  ))}
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
