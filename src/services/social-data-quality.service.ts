import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PLATFORM_SPECIFIC_METRIC_FIELDS,
  SOCIAL_METRIC_FIELDS,
  type SocialMetricFieldKey,
} from '@/constants/social-fields';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import {
  ageOfPeriodLabelDays,
  SOCIAL_DATA_STALE_DAYS,
} from '@/services/social-analytics';
import {
  periodLabelForDate,
  sortMetricsByPeriod,
} from '@/services/social-metrics';
import { validateNormalizedMetricValue } from '@/services/social-sync.service';
import {
  fetchAllMetricRows,
  toSocialAccount,
  toSocialMetric,
} from '@/services/social.service';
import type {
  SocialAccount,
  SocialDataQualityAccountStatus,
  SocialDataQualityIssue,
  SocialDataQualityIssueType,
  SocialDataQualityReport,
  SocialDataQualitySeverity,
  SocialDataQualityStatus,
  SocialDataQualitySummary,
  SocialMetric,
  SocialMetricPeriod,
} from '@/types/social';

/**
 * PHASE 15 — Social Data Quality (READ-ONLY).
 *
 * Detects and reports data-quality problems in the real social data
 * (`social_accounts` + `social_metrics`). This layer NEVER writes: it does
 * not fix data, delete data, coerce NULL to 0, remove duplicates or
 * overwrite metrics — it only identifies and reports problems.
 *
 * Rules (severity classification is centralized here):
 *   critical — negative counts, engagement rate outside 0..100, orphan
 *              metric (defensive; the FK prevents it), duplicate of the
 *              business key (account_id, period, period_label)
 *              (defensive; the UNIQUE constraint prevents it)
 *   warning  — account without metrics, stale account (reuses the app's
 *              SOCIAL_DATA_STALE_DAYS = 60 logic), future-dated metric,
 *              temporal gap (missing Jalali months between consecutive
 *              monthly rows)
 *   info     — platform-specific metric field (e.g. Instagram storyViews)
 *              never recorded for the account
 *
 * `analyzeSocialDataQuality` is a pure function (testable, deterministic
 * given a fixed `now`); `getSocialDataQuality` reads real Supabase data
 * with two bounded queries (no N+1) and NO snapshot/mock fallback — a
 * broken backend yields an error, never a fabricated report.
 */

/** Display priority of each severity (lower = shown first). */
const SEVERITY_ORDER: Record<SocialDataQualitySeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Centralized Persian labels — UI components must use these, never raw
 * severity strings, so a severity is never conveyed by color alone.
 */
export const SOCIAL_DATA_QUALITY_SEVERITY_LABELS: Record<
  SocialDataQualitySeverity,
  string
> = {
  critical: 'مشکل جدی',
  warning: 'نیازمند بررسی',
  info: 'اطلاعات',
};

/** Centralized Persian labels for every issue type (UI must use these). */
export const SOCIAL_DATA_QUALITY_ISSUE_TYPE_LABELS: Record<
  SocialDataQualityIssueType,
  string
> = {
  negative_metric: 'مقدار منفی',
  invalid_engagement_rate: 'نرخ تعامل نامعتبر',
  future_metric: 'متریک آینده',
  stale_account: 'دادهٔ قدیمی',
  temporal_gap: 'شکاف زمانی',
  orphan_metric: 'متریک یتیم',
  duplicate_metric: 'تکرار رکورد',
  missing_optional_field: 'فیلد اختیاری ثبت‌نشده',
  account_without_metrics: 'حساب بدون متریک',
};

/** Whether a stored period label matches the expected format of its period. */
function isValidPeriodLabel(
  period: SocialMetricPeriod,
  label: string,
): boolean {
  switch (period) {
    case 'monthly':
      return /^\d{4}-\d{2}$/.test(label);
    case 'daily':
      return /^\d{4}-\d{2}-\d{2}$/.test(label);
    case 'weekly':
      return /^\d{4}-W\d{2}$/.test(label);
  }
}

