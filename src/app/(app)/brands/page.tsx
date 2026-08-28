'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Award, ExternalLink, Loader2, Settings } from 'lucide-react';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';
import type { SocialAccount, SocialMetric } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { BrandLogo } from '@/components/common/brand-logo';
import { getBrandColor, isBrandIgnored } from '@/constants/brand-colors';
import { toPersianDigits } from '@/utils/persian';
import { BrandManagement } from '@/components/brands/brand-management';

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
  const [showManagement, setShowManagement] = useState(false);

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
      if (isBrandIgnored(account.brand)) continue;
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">برندها</h1>
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(String(brands.length))} برند — روی هر برند کلیک کنید تا جزئیات آن را ببینید.
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
          // Use the first account's brand name for the encoded key
          const encodedKey = encodeURIComponent(
            [brand.name, brand.accounts[0]?.platform ?? 'instagram', brand.accounts[0]?.username ?? ''].join('|'),
          );
          const bc = brandColorMap.get(brand.name) ?? { primary: '#6B7280', light: '#6B728018' };

          return (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/social/${encodedKey}`}
                className="group block rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, ${bc.light}, transparent)`,
                  borderColor: `${bc.primary}30`,
                }}
              >
                {/* Brand name + follower count */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <BrandLogo brand={brand.name} className="h-8 w-8 rounded-lg" iconClassName="text-xs" />
                    <div>
                    <h2 className="text-base font-bold text-foreground" style={{ color: bc.primary }}>
                      {brand.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {toPersianDigits(String(brand.accountCount))} حساب در{' '}
                      {toPersianDigits(String(brand.platformCount))} پلتفرم
                    </p>
                    </div>
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
