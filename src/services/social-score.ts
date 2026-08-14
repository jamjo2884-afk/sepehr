import type {
  SocialAccount,
  SocialBrandScoreRow,
  SocialMetric,
  SocialPlatformScore,
  SocialScore,
  SocialScoreComponent,
  SocialScoreComponentKey,
  SocialScoreConfidence,
} from '@/types/social';
import {
  percentageGrowth,
  sortMetricsByPeriod,
  totalEngagement,
} from '@/services/social-metrics';

/**
 * Social Performance Score — an explainable, rule-based 0–100 score per
 * brand (and per platform) built from `social_accounts` + `social_metrics`.
 *
 * Design rules (hard requirements from the phase spec):
 * - NULL ≠ 0: a component with no real data is `unavailable` and its weight
 *   is redistributed proportionally among the available components — it
 *   never drags the score down artificially.
 * - No fabricated data: the score is only computed from rows that exist.
 * - Audience is normalized (log + percentile), so a big follower count
 *   does not automatically win.
 * - Growth is winsorized (clipped) so extreme spikes do not dominate.
 * - Everything is explainable: each component carries a Persian tooltip
 *   and a rule-based explanation derived from the actual numbers.
 *
 * The score is a pure computation — it is NOT stored in the database.
 */

/* =========================================================================
 * Configuration (single source of truth — never hardcode weights in UI)
 * ========================================================================= */

/** Base weights of the five components (sums to 100). */
export const SOCIAL_SCORE_WEIGHTS: Record<SocialScoreComponentKey, number> = {
  growth: 30,
  engagement: 25,
  audience: 20,
  views: 15,
  publishing: 10,
};

/** Performance bands, highest first. `min` is inclusive. */
export const SOCIAL_SCORE_BANDS: Array<{ min: number; label: string }> = [
  { min: 90, label: 'عالی' },
  { min: 75, label: 'خوب' },
  { min: 60, label: 'متوسط' },
  { min: 40, label: 'نیازمند بهبود' },
  { min: 0, label: 'ضعیف' },
];

/** Growth percentages beyond ±this value are clipped before scoring. */
export const SOCIAL_GROWTH_WINSORIZE_PCT = 50;

/** Engagement rate (in %) that maps to a perfect 100 engagement score. */
export const SOCIAL_ENGAGEMENT_RATE_CAP = 10;

/** Publishing consistency looks back this many periods. */
export const SOCIAL_PUBLISHING_LOOKBACK = 6;

/**
 * Confidence cutoffs: how many periods are "enough" for each level.
 * A single snapshot (1 period) cannot produce growth, so it is 'low';
 * 2+ periods give a valid growth component ('medium'); 6+ periods give
 * enough history for a stable momentum ('high').
 */
const CONFIDENCE_PERIODS: Record<SocialScoreConfidence, number> = {
  high: 6,
  medium: 2,
  low: 0,
};

/** Persian labels + tooltips for each component. */
const COMPONENT_META: Record<
  SocialScoreComponentKey,
  { label: string; tooltip: string }
> = {
  growth: {
    label: 'رشد',
    tooltip:
      'امتیاز رشد بر اساس تغییر تعداد دنبال‌کنندگان نسبت به دورهٔ قبل محاسبه می‌شود.',
  },
  engagement: {
    label: 'تعامل',
    tooltip:
      'امتیاز تعامل بر اساس نرخ تعامل ثبت‌شده در آخرین دوره محاسبه می‌شود.',
  },
  audience: {
    label: 'مخاطب',
    tooltip:
      'امتیاز مخاطب بر اساس جایگاه برند از نظر اندازهٔ دنبال‌کنندگان در بین برندها محاسبه می‌شود (نرمال‌شده، نه عدد خام).',
  },
  views: {
    label: 'بازدید',
    tooltip:
      'امتیاز بازدید بر اساس جایگاه برند از نظر بازدید در آخرین دوره در بین برندها محاسبه می‌شود.',
  },
  publishing: {
    label: 'انتشار',
    tooltip:
      'امتیاز انتشار بر اساس استمرار انتشار محتوا در دوره‌های اخیر محاسبه می‌شود.',
  },
};

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/* =========================================================================
 * Small data helpers (pure, over SocialMetric[])
 * ========================================================================= */

