'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  LineChart as LineChartIcon,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { TrendLineChart } from '@/components/common/trend-line-chart';
import { Button } from '@/components/ui/button';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/persian';
import type {
  SocialTrendsPayload,
  SocialTrendSeries,
} from '@/services/social-trends.service';
import type { SocialMonthRange } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';

/**
 * Time presets are MONTHLY because social_metrics is monthly-only (verified
 * production reality). "کل تاریخچه" (months: 0) shows the full window the API
 * returned — no fake zero-padding beyond real data.
 */
const TIME_PRESETS = [
  { value: '3m', label: '۳ ماه اخیر', months: 3 },
  { value: '6m', label: '۶ ماه اخیر', months: 6 },
  { value: '12m', label: '۱۲ ماه اخیر', months: 12 },
  { value: 'all', label: 'کل تاریخچه', months: 0 },
] as const;

type TimePreset = (typeof TIME_PRESETS)[number]['value'];

/**
 * The 5 social trend charts with ONE shared filter state (brand multi-select
 * + platform multi-select + time window). Rendered by both /social and
 * /command-center — filters are component-local so the two pages stay
 * independent.
 *
 * Server contract: workspace isolation is enforced server-side (the API
 * resolves the caller's workspace brands and never serves another
 * workspace's rows). The component fetches that full workspace payload ONCE
 * and narrows client-side — see `load` for why the old per-brand re-query
 * broke the cascading time filter.
 *
 * Visual contract (matches /social + /command-center natives):
 * - Section heading = the same `SectionTitle` rhythm the analytics dashboard
 *   uses (h2 + 4x4 icon in text-primary) instead of a bespoke header card.
 * - Cards = `rounded-xl border border-border bg-surface/60 p-4`, exactly the
 *   pattern used by FollowersTrendChart / MonthlyGrowthChart on /social and
 *   the data cards on /command-center.
 * - Filter chips = the same FilterChip styling as AnalyticsFilterBar, so the
 *   trends block reads as part of the page, not a foreign widget.
 */
/**
 * Page-level filter shared into this section (the /social page bar and this
 * block's own filter merged into ONE selection). When provided, the internal
 * filter UI is hidden and the page's single brand/platform/time selection
 * drives the 5 charts. The component stays fully standalone without it
 * (/command-center keeps its own independent internal state).
 */
export interface SharedSocialTrendsFilter {
  selectedBrands: string[];
  selectedPlatforms: SocialPlatform[];
  onToggleBrand: (brand: string) => void;
  onTogglePlatform: (platform: SocialPlatform | '__all__') => void;
  /** Resolved page Jalali month range; null → full payload history. */
  range: SocialMonthRange | null;
}