/** Parse a 'YYYY-MM' Jalali monthly label into its year/month components. */
function parseMonthlyLabel(label: string): { jy: number; jm: number } | null {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  // Parse guard only — not a business threshold. Jalali years actually in
  // use are far inside this range.
  if (jm < 1 || jm > 12 || jy < 1300 || jy > 1600) return null;
  return { jy, jm };
}

/** Build a deterministic issue id from its parts. */
function issueId(
  type: SocialDataQualityIssue['type'],
  accountId: string | null,
  suffix: string,
): string {
  return `${type}:${accountId ?? 'none'}:${suffix}`;
}

/**
 * Run every data-quality rule over a set of accounts and metrics.
 * Pure and deterministic — `now` is injectable for tests.
 */
export function analyzeSocialDataQuality(
  accounts: SocialAccount[],
  metrics: SocialMetric[],
  now: Date = new Date(),
): SocialDataQualityReport {
  const issues: SocialDataQualityIssue[] = [];
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const metricsByAccount = new Map<string, SocialMetric[]>();
  for (const metric of metrics) {
    const list = metricsByAccount.get(metric.accountId) ?? [];
    list.push(metric);
    metricsByAccount.set(metric.accountId, list);
  }

  /* ------------------------------------------------------------------
   * Cross-account rules
   * ------------------------------------------------------------------ */

  // Orphan metric — defensive: `social_metrics.account_id` is a FK with
  // ON DELETE CASCADE, so this can only appear if data bypassed the app.
  for (const metric of metrics) {
    if (!accountById.has(metric.accountId)) {
      issues.push({
        id: issueId('orphan_metric', metric.accountId, String(metric.id)),
        severity: 'critical',
        type: 'orphan_metric',
        accountId: metric.accountId,
        platform: null,
        metricId: String(metric.id),
        metricDate: metric.periodLabel,
        field: null,
        message: 'متریک به حسابی ارجاع می‌دهد که وجود ندارد.',
        details: { metricId: String(metric.id) },
      });
    }
  }

  // Duplicate of the business key (account_id, period, period_label) —
  // defensive invariant: the UNIQUE constraint prevents this, so the rule
  // stays as a guard and must not produce fake issues on healthy data.
  const byBusinessKey = new Map<string, SocialMetric[]>();
  for (const metric of metrics) {
    const key = `${metric.accountId}|${metric.period}|${metric.periodLabel}`;
    const list = byBusinessKey.get(key) ?? [];
    list.push(metric);
    byBusinessKey.set(key, list);
  }
  for (const [key, group] of byBusinessKey) {
    if (group.length > 1) {
      const first = group[0];
      issues.push({
        id: issueId('duplicate_metric', first.accountId, key),
        severity: 'critical',
        type: 'duplicate_metric',
        accountId: first.accountId,
        platform: accountById.get(first.accountId)?.platform ?? null,
        // The issue concerns the whole (account, period, label) group;
        // keying it on one member's id keeps groups distinguishable.
        metricId: String(first.id),
        metricDate: first.periodLabel,
        field: null,
        message: `برای کلید یکسان (حساب، دوره، برچسب دوره) ${group.length} رکورد ثبت شده است.`,
        details: { count: group.length, businessKey: key },
      });
    }
  }

  /* ------------------------------------------------------------------
   * Per-account rules
   * ------------------------------------------------------------------ */
  for (const account of accounts) {
    const accountMetrics = sortMetricsByPeriod(
      metricsByAccount.get(account.id) ?? [],
    );

    // Account without any metric.
    if (accountMetrics.length === 0) {
      issues.push({
        id: issueId('account_without_metrics', account.id, 'none'),
        severity: 'warning',
        type: 'account_without_metrics',
        accountId: account.id,
        platform: account.platform,
        metricId: null,
        metricDate: null,
        field: null,
        message: 'برای این حساب هنوز هیچ متریکی ثبت نشده است.',
        details: null,
      });
      // No metrics ⇒ none of the metric-level rules apply.
      continue;
    }

    // Per-metric rules: negative counts / invalid engagement rate
    // (same rules as the sync validator, reused per field) and
    // future-dated metrics.
    for (const metric of accountMetrics) {
      for (const field of Object.keys(
        SOCIAL_METRIC_FIELDS,
      ) as SocialMetricFieldKey[]) {
        const value = metric[field];
        if (value === null || typeof value !== 'number') continue;
        const error = validateNormalizedMetricValue(field, value);
        if (error) {
          issues.push({
            id: issueId(
              field === 'engagementRate'
                ? 'invalid_engagement_rate'
                : 'negative_metric',
              account.id,
              `${String(metric.id)}:${field}`,
            ),
            severity: 'critical',
            type:
              field === 'engagementRate'
                ? 'invalid_engagement_rate'
                : 'negative_metric',
            accountId: account.id,
            platform: account.platform,
            metricId: String(metric.id),
            metricDate: metric.periodLabel,
            field,
            message: error,
            details: { storedValue: value },
          });
        }
      }

      // Future metric: the stored period label is after today's label for
      // the same granularity (labels are sortable within a granularity).
      // Only labels matching the expected format are compared.
      const currentLabel = periodLabelForDate(now, metric.period);
      if (
        isValidPeriodLabel(metric.period, metric.periodLabel) &&
        metric.periodLabel > currentLabel
      ) {
        issues.push({
          id: issueId('future_metric', account.id, String(metric.id)),
          severity: 'warning',
          type: 'future_metric',
          accountId: account.id,
          platform: account.platform,
          metricId: String(metric.id),
          metricDate: metric.periodLabel,
          field: null,
          message: `متریک برای دورهٔ ${metric.periodLabel} در آینده ثبت شده است.`,
          details: { currentPeriodLabel: currentLabel },
        });
      }
    }

    // Temporal gap — conservative rule: only monthly rows (the granularity
    // with real data today; daily/weekly labels can't be compared without
    // an anchor date and imported rows often lack period_start). When two
    // consecutive monthly labels are both valid, a difference of more than
    // one Jalali month is reported as a warning. No project threshold
    // exists for gaps, so the rule stays at "missing month(s) in the
    // account's own monthly series" — it fires only on genuinely skipped
    // periods, never on optional/sparse data outside that definition.
    let previousMonthly: SocialMetric | null = null;
    for (const metric of accountMetrics) {
      if (metric.period !== 'monthly') continue;
      if (previousMonthly) {
        const from = parseMonthlyLabel(previousMonthly.periodLabel);
        const to = parseMonthlyLabel(metric.periodLabel);
        if (from && to) {
          const gapMonths = (to.jy - from.jy) * 12 + (to.jm - from.jm) - 1;
          if (gapMonths > 0) {
            issues.push({
              id: issueId('temporal_gap', account.id, metric.periodLabel),
              severity: 'warning',
              type: 'temporal_gap',
              accountId: account.id,
              platform: account.platform,
              // The gap is anchored on the LATER metric of the pair.
              metricId: String(metric.id),
              metricDate: metric.periodLabel,
              field: null,
              message: `بین دورهٔ ${previousMonthly.periodLabel} و ${metric.periodLabel}، ${gapMonths} ماه بدون داده وجود دارد.`,
              details: {
                gapMonths,
                fromLabel: previousMonthly.periodLabel,
                toLabel: metric.periodLabel,
              },
            });
          }
        }
      }
      previousMonthly = metric;
    }

    // Platform-specific metric field never recorded (info only — an
    // optional field being NULL is normal and never a critical problem).
    // NULL is not interpreted as zero: only the presence/absence of a
    // stored value is checked.
    for (const field of PLATFORM_SPECIFIC_METRIC_FIELDS[account.platform]) {
      const everRecorded = accountMetrics.some((m) => m[field] !== null);
      if (!everRecorded) {
        issues.push({
          id: issueId('missing_optional_field', account.id, field),
          severity: 'info',
          type: 'missing_optional_field',
          accountId: account.id,
          platform: account.platform,
          metricId: null,
          metricDate: null,
          field,
          message: `متریک «${SOCIAL_METRIC_FIELDS[field].label}» (ویژهٔ ${SOCIAL_PLATFORM_LABELS[account.platform]}) برای این حساب ثبت نشده است.`,
          details: null,
        });
      }
    }

    // Stale account — reuses the app's existing freshness logic and the
    // existing threshold (SOCIAL_DATA_STALE_DAYS = 60). Non-monthly labels
    // and unparsable labels yield null from ageOfPeriodLabelDays and are
    // simply not flagged (same behavior as the brand timeline).
    const latest = accountMetrics[accountMetrics.length - 1];
    const ageDays = latest
      ? ageOfPeriodLabelDays(latest.periodLabel, now)
      : null;
    if (
      latest &&
      ageDays !== null &&
      Number.isFinite(ageDays) &&
      ageDays > SOCIAL_DATA_STALE_DAYS
    ) {
      issues.push({
        id: issueId('stale_account', account.id, 'none'),
        severity: 'warning',
        type: 'stale_account',
        accountId: account.id,
        platform: account.platform,
        // Tied to the specific latest metric row: when a newer metric is
        // added the issue (and its identity) changes, so an old review can
        // never carry over to a new stale issue.
        metricId: String(latest.id),
        metricDate: latest.periodLabel,
        field: null,
        message: `آخرین متریک این حساب ${ageDays} روز قبل ثبت شده است (آستانه: ${SOCIAL_DATA_STALE_DAYS} روز).`,
        details: { ageDays, thresholdDays: SOCIAL_DATA_STALE_DAYS },
      });
    }
  }

  /* ------------------------------------------------------------------
   * Account statuses + summary
   * ------------------------------------------------------------------ */

  // Priority: critical > warning > healthy.
  const accountsStatus: SocialDataQualityAccountStatus[] = accounts.map(
    (account) => {
      const accountIssues = issues.filter((i) => i.accountId === account.id);
      const criticalCount = accountIssues.filter(
        (i) => i.severity === 'critical',
      ).length;
      const warningCount = accountIssues.filter(
        (i) => i.severity === 'warning',
      ).length;
      const infoCount = accountIssues.filter(
        (i) => i.severity === 'info',
      ).length;
      const status: SocialDataQualityStatus =
        criticalCount > 0
          ? 'critical'
          : warningCount > 0
            ? 'warning'
            : 'healthy';
      return {
        accountId: account.id,
        status,
        issueCount: accountIssues.length,
        criticalCount,
        warningCount,
        infoCount,
      };
    },
  );

  const summary: SocialDataQualitySummary = {
    totalAccounts: accounts.length,
    healthyAccounts: accountsStatus.filter((a) => a.status === 'healthy')
      .length,
    warningAccounts: accountsStatus.filter((a) => a.status === 'warning')
      .length,
    criticalAccounts: accountsStatus.filter((a) => a.status === 'critical')
      .length,
    totalIssues: issues.length,
  };

  issues.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.id.localeCompare(b.id),
  );

  return { summary, issues, accounts: accountsStatus };
}

