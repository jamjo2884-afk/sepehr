'use client';

import {
  Award,
  Info,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  SocialPlatformScore,
  SocialScore,
  SocialScoreComponent,
  SocialScoreConfidence,
} from '@/types/social';
import { SOCIAL_SCORE_WEIGHTS } from '@/services/social-score';
import type { SocialScoreComponentKey } from '@/types/social';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { toPersianDigits } from '@/utils/persian';
import { cn } from '@/lib/utils';
import { BrandSectionTitle } from './shared';

/**
 * Social Performance Score card: overall score with band, trend, confidence,
 * a breakdown of the components (weight + sub-score + tooltip + rule-based
 * explanation), the brand's rank vs peers, and the per-platform scores.
 */

const CONFIDENCE_META: Record<
  SocialScoreConfidence,
  { label: string; className: string }
> = {
  high: {
    label: 'بالا',
    className: 'bg-success/10 text-success',
  },
  medium: {
    label: 'متوسط',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  low: {
    label: 'کم',
    className: 'bg-muted text-muted-foreground',
  },
};

const COMPONENT_ICONS: Record<SocialScoreComponentKey, LucideIcon> = {
  growth: TrendingUp,
  engagement: Award,
  audience: ShieldCheck,
  views: TrendingUp,
  publishing: Award,
};

export function BrandScoreCard({
  score,
  platformScores,
}: {
  score: SocialScore;
  platformScores: SocialPlatformScore[];
}) {
  return (
    <section>
      <BrandSectionTitle
        title="امتیاز عملکرد شبکه‌های اجتماعی"
        extra={
          <span className="text-[11px] text-muted-foreground">
            بر اساس دادهٔ واقعی ثبت‌شده — بدون دادهٔ ساختگی
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score overview */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-5 lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Social Performance Score
              </p>
              {score.score === null ? (
                <p className="mt-1 text-3xl font-bold text-muted-foreground">
                  —
                </p>
              ) : (
                <p className="mt-1 text-4xl font-bold tabular-nums text-foreground">
                  {toPersianDigits(score.score)}
                  <span className="text-lg font-medium text-muted-foreground">
                    {' '}
                    / ۱۰۰
                  </span>
                </p>
              )}
            </div>
            {score.band ? (
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  bandClassName(score.score),
                )}
              >
                {score.band}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {score.trend !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-sm font-semibold',
                  score.trend > 0
                    ? 'text-success'
                    : score.trend < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                )}
              >
                {score.trend > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : score.trend < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : null}
                {score.trend > 0 ? '+' : score.trend < 0 ? '−' : ''}
                {toPersianDigits(Math.abs(score.trend))}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">روند: —</span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                CONFIDENCE_META[score.confidence].className,
              )}
            >
              اطمینان: {CONFIDENCE_META[score.confidence].label}
            </span>
          </div>

          {score.rank !== null ? (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface/40 p-3 text-sm">
              <p className="text-muted-foreground">
                رتبهٔ این برند:{' '}
                <span className="font-semibold text-primary">
                  {toPersianDigits(score.rank)}
                </span>{' '}
                از {toPersianDigits(score.rankTotal)} برند
              </p>
              {score.peersAverage !== null && score.score !== null ? (
                <p className="text-muted-foreground">
                  میانگین برندهای دیگر:{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {toPersianDigits(Math.round(score.peersAverage))}
                  </span>
                  {score.peersDifference !== null ? (
                    <span
                      className={cn(
                        'mr-1 text-xs font-semibold',
                        score.peersDifference > 0
                          ? 'text-success'
                          : score.peersDifference < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                      )}
                    >
                      {Math.round(score.peersDifference) === 0 ? (
                        '≈ همسطح میانگین'
                      ) : (
                        <>
                          ({score.peersDifference > 0 ? '+' : '−'}
                          {toPersianDigits(
                            Math.round(Math.abs(score.peersDifference)),
                          )}{' '}
                          نسبت به میانگین)
                        </>
                      )}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {score.dataQualityNote ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {score.dataQualityNote}
            </p>
          ) : null}
        </div>

        {/* Breakdown */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-5 lg:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            ترکیب امتیاز (وزن‌ها پس از توزیع مجدد)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {score.components.map((component) => (
              <ComponentRow key={component.key} component={component} />
            ))}
          </div>
        </div>
      </div>

      {/* Platform scores */}
      {platformScores.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            امتیاز هر شبکه
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {platformScores.map((platform) => (
              <div
                key={platform.platform}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3"
              >
                <SocialPlatformIcon
                  platform={platform.platform}
                  className="h-8 w-8 rounded-md"
                  iconClassName="h-4 w-4"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {SOCIAL_PLATFORM_LABELS[platform.platform]}
                  </span>
                  {platform.score === null ? (
                    <span className="text-sm font-semibold text-muted-foreground">
                      —
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-lg font-bold tabular-nums text-foreground">
                        {toPersianDigits(platform.score)}
                      </span>
                      {platform.trend !== null ? (
                        <span
                          className={cn(
                            'text-[11px] font-semibold',
                            platform.trend > 0
                              ? 'text-success'
                              : platform.trend < 0
                                ? 'text-destructive'
                                : 'text-muted-foreground',
                          )}
                        >
                          {platform.trend > 0
                            ? '+'
                            : platform.trend < 0
                              ? '−'
                              : ''}
                          {toPersianDigits(Math.abs(platform.trend))}
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'mr-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
                    CONFIDENCE_META[platform.confidence].className,
                  )}
                >
                  {CONFIDENCE_META[platform.confidence].label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            امتیاز هر شبکهٔ این برند نسبت به سایر شبکه‌های همان برند محاسبه
            می‌شود.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function bandClassName(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 90) return 'bg-success/15 text-success';
  if (score >= 75) return 'bg-primary/10 text-primary';
  if (score >= 60) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-destructive/10 text-destructive';
}

function ComponentRow({ component }: { component: SocialScoreComponent }) {
  const Icon = COMPONENT_ICONS[component.key];
  const baseWeight = SOCIAL_SCORE_WEIGHTS[component.key];
  return (
    <div
      className="group flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface/40 p-3"
      title={component.tooltip}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {component.label}
        </span>
        {component.score === null ? (
          <span className="text-xs text-muted-foreground">
            بدون داده
            <span className="mr-1 text-[10px]">
              (وزن پایه {toPersianDigits(baseWeight)}٪)
            </span>
          </span>
        ) : (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {toPersianDigits(component.score)}
            <span className="mr-1 text-[10px] font-normal text-muted-foreground">
              ({toPersianDigits(Math.round(component.weight ?? 0))}٪)
            </span>
          </span>
        )}
      </div>
      {component.score !== null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', barClassName(component.score))}
            style={{ width: `${component.score}%` }}
          />
        </div>
      ) : null}
      {component.explanation ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {component.explanation}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          برای این شاخص داده‌ای ثبت نشده است — در امتیاز نهایی لحاظ نشده و وزن
          آن بین سایر شاخص‌ها توزیع شده است.
        </p>
      )}
    </div>
  );
}

function barClassName(score: number): string {
  if (score >= 90) return 'bg-success';
  if (score >= 75) return 'bg-primary';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-destructive';
}