/** Distinct period labels, sorted ascending. */
function distinctPeriods(metrics: SocialMetric[]): string[] {
  return [...new Set(metrics.map((m) => m.periodLabel))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

/** Latest metric per account (snapshot columns). */
function latestByAccount(metrics: SocialMetric[]): Map<string, SocialMetric> {
  const map = new Map<string, SocialMetric>();
  for (const m of sortMetricsByPeriod(metrics)) map.set(m.accountId, m);
  return map;
}

/** Sum of the latest follower snapshot per account. */
function latestFollowerTotal(metrics: SocialMetric[]): number {
  let total = 0;
  for (const m of latestByAccount(metrics).values()) total += m.followers;
  return total;
}

/** Latest-period follower growth % (vs the previous period), or null. */
function latestGrowthRatePct(metrics: SocialMetric[]): number | null {
  const periods = distinctPeriods(metrics);
  if (periods.length < 2) return null;
  const prev = latestFollowerTotal(
    metrics.filter((m) => m.periodLabel === periods[periods.length - 2]),
  );
  const cur = latestFollowerTotal(
    metrics.filter((m) => m.periodLabel === periods[periods.length - 1]),
  );
  if (prev <= 0) return null;
  return percentageGrowth(cur, prev);
}

/** Latest-period engagement total (likes+comments+shares), or null. */
function latestEngagementTotal(metrics: SocialMetric[]): number | null {
  const periods = distinctPeriods(metrics);
  if (periods.length === 0) return null;
  const latest = metrics.filter(
    (m) => m.periodLabel === periods[periods.length - 1],
  );
  const anyReal = latest.some(
    (m) => m.likes !== null || m.comments !== null || m.shares !== null,
  );
  if (!anyReal) return null;
  return latest.reduce((sum, m) => sum + totalEngagement(m), 0);
}

/** Sum of one column across a metric list, null when every row is null. */
function sumColumn(
  metrics: SocialMetric[],
  pick: (m: SocialMetric) => number | null,
): number | null {
  const values = metrics
    .map(pick)
    .filter((v): v is number => typeof v === 'number');
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
}

/** Average of one column across a metric list, null when every row is null. */
function avgColumn(
  metrics: SocialMetric[],
  pick: (m: SocialMetric) => number | null,
): number | null {
  const values = metrics
    .map(pick)
    .filter((v): v is number => typeof v === 'number');
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/* =========================================================================
 * Component scores
 * ========================================================================= */

interface ComponentResult {
  score: number | null;
  explanation: string | null;
}

/**
 * Growth: latest period vs the previous one, blended with the momentum of
 * the last up-to-3 transitions. Winsorized to ±50% so one extreme month
 * cannot dominate. Needs ≥2 periods.
 */
function growthComponent(metrics: SocialMetric[]): ComponentResult {
  const periods = distinctPeriods(metrics);
  if (periods.length < 2) return { score: null, explanation: null };

  // Follower total per period, then month-over-month rates.
  const totals = periods.map((label) =>
    metrics.filter((m) => m.periodLabel === label),
  );
  const rates: number[] = [];
  for (let i = 1; i < totals.length; i++) {
    const prev = latestFollowerTotal(totals[i - 1]);
    const cur = latestFollowerTotal(totals[i]);
    if (prev > 0) {
      rates.push(percentageGrowth(cur, prev));
    }
  }
  if (rates.length === 0) return { score: null, explanation: null };

  const latestRate = rates[rates.length - 1];
  // Momentum: average of the last up-to-3 transitions (incl. latest).
  const recent = rates.slice(-3);
  const momentum = recent.reduce((a, b) => a + b, 0) / recent.length;
  // Blend latest transition (70%) with the momentum (30%).
  const blended = 0.7 * latestRate + 0.3 * momentum;
  const clipped = clamp(
    blended,
    -SOCIAL_GROWTH_WINSORIZE_PCT,
    SOCIAL_GROWTH_WINSORIZE_PCT,
  );
  // 0% growth → 50; +50% → 100; -50% → 0.
  const score = Math.round(50 + clipped);

  const abs = Math.abs(latestRate);
  const direction =
    latestRate > 0
      ? `رشد ${abs.toFixed(1)} درصدی دنبال‌کنندگان نسبت به دورهٔ قبل`
      : latestRate < 0
        ? `کاهش ${abs.toFixed(1)} درصدی دنبال‌کنندگان نسبت به دورهٔ قبل`
        : 'ثابت ماندن تعداد دنبال‌کنندگان نسبت به دورهٔ قبل';
  return { score, explanation: `${direction} بوده است.` };
}

/**
 * Engagement: latest-period average engagement rate. When the rate column
 * is empty but raw engagement exists, derive it as
 * (likes+comments+shares) / followers × 100. Needs any real value.
 */
function engagementComponent(metrics: SocialMetric[]): ComponentResult {
  const periods = distinctPeriods(metrics);
  if (periods.length === 0) return { score: null, explanation: null };
  const latest = metrics.filter(
    (m) => m.periodLabel === periods[periods.length - 1],
  );

  let rate = avgColumn(latest, (m) => m.engagementRate);
  if (rate === null) {
    const engagement = sumColumn(latest, (m) =>
      m.likes === null && m.comments === null && m.shares === null
        ? null
        : totalEngagement(m),
    );
    const followers = latestFollowerTotal(latest);
    if (engagement !== null && engagement > 0 && followers > 0) {
      rate = (engagement / followers) * 100;
    }
  }
  if (rate === null || rate <= 0) return { score: null, explanation: null };

  const score = Math.round(
    clamp((rate / SOCIAL_ENGAGEMENT_RATE_CAP) * 100, 0, 100),
  );
  return {
    score,
    explanation: `نرخ تعامل ${rate.toFixed(2)} درصدی در آخرین دوره ثبت شده است.`,
  };
}

/**
 * Audience: log-normalized + percentile rank of the follower total across
 * the peers that have data. Log dampens the "10× followers = 10× better"
 * effect; percentile adds relative position.
 */
function audienceComponent(
  value: number,
  peerValues: number[],
): ComponentResult {
  if (peerValues.length === 0) return { score: null, explanation: null };

  // Log normalization across peers.
  const logs = peerValues.map((v) => Math.log10(Math.max(v, 1)));
  const minLog = Math.min(...logs);
  const maxLog = Math.max(...logs);
  const logScore =
    maxLog > minLog
      ? ((Math.log10(Math.max(value, 1)) - minLog) / (maxLog - minLog)) * 100
      : 50;

  // Percentile: share of peers strictly below this value.
  const below = peerValues.filter((v) => v < value).length;
  const pctScore =
    peerValues.length > 1 ? (below / (peerValues.length - 1)) * 100 : 50;

  const score = Math.round(clamp(0.5 * logScore + 0.5 * pctScore, 0, 100));
  return {
    score,
    explanation: `اندازهٔ دنبال‌کنندگان این برند در بین ${peerValues.length} برند با داده، نرمال‌شده محاسبه شده است.`,
  };
}

/** Views: latest-period views percentile among peers with views. */
function viewsComponent(
  metrics: SocialMetric[],
  peerValues: number[],
): ComponentResult {
  const periods = distinctPeriods(metrics);
  if (periods.length === 0) return { score: null, explanation: null };
  const latest = metrics.filter(
    (m) => m.periodLabel === periods[periods.length - 1],
  );
  const views = sumColumn(latest, (m) => m.views);
  if (views === null || peerValues.length === 0) {
    return { score: null, explanation: null };
  }
  const below = peerValues.filter((v) => v < views).length;
  const pct =
    peerValues.length > 1 ? (below / (peerValues.length - 1)) * 100 : 50;
  return {
    score: Math.round(clamp(pct, 0, 100)),
    explanation: `بازدید ${views.toLocaleString('en-US')} در آخرین دوره ثبت شده است.`,
  };
}

/** Publishing: consistency = share of the last N periods with posts. */
function publishingComponent(metrics: SocialMetric[]): ComponentResult {
  const periods = distinctPeriods(metrics);
  if (periods.length === 0) return { score: null, explanation: null };
  const recent = periods.slice(-SOCIAL_PUBLISHING_LOOKBACK);
  let withPosts = 0;
  for (const label of recent) {
    const posts = metrics.filter(
      (m) => m.periodLabel === label && (m.posts ?? 0) > 0,
    );
    if (posts.length > 0) withPosts += 1;
  }
  if (withPosts === 0) return { score: null, explanation: null };
  return {
    score: Math.round((withPosts / recent.length) * 100),
    explanation: `در ${withPosts} از ${recent.length} دورهٔ اخیر انتشار محتوا ثبت شده است.`,
  };
}

/* =========================================================================
 * Score assembly
 * ========================================================================= */

/** Redistribute base weights proportionally over the available components. */
function redistribute(
  available: SocialScoreComponentKey[],
): Map<SocialScoreComponentKey, number> {
  const total = available.reduce(
    (sum, key) => sum + SOCIAL_SCORE_WEIGHTS[key],
    0,
  );
  const out = new Map<SocialScoreComponentKey, number>();
  for (const key of available) {
    out.set(key, total > 0 ? (SOCIAL_SCORE_WEIGHTS[key] / total) * 100 : 0);
  }
  return out;
}

/** Band label for a 0–100 score. */
export function scoreBandLabel(score: number): string | null {
  const band = SOCIAL_SCORE_BANDS.find((b) => score >= b.min);
  return band?.label ?? null;
}

/** Confidence from how many periods back the score. */
function confidenceFor(periodCount: number): SocialScoreConfidence {
  if (periodCount >= CONFIDENCE_PERIODS.high) return 'high';
  if (periodCount >= CONFIDENCE_PERIODS.medium) return 'medium';
  return 'low';
}

/**
 * Compute the full breakdown for one entity (brand or platform).
 * `peers` are the audience values of the comparison set.
 */
function assembleComponents(
  metrics: SocialMetric[],
  audience: { value: number; peers: number[] },
  viewsPeers: number[],
): SocialScoreComponent[] {
  const growth = growthComponent(metrics);
  const engagement = engagementComponent(metrics);
  const audienceR = audienceComponent(audience.value, audience.peers);
  const views = viewsComponent(metrics, viewsPeers);
  const publishing = publishingComponent(metrics);

  const results: Record<SocialScoreComponentKey, ComponentResult> = {
    growth,
    engagement,
    audience: audienceR,
    views,
    publishing,
  };
  const available = (Object.keys(results) as SocialScoreComponentKey[]).filter(
    (key) => results[key].score !== null,
  );
  const weights = redistribute(available);

  return (Object.keys(results) as SocialScoreComponentKey[]).map((key) => ({
    key,
    label: COMPONENT_META[key].label,
    score: results[key].score,
    weight: weights.get(key) ?? null,
    tooltip: COMPONENT_META[key].tooltip,
    explanation: results[key].explanation,
  }));
}

/** Weighted 0–100 total from the available components. */
function weightedTotal(components: SocialScoreComponent[]): number | null {
  const available = components.filter(
    (c): c is SocialScoreComponent & { score: number; weight: number } =>
      c.score !== null && c.weight !== null,
  );
  if (available.length === 0) return null;
  const total = available.reduce((sum, c) => sum + c.score * c.weight, 0);
  const weightSum = available.reduce((sum, c) => sum + c.weight, 0);
  return weightSum > 0 ? Math.round(total / weightSum) : null;
}

/** Persian note listing which indicators have no real data. */
function dataQualityNote(components: SocialScoreComponent[]): string | null {
  const unavailable = components.filter((c) => c.score === null);
  if (unavailable.length === 0) return null;
  const names = unavailable.map((c) => `«${c.label}»`).join('، ');
  return `این امتیاز بر اساس داده‌های موجود محاسبه شده است و شاخص ${names} برای این برند ثبت نشده‌اند.`;
}

/* =========================================================================
 * Public API
 * ========================================================================= */

/** Internal richer row used while ranking (extra fields for peers/trend). */
interface BrandScoreDraft {
  brand: string;
  score: number | null;
  confidence: SocialScoreConfidence;
  growth: number | null;
  engagement: number | null;
  followers: number;
  latestViews: number;
  periods: string[];
}

/**
 * Rank every brand by its Social Performance Score (descending), with
 * growth then engagement as tie-breakers. Also carries the score trend
 * (current vs the previous period) per brand.
 */
export function rankBrandsByScore(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
): SocialBrandScoreRow[] {
  const brands = [...new Set(accounts.map((a) => a.brand))];
  const drafts: BrandScoreDraft[] = brands.map((brand) => {
    const ids = new Set(
      accounts.filter((a) => a.brand === brand).map((a) => a.id),
    );
    const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
    const periods = distinctPeriods(brandMetrics);
    return {
      brand,
      score: null,
      confidence: confidenceFor(periods.length),
      // Real values for the ranking columns (not the sub-scores).
      growth: latestGrowthRatePct(brandMetrics),
      engagement: latestEngagementTotal(brandMetrics),
      followers: latestFollowerTotal(brandMetrics),
      latestViews:
        sumColumn(
          brandMetrics.filter(
            (m) => m.periodLabel === (periods[periods.length - 1] ?? ''),
          ),
          (m) => m.views,
        ) ?? 0,
      periods,
    };
  });

  // Audience / views peers = the other brands' values (with real data).
  const followerPeers = drafts.map((d) => d.followers).filter((f) => f > 0);
  const viewsPeers = drafts.map((d) => d.latestViews).filter((v) => v > 0);

  for (const draft of drafts) {
    const ids = new Set(
      accounts.filter((a) => a.brand === draft.brand).map((a) => a.id),
    );
    const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
    const components = assembleComponents(
      brandMetrics,
      { value: draft.followers, peers: followerPeers },
      viewsPeers,
    );
    draft.score = weightedTotal(components);
  }

  // Score desc, then growth desc (nulls last), then engagement desc.
  drafts.sort((a, b) => {
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sa !== sb) return sb - sa;
    const ga = a.growth ?? -Infinity;
    const gb = b.growth ?? -Infinity;
    if (ga !== gb) return gb - ga;
    const ea = a.engagement ?? -Infinity;
    const eb = b.engagement ?? -Infinity;
    return eb - ea;
  });

  // Score trend per brand: current vs the previous period (same dataset
  // minus the latest period of the brand's own series).
  return drafts.map((draft, index) => {
    const ids = new Set(
      accounts.filter((a) => a.brand === draft.brand).map((a) => a.id),
    );
    const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
    let trend: number | null = null;
    if (draft.periods.length >= 2 && draft.score !== null) {
      const cut = draft.periods[draft.periods.length - 2];
      const prevMetrics = brandMetrics.filter((m) => m.periodLabel <= cut);
      const prevComponents = assembleComponents(
        prevMetrics,
        { value: latestFollowerTotal(prevMetrics), peers: followerPeers },
        viewsPeers,
      );
      const prevScore = weightedTotal(prevComponents);
      if (prevScore !== null) trend = draft.score - prevScore;
    }
    return {
      brand: draft.brand,
      score: draft.score,
      confidence: draft.confidence,
      growth: draft.growth,
      engagement: draft.engagement,
      followers: draft.followers,
      trend,
      rank: index + 1,
      rankTotal: drafts.length,
    };
  });
}

/**
 * Full Social Performance Score of one brand, with rank, peers average and
 * the score trend. Peers and rank come from ranking all brands once.
 */
export function calculateSocialScore(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialScore {
  const ranking = rankBrandsByScore(accounts, metrics);
  const brandAccounts = accounts.filter((a) => a.brand === brand);
  const ids = new Set(brandAccounts.map((a) => a.id));
  const brandMetrics = metrics.filter((m) => ids.has(m.accountId));
  const periods = distinctPeriods(brandMetrics);

  const peers = ranking.filter((r) => r.brand !== brand);
  const peerScores = peers
    .map((r) => r.score)
    .filter((s): s is number => s !== null);
  const peersAverage =
    peerScores.length > 0
      ? peerScores.reduce((a, b) => a + b, 0) / peerScores.length
      : null;

  const ownRow = ranking.find((r) => r.brand === brand) ?? null;
  const score = ownRow?.score ?? null;
  const trend = ownRow?.trend ?? null;

  // Views peers: latest-period views of every brand (with real data).
  const brands = [...new Set(accounts.map((a) => a.brand))];
  const viewsPeers: number[] = [];
  for (const other of brands) {
    const otherIds = new Set(
      accounts.filter((a) => a.brand === other).map((a) => a.id),
    );
    const otherMetrics = metrics.filter((m) => otherIds.has(m.accountId));
    const otherPeriods = distinctPeriods(otherMetrics);
    if (otherPeriods.length === 0) continue;
    const latestViews = sumColumn(
      otherMetrics.filter(
        (m) => m.periodLabel === otherPeriods[otherPeriods.length - 1],
      ),
      (m) => m.views,
    );
    if (latestViews !== null && latestViews > 0) viewsPeers.push(latestViews);
  }

  // Components for the breakdown (uses the whole brand history).
  const components = assembleComponents(
    brandMetrics,
    {
      value: latestFollowerTotal(brandMetrics),
      peers: ranking.map((r) => r.followers).filter((f) => f > 0),
    },
    viewsPeers,
  );

  return {
    brand,
    score,
    band: score !== null ? scoreBandLabel(score) : null,
    confidence: ownRow?.confidence ?? confidenceFor(periods.length),
    components,
    previousScore: score !== null && trend !== null ? score - trend : null,
    trend,
    rank: ownRow?.rank ?? null,
    rankTotal: ranking.length,
    peersAverage,
    peersDifference:
      score !== null && peersAverage !== null ? score - peersAverage : null,
    periodCount: periods.length,
    dataQualityNote: dataQualityNote(components),
  };
}

/**
 * Per-platform score of one brand. Audience peers are the brand's own
 * platforms (which platform of THIS brand is strongest), views peers are
 * the platforms of the same brand with views data.
 */
export function calculatePlatformScores(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  brand: string,
): SocialPlatformScore[] {
  const brandAccounts = accounts.filter((a) => a.brand === brand);
  const platforms = [...new Set(brandAccounts.map((a) => a.platform))];

  return platforms.map((platform) => {
    const platformAccounts = brandAccounts.filter(
      (a) => a.platform === platform,
    );
    const ids = new Set(platformAccounts.map((a) => a.id));
    const platformMetrics = metrics.filter((m) => ids.has(m.accountId));
    const periods = distinctPeriods(platformMetrics);

    // Audience peers: this brand's other platforms (with data).
    const peerFollowers = platforms
      .map((p) => {
        if (p === platform) return null;
        const pIds = new Set(
          brandAccounts.filter((a) => a.platform === p).map((a) => a.id),
        );
        return latestFollowerTotal(
          metrics.filter((m) => pIds.has(m.accountId)),
        );
      })
      .filter((v): v is number => v !== null && v > 0);

    const ownFollowers = latestFollowerTotal(platformMetrics);

    const viewsPeers = platforms
      .map((p) => {
        const pIds = new Set(
          brandAccounts.filter((a) => a.platform === p).map((a) => a.id),
        );
        const pMetrics = metrics.filter((m) => pIds.has(m.accountId));
        const pPeriods = distinctPeriods(pMetrics);
        if (pPeriods.length === 0) return null;
        return sumColumn(
          pMetrics.filter(
            (m) => m.periodLabel === pPeriods[pPeriods.length - 1],
          ),
          (m) => m.views,
        );
      })
      .filter((v): v is number => v !== null && v > 0);

    const components = assembleComponents(
      platformMetrics,
      { value: ownFollowers, peers: peerFollowers },
      viewsPeers,
    );
    const score = weightedTotal(components);

    // Trend: current vs previous period of this platform.
    let trend: number | null = null;
    if (periods.length >= 2 && score !== null) {
      const cut = periods[periods.length - 2];
      const prevMetrics = platformMetrics.filter((m) => m.periodLabel <= cut);
      const prevComponents = assembleComponents(
        prevMetrics,
        { value: latestFollowerTotal(prevMetrics), peers: peerFollowers },
        viewsPeers,
      );
      const prevScore = weightedTotal(prevComponents);
      if (prevScore !== null) trend = score - prevScore;
    }

    return {
      platform,
      score,
      band: score !== null ? scoreBandLabel(score) : null,
      confidence: confidenceFor(periods.length),
      components,
      trend,
    };
  });
}