/**
 * Read the real social data from Supabase and produce the data-quality
 * report. Two bounded queries (accounts + paginated metrics) — no N+1.
 *
 * Deliberately does NOT reuse `getSocialAccounts`/`getSocialMetrics`,
 * because those fall back to the bundled snapshot when Supabase is empty
 * or unreachable; a quality report over mock data would be meaningless, so
 * this reader never falls back — it throws instead (the route turns it
 * into a 500).
 */
export async function getSocialDataQuality(
  options: { supabase?: SupabaseClient } = {},
): Promise<SocialDataQualityReport> {
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const [accountResult, metricRows] = await Promise.all([
    supabase
      .from('social_accounts')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(10000),
    fetchAllMetricRows(supabase, undefined, undefined),
  ]);
  if (accountResult.error) throw accountResult.error;
  const rows = (accountResult.data ?? []) as unknown as Parameters<
      typeof toSocialAccount
    >[0][];
  const { resolveBrandNames } = await import('@/services/brand.service');
  const brandIds = rows
    .map((r) => (r as unknown as { brand_id?: string | null }).brand_id)
    .filter((id): id is string => !!id);
  const brandNames = await resolveBrandNames(brandIds);
  const accounts = rows.map((r) => toSocialAccount(r, brandNames));
  const metrics = metricRows.map(toSocialMetric);
  return analyzeSocialDataQuality(accounts, metrics);
}