export function SocialTrendsSection({
  className,
  sharedFilter,
}: {
  className?: string;
  sharedFilter?: SharedSocialTrendsFilter;
}) {
  const [data, setData] = useState<SocialTrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [localPlatforms, setLocalPlatforms] = useState<SocialPlatform[]>([]);
  const [localTimePreset, setLocalTimePreset] = useState<TimePreset>('12m');

  // Effective selection: the shared page filter wins when present; internal
  // state is the standalone fallback (/command-center).
  const selectedBrands = sharedFilter
    ? sharedFilter.selectedBrands
    : localBrands;
  const selectedPlatforms = sharedFilter
    ? sharedFilter.selectedPlatforms
    : localPlatforms;

  /**
   * ONE fetch of the whole workspace aggregation. Brand narrowing is
   * deliberately client-side: the cascading time-window logic must measure
   * the selected brands' coverage against the STABLE global month grid. The
   * previous debounced re-query with `brand_ids` shrank `data.months` to the
   * selected brands' own span, so "last N months of the grid" shifted with
   * every selection and every preset stayed available — the chips appeared
   * disconnected from the brand filter. The payload is small (≤13 series ×
   * ≤27 points), so instant client filtering also beats a 350ms round trip.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch('/api/social/trends?months=36', {
        cache: 'no-store',
      });
      const body = (await r.json()) as { ok: boolean } & SocialTrendsPayload;
      if (!r.ok || !body.ok) throw new Error('failed');
      setData(body);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Drop platform selections that the payload doesn't know about (e.g. the
   * workspace's platforms changed) so chips never reference stale keys.
   */
  useEffect(() => {
    if (!data || sharedFilter) return;
    const known = new Set(data.platforms);
    setLocalPlatforms((prev) => prev.filter((p) => known.has(p)));
  }, [data, sharedFilter]);

  /** Client-side narrowing of the workspace-scoped series (the payload is
   * the full workspace; the brand chips slice it instantly, no round trip). */
  const narrowByBrand = useCallback(
    (series: SocialTrendSeries[]): SocialTrendSeries[] =>
      selectedBrands.length === 0
        ? series
        : series.filter((s) => selectedBrands.includes(s.name)),
    [selectedBrands],
  );

  /**
   * Client-side platform narrowing for the per-platform charts. The aggregate
   * charts ("کل") stay untouched so their totals remain consistent with the
   * page's KPI cards.
   */
  const narrowByPlatform = useCallback(
    (series: SocialTrendSeries[]): SocialTrendSeries[] => {
      if (selectedPlatforms.length === 0) return series;
      const keep = new Set<string>(selectedPlatforms);
      return series.filter((s) => keep.has(s.name));
    },
    [selectedPlatforms],
  );

  const cutByWindow = useCallback(
    (series: SocialTrendSeries[]): SocialTrendSeries[] => {
      if (!data || data.months.length === 0) return series;
      // Shared page filter: cut by the resolved Jalali [start, end] window —
      // the SAME range the page's KPI cards and other charts use (custom
      // ranges included). Jalali 'YYYY-MM' labels compare correctly as strings.
      if (sharedFilter) {
        const range = sharedFilter.range;
        if (!range) return series;
        return series
          .map((s) => ({
            ...s,
            points: s.points.filter(
              (p) => p.month >= range.start && p.month <= range.end,
            ),
          }))
          .filter((s) => s.points.length > 0);
      }
      const preset = TIME_PRESETS.find((p) => p.value === localTimePreset)!;
      if (preset.months === 0) return series;
      const months = data.months;
      const startIdx = Math.max(0, months.length - preset.months);
      const window = new Set(months.slice(startIdx));
      return series
        .map((s) => ({
          ...s,
          points: s.points.filter((p) => window.has(p.month)),
        }))
        .filter((s) => s.points.length > 0);
    },
    [data, sharedFilter, localTimePreset],
  );

  const totalReach = useMemo(
    () =>
      cutByWindow([{ name: 'کل', points: data?.totalReach ?? [] }]).at(0)
        ?.points ?? [],
    [cutByWindow, data],
  );
  const viewsByPlatform = useMemo(
    () => narrowByPlatform(cutByWindow(data?.viewsByPlatform ?? [])),
    [cutByWindow, narrowByPlatform, data],
  );
  const followersByBrand = useMemo(
    () => narrowByBrand(cutByWindow(data?.followersByBrand ?? [])),
    [cutByWindow, narrowByBrand, data],
  );
  const followersByPlatform = useMemo(
    () => narrowByPlatform(cutByWindow(data?.followersByPlatform ?? [])),
    [cutByWindow, narrowByPlatform, data],
  );

  const hasAnyData =
    (data?.totalFollowers.length ?? 0) > 0 ||
    totalReach.length > 0 ||
    viewsByPlatform.length > 0 ||
    followersByBrand.length > 0 ||
    followersByPlatform.length > 0;

  /**
   * CASCADING brand → time-window (issue 5): the month set of the data
   * restricted to the selected brands. A preset is offered (chip enabled)
   * only when at least one selected brand has data in that window; with no
   * brand selected every preset is available. Presets without data render
   * disabled (dimmed) instead of hiding — consistent with the FilterChip
   * language of AnalyticsFilterBar while keeping the affordance visible.
   */
  const brandMonths = useMemo(() => {
    if (!data || sharedFilter) return [] as string[];
    if (selectedBrands.length === 0) return data.months;
    const keep = new Set(selectedBrands);
    const months = new Set<string>();
    for (const s of data.followersByBrand) {
      if (!keep.has(s.name)) continue;
      for (const p of s.points) months.add(p.month);
    }
    return [...months].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [data, selectedBrands, sharedFilter]);

  const presetAvailable = useCallback(
    (months: number) => {
      if (months === 0) return brandMonths.length > 0;
      if (brandMonths.length === 0) return false;
      // The newest brand month must be within the preset's lookback of the
      // overall window end — i.e. the window actually contains ≥1 data month.
      const all = data?.months ?? [];
      const end = all[all.length - 1];
      const start = all[Math.max(0, all.length - months)];
      return brandMonths.some((m) => m >= start && m <= end);
    },
    [brandMonths, data],
  );

  // Auto-recover from a now-empty preset (brand narrowed into a window
  // without data): fall back to the widest available view. Internal mode
  // only — the shared page filter has no preset chips to recover.
  useEffect(() => {
    if (sharedFilter) return;
    const preset = TIME_PRESETS.find((p) => p.value === localTimePreset)!;
    if (!presetAvailable(preset.months)) {
      setLocalTimePreset('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandMonths]);

  const platformLabel = (p: string) =>
    (SOCIAL_PLATFORM_LABELS as Record<string, string>)[p] ?? p;

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {/* Section heading — same rhythm as the page's other sections */}
      <SectionHeading icon={LineChartIcon} title="روند شبکه‌های اجتماعی" />

      {loading ? (
        <div className="flex h-48 animate-pulse items-center justify-center rounded-xl border border-border bg-surface/60" />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-sm text-foreground">خطا در دریافت روند‌ها.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            تلاش دوباره
          </Button>
        </div>
      ) : !hasAnyData ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted-foreground">
          برای این بازه زمانی داده‌ای ثبت نشده است.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Internal filters — one state drives all 5 charts (standalone
              mode only; /social passes sharedFilter and hides this block so
              the page bar above is the single filter). */}
          {!sharedFilter ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4">
              <FilterRow
                label={`برند (${selectedBrands.length === 0 ? 'همه' : `${formatNumber(selectedBrands.length)} انتخابشده`})`}
              >
                <FilterChip
                  active={selectedBrands.length === 0}
                  onClick={() => setLocalBrands([])}
                  label="همه برندها"
                />
                {(data?.brands ?? []).map((brand) => (
                  <FilterChip
                    key={brand}
                    active={selectedBrands.includes(brand)}
                    onClick={() =>
                      setLocalBrands((prev) =>
                        prev.includes(brand)
                          ? prev.filter((b) => b !== brand)
                          : [...prev, brand],
                      )
                    }
                    icon={
                      <BrandLogo
                        brand={brand}
                        className="h-6 w-6 rounded-full"
                        iconClassName="text-[11px]"
                      />
                    }
                    label={brand}
                  />
                ))}
              </FilterRow>

              {/* Platform multi-select — built dynamically from the API payload
                (DISTINCT platform of real accounts); never hardcoded. */}
              <FilterRow
                label={`شبکه اجتماعی (${selectedPlatforms.length === 0 ? 'همه' : `${formatNumber(selectedPlatforms.length)} انتخابشده`})`}
              >
                <FilterChip
                  active={selectedPlatforms.length === 0}
                  onClick={() => setLocalPlatforms([])}
                  label="همه شبکه‌ها"
                />
                {(data?.platforms ?? []).map((platform) => (
                  <FilterChip
                    key={platform}
                    active={selectedPlatforms.includes(platform)}
                    onClick={() =>
                      setLocalPlatforms((prev) =>
                        prev.includes(platform)
                          ? prev.filter((p) => p !== platform)
                          : [...prev, platform],
                      )
                    }
                    icon={
                      <SocialPlatformIcon
                        platform={platform}
                        className="h-4 w-4 rounded-full"
                        iconClassName="h-2.5 w-2.5"
                      />
                    }
                    label={platformLabel(platform)}
                  />
                ))}
              </FilterRow>

              <FilterRow label="بازه زمانی">
                {TIME_PRESETS.map((p) => {
                  const available = presetAvailable(p.months);
                  return (
                    <FilterChip
                      key={p.value}
                      active={localTimePreset === p.value}
                      disabled={!available}
                      onClick={() => setLocalTimePreset(p.value)}
                      label={p.label}
                    />
                  );
                })}
              </FilterRow>
              <span className="text-[11px] text-muted-foreground">
                واحد زمان نمودارها «ماه» است (تقویم جلالی) — دیتای متریک ماهانه
                ثبت می‌شود؛ بازه‌های بدون داده برای برندهای انتخابی غیرفعال‌اند.
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              این نمودارها از فیلترهای بالای صفحه پیروی می‌کنند (برند، شبکه و
              بازهٔ زمانی مشترک).
            </p>
          )}

          {/* NOTE: no total-followers chart here — the page's own
              FollowersTrendChart (روند کل دنبال‌کنندگان) already shows the
              absolute totals; drawing the same series twice would duplicate it. */}

          <ChartCard
            icon={Eye}
            title="روند بازدید به تفکیک پلتفرم"
            extra={
              <span className="text-[11px] text-muted-foreground">
                {formatNumber(viewsByPlatform.length)} پلتفرم — ماه‌های بدون
                بازدید صفر نشان داده می‌شود
              </span>
            }
          >
            {viewsByPlatform.length > 0 ? (
              <TrendLineChart series={viewsByPlatform} zeroFill />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={Waypoints}
            title="روند ریچ"
            extra={totalReach.length === 0 ? 'ریچی ثبت نشده است' : undefined}
          >
            {totalReach.length > 0 ? (
              <TrendLineChart series={[{ name: 'کل', points: totalReach }]} />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={TrendingUp}
            title="روند دنبال‌کنندگان به تفکیک برند"
            extra={
              <span className="text-[11px] text-muted-foreground">
                {selectedBrands.length === 0
                  ? `${formatNumber(followersByBrand.length)} برند`
                  : `${formatNumber(followersByBrand.length)} از ${formatNumber(selectedBrands.length)} برند انتخابی`}
              </span>
            }
          >
            {followersByBrand.length > 0 ? (
              <TrendLineChart series={followersByBrand} height="h-[320px]" />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>

          <ChartCard
            icon={Waypoints}
            title="روند دنبال‌کنندگان به تفکیک شبکه اجتماعی"
            extra={
              <span className="text-[11px] text-muted-foreground">
                {formatNumber(followersByPlatform.length)} پلتفرم — hover: شکست
                برند داخل هر پلتفرم
              </span>
            }
          >
            {followersByPlatform.length > 0 ? (
              <TrendLineChart
                series={followersByPlatform}
                height="h-[320px]"
                tooltipBreakdown
              />
            ) : (
              <EmptyNote />
            )}
          </ChartCard>
        </div>
      )}
    </section>
  );
}

/** Heading identical to the analytics dashboard's SectionTitle pattern. */
function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
    </div>
  );
}

/** Labeled row of chips — mirrors AnalyticsFilterBar's row structure. */
function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  extra,
  children,
}: {
  icon: LucideIcon;
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function EmptyNote() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      برای این بازه زمانی داده‌ای ثبت نشده است.
    </p>
  );
}

/**
 * Same visual treatment as AnalyticsFilterBar's FilterChip (rounded-full,
 * active = bg-primary/text-primary-foreground) so the trends filters feel
 * native next to the page's own filter bar.
 */
function FilterChip({
  active,
  onClick,
  label,
  icon,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
