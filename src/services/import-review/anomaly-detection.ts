/**
 * Anomaly Detection Service for Import Review Center.
 *
 * Compares metric values in import rows against historical data
 * to detect unusual spikes, drops, negative values, and other anomalies.
 *
 * Detection methods:
 * 1. Z-score: values > 3σ from mean are flagged
 * 2. Ratio: values > 5x or < 0.2x of mean are flagged
 * 3. Spike detection: compared to previous period
 * 4. Domain rules: negative values, impossible engagement rates, etc.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportRow,
  MetricAnomaly,
  RowAnomalyReport,
  SessionAnomalySummary,
  AnomalyType,
  AnomalySeverity,
} from '@/types/import-review';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Z-score threshold for outlier detection (3σ = 99.7% of normal data). */
const Z_THRESHOLD = 3;

/** Minimum number of historical data points needed for statistical detection. */
const MIN_HISTORY_FOR_ZSCORE = 3;

/** Ratio thresholds: values > MULTIPLIER * mean or < mean / MULTIPLIER are flagged. */
const HIGH_MULTIPLIER = 5;
const LOW_MULTIPLIER = 5;

/** Maximum valid engagement rate (%). */
const MAX_ENGAGEMENT_RATE = 100;

/** Minimum ratio for spike detection (new value / previous value). */
const SPIKE_RATIO = 3;

/** Minimum ratio for drop detection (previous value / new value). */
const DROP_RATIO = 3;

// ─── Metric fields to check ────────────────────────────────────────────────

const METRIC_FIELDS_TO_CHECK: SocialMetricFieldKey[] = [
  'followers', 'following', 'posts', 'views', 'likes',
  'comments', 'shares', 'saves', 'reach', 'impressions',
  'engagementRate', 'storyViews', 'channelMembers', 'retweets', 'subscribers',
];

// ─── Statistical Helpers ────────────────────────────────────────────────────

interface Stats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

function computeStats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

function zScore(value: number, stats: Stats): number {
  if (stats.stdDev === 0) return 0;
  return (value - stats.mean) / stats.stdDev;
}

// ─── Client helper ──────────────────────────────────────────────────────────

async function getClient(supabase?: SupabaseClient): Promise<SupabaseClient> {
  if (supabase) return supabase;
  const { supabase: client } = await import('@/lib/supabase');
  return client;
}

// ─── Historical Data Fetching ───────────────────────────────────────────────

/**
 * Fetch all historical metrics for the given account IDs.
 * Returns a map: accountId → array of metric rows (sorted by periodLabel).
 */
async function fetchHistoricalMetrics(
  accountIds: string[],
  sb: SupabaseClient,
): Promise<Map<string, Array<Record<string, unknown>>>> {
  const historyMap = new Map<string, Array<Record<string, unknown>>>();
  if (accountIds.length === 0) return historyMap;

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('social_metrics')
      .select('*')
      .in('account_id', accountIds)
      .order('period_label', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      const aid = row.account_id as string;
      if (!historyMap.has(aid)) historyMap.set(aid, []);
      historyMap.get(aid)!.push(row as Record<string, unknown>);
    }

    if (data.length < PAGE) break;
  }

  return historyMap;
}

// ─── Single-Row Anomaly Detection ───────────────────────────────────────────

function detectAnomaliesForRow(
  importValues: Record<string, number | null>,
  historicalMetrics: Array<Record<string, unknown>>,
  previousPeriodValues: Record<string, number | null> | null,
): MetricAnomaly[] {
  const anomalies: MetricAnomaly[] = [];

  for (const field of METRIC_FIELDS_TO_CHECK) {
    const importVal = importValues[field];
    if (importVal === null || importVal === undefined) continue;

    const fieldSpec = SOCIAL_METRIC_FIELDS[field];
    const fieldLabel = fieldSpec?.label ?? field;

    // Extract historical values for this field
    const histValues: number[] = [];
    for (const m of historicalMetrics) {
      const v = m[field];
      if (typeof v === 'number' && v !== null) {
        histValues.push(v);
      }
    }

    // ── Domain Rule: Negative values ───────────────────────────────────
    if (importVal < 0) {
      anomalies.push({
        field,
        fieldLabel,
        type: 'negative_value',
        severity: 'critical',
        importValue: importVal,
        historicalMean: histValues.length > 0 ? computeStats(histValues)!.mean : null,
        historicalMax: histValues.length > 0 ? computeStats(histValues)!.max : null,
        historicalMin: histValues.length > 0 ? computeStats(histValues)!.min : null,
        previousValue: previousPeriodValues?.[field] ?? null,
        deviationFactor: null,
        message: `مقدار منفی (${importVal}) غیرمعتبر است.`,
      });
      continue;
    }

    // ── Domain Rule: Engagement rate > 100% ────────────────────────────
    if (field === 'engagementRate' && importVal > MAX_ENGAGEMENT_RATE) {
      anomalies.push({
        field,
        fieldLabel,
        type: 'impossible_engagement',
        severity: 'critical',
        importValue: importVal,
        historicalMean: histValues.length > 0 ? computeStats(histValues)!.mean : null,
        historicalMax: histValues.length > 0 ? computeStats(histValues)!.max : null,
        historicalMin: histValues.length > 0 ? computeStats(histValues)!.min : null,
        previousValue: previousPeriodValues?.[field] ?? null,
        deviationFactor: null,
        message: `نرخ تعامل ${importVal}% بیشتر از ۱۰۰٪ است.`,
      });
      continue;
    }

    // ── Domain Rule: Zero followers with non-zero data ──────────────────
    if (field === 'followers' && importVal === 0) {
      const hasOtherData = Object.entries(importValues).some(
        ([k, v]) => k !== 'followers' && v !== null && v !== undefined && v > 0,
      );
      if (hasOtherData) {
        anomalies.push({
          field,
          fieldLabel,
          type: 'zero_followers_with_data',
          severity: 'warning',
          importValue: importVal,
          historicalMean: histValues.length > 0 ? computeStats(histValues)!.mean : null,
          historicalMax: histValues.length > 0 ? computeStats(histValues)!.max : null,
          historicalMin: histValues.length > 0 ? computeStats(histValues)!.min : null,
          previousValue: previousPeriodValues?.[field] ?? null,
          deviationFactor: null,
          message: 'دنبال‌کننده صفر است ولی سایر آمار وجود دارد.',
        });
        continue;
      }
    }

    // ── No historical data: skip statistical checks ────────────────────
    if (histValues.length < MIN_HISTORY_FOR_ZSCORE) continue;

    const stats = computeStats(histValues);
    if (!stats) continue;

    // ── Z-Score Detection ──────────────────────────────────────────────
    const z = zScore(importVal, stats);
    const absZ = Math.abs(z);

    if (absZ > Z_THRESHOLD && stats.stdDev > 0) {
      const severity: AnomalySeverity = absZ > 5 ? 'critical' : 'warning';
      const direction = z > 0 ? 'high' : 'low';
      const type: AnomalyType = direction === 'high' ? 'value_too_high' : 'value_too_low';

      const ratioText = stats.mean > 0
        ? `${(importVal / stats.mean).toFixed(1)}x`
        : '';

      anomalies.push({
        field,
        fieldLabel,
        type,
        severity,
        importValue: importVal,
        historicalMean: Math.round(stats.mean),
        historicalMax: stats.max,
        historicalMin: stats.min,
        previousValue: previousPeriodValues?.[field] ?? null,
        deviationFactor: absZ,
        message: direction === 'high'
          ? `مقدار ${importVal} بیش از ${absZ.toFixed(1)} برابر انحراف معیار از میانگین تاریخی (${Math.round(stats.mean)}) بالاتر است${ratioText ? ` (${ratioText})` : ''}.`
          : `مقدار ${importVal} بیش از ${absZ.toFixed(1)} برابر انحراف معیار از میانگین تاریخی (${Math.round(stats.mean)}) پایین‌تر است${ratioText ? ` (${ratioText})` : ''}.`,
      });
      continue;
    }

    // ── Ratio Detection (fallback when stdDev is too small) ────────────
    if (stats.mean > 0) {
      const ratio = importVal / stats.mean;
      if (ratio > HIGH_MULTIPLIER) {
        anomalies.push({
          field,
          fieldLabel,
          type: 'value_too_high',
          severity: 'warning',
          importValue: importVal,
          historicalMean: Math.round(stats.mean),
          historicalMax: stats.max,
          historicalMin: stats.min,
          previousValue: previousPeriodValues?.[field] ?? null,
          deviationFactor: ratio,
          message: `مقدار ${importVal} بیش از ${ratio.toFixed(1)} برابر میانگین تاریخی (${Math.round(stats.mean)}) است.`,
        });
      } else if (ratio < 1 / LOW_MULTIPLIER && importVal > 0) {
        anomalies.push({
          field,
          fieldLabel,
          type: 'value_too_low',
          severity: 'info',
          importValue: importVal,
          historicalMean: Math.round(stats.mean),
          historicalMax: stats.max,
          historicalMin: stats.min,
          previousValue: previousPeriodValues?.[field] ?? null,
          deviationFactor: 1 / ratio,
          message: `مقدار ${importVal} کمتر از ${((1 / ratio)).toFixed(1)} برابر میانگین تاریخی (${Math.round(stats.mean)}) است.`,
        });
      }
    }
  }

  // ── Spike/Drop Detection (compare to previous period) ──────────────
  if (previousPeriodValues) {
    for (const field of METRIC_FIELDS_TO_CHECK) {
      const importVal = importValues[field];
      const prevVal = previousPeriodValues[field];
      if (
        importVal === null || importVal === undefined ||
        prevVal === null || prevVal === undefined
      ) continue;
      if (prevVal <= 0 || importVal <= 0) continue;

      const ratio = importVal / prevVal;
      const fieldSpec = SOCIAL_METRIC_FIELDS[field];
      const fieldLabel = fieldSpec?.label ?? field;

      // Skip if already flagged by z-score
      const alreadyFlagged = anomalies.some((a) => a.field === field);
      if (alreadyFlagged) continue;

      if (ratio > SPIKE_RATIO) {
        anomalies.push({
          field,
          fieldLabel,
          type: 'sudden_spike',
          severity: 'warning',
          importValue: importVal,
          historicalMean: null,
          historicalMax: null,
          historicalMin: null,
          previousValue: prevVal,
          deviationFactor: ratio,
          message: `جهش ناگهانی: مقدار ${importVal} نسبت به دوره قبل (${prevVal}) بیش از ${ratio.toFixed(1)} برابر شده.`,
        });
      } else if (ratio < 1 / DROP_RATIO) {
        anomalies.push({
          field,
          fieldLabel,
          type: 'sudden_drop',
          severity: 'warning',
          importValue: importVal,
          historicalMean: null,
          historicalMax: null,
          historicalMin: null,
          previousValue: prevVal,
          deviationFactor: 1 / ratio,
          message: `کاهش ناگهانی: مقدار ${importVal} نسبت به دوره قبل (${prevVal}) بیش از ${((1 / ratio)).toFixed(1)} برابر کاهش یافته.`,
        });
      }
    }
  }

  return anomalies;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run anomaly detection on all rows in an import session.
 *
 * For each row:
 * 1. Find the matched account (if any)
 * 2. Fetch historical metrics for that account
 * 3. Compare import values against history
 * 4. Flag anomalies
 *
 * Returns a summary of all detected anomalies.
 */
export async function detectAnomaliesForSession(
  sessionId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<SessionAnomalySummary> {
  const sb = await getClient(options.supabase);

  // Fetch all rows for this session
  const { data: rows, error } = await sb
    .from('import_rows')
    .select('*')
    .eq('session_id', sessionId)
    .order('row_number');

  if (error) throw error;
  if (!rows || rows.length === 0) {
    return { totalFlagged: 0, critical: 0, warning: 0, info: 0, byField: {}, byType: {}, reports: [] };
  }

  // Collect all matched account IDs
  const accountIds = [
    ...new Set(
      rows
        .map((r) => r.matched_account_id)
        .filter((id): id is string => !!id),
    ),
  ];

  // Fetch historical metrics in bulk
  const historyMap = await fetchHistoricalMetrics(accountIds, sb);

  // Process each row
  const reports: RowAnomalyReport[] = [];
  let critical = 0;
  let warning = 0;
  let info = 0;
  const byField: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const row of rows) {
    const importRow = row as unknown as ImportRow;
    const nd = (importRow.normalized_data as Record<string, unknown>) ?? {};
    const source = (nd.values && typeof nd.values === 'object' && !Array.isArray(nd.values))
      ? nd.values as Record<string, unknown>
      : nd;

    // Extract numeric values from import row
    const importValues: Record<string, number | null> = {};
    for (const field of METRIC_FIELDS_TO_CHECK) {
      const v = source[field];
      if (v !== null && v !== undefined && v !== '') {
        importValues[field] = typeof v === 'number' ? v : Number(v);
      } else {
        importValues[field] = null;
      }
    }

    // Check if there are any values to check
    const hasValues = Object.values(importValues).some((v) => v !== null);
    if (!hasValues) continue;

    // Get historical data for this account
    const accountId = importRow.matched_account_id;
    const histMetrics = accountId ? (historyMap.get(accountId) ?? []) : [];

    // Get previous period values
    let previousPeriodValues: Record<string, number | null> | null = null;
    if (histMetrics.length > 0 && importRow.period_label) {
      // Find the period just before the import period
      const prevMetrics = histMetrics.filter(
        (m) => (m.period_label as string) < importRow.period_label!,
      );
      if (prevMetrics.length > 0) {
        const prev = prevMetrics[prevMetrics.length - 1];
        previousPeriodValues = {};
        for (const field of METRIC_FIELDS_TO_CHECK) {
          const v = prev[field];
          previousPeriodValues[field] = typeof v === 'number' ? v : null;
        }
      }
    }

    // Detect anomalies
    const anomalies = detectAnomaliesForRow(importValues, histMetrics, previousPeriodValues);

    if (anomalies.length > 0) {
      const worstSeverity = anomalies.some((a) => a.severity === 'critical')
        ? 'critical'
        : anomalies.some((a) => a.severity === 'warning')
          ? 'warning'
          : 'info';

      if (worstSeverity === 'critical') critical++;
      else if (worstSeverity === 'warning') warning++;
      else info++;

      for (const a of anomalies) {
        byField[a.field] = (byField[a.field] ?? 0) + 1;
        byType[a.type] = (byType[a.type] ?? 0) + 1;
      }

      reports.push({
        rowId: importRow.id,
        rowNumber: importRow.row_number,
        accountIdentifier: importRow.account_identifier ?? '',
        platform: importRow.platform ?? '',
        brand: importRow.brand,
        anomalies,
        overallSeverity: worstSeverity,
      });
    }
  }

  return {
    totalFlagged: reports.length,
    critical,
    warning,
    info,
    byField,
    byType,
    reports,
  };
}

/**
 * Detect anomalies for a single import row.
 * Used for real-time checking during row editing.
 */
export async function detectAnomaliesForRowById(
  rowId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<MetricAnomaly[]> {
  const sb = await getClient(options.supabase);

  const { data: row, error } = await sb
    .from('import_rows')
    .select('*')
    .eq('id', rowId)
    .single();

  if (error || !row) return [];

  const importRow = row as unknown as ImportRow;
  const nd = (importRow.normalized_data as Record<string, unknown>) ?? {};
  const source = (nd.values && typeof nd.values === 'object' && !Array.isArray(nd.values))
    ? nd.values as Record<string, unknown>
    : nd;

  const importValues: Record<string, number | null> = {};
  for (const field of METRIC_FIELDS_TO_CHECK) {
    const v = source[field];
    if (v !== null && v !== undefined && v !== '') {
      importValues[field] = typeof v === 'number' ? v : Number(v);
    } else {
      importValues[field] = null;
    }
  }

  const hasValues = Object.values(importValues).some((v) => v !== null);
  if (!hasValues) return [];

  const accountId = importRow.matched_account_id;
  const histMetrics = accountId
    ? (await fetchHistoricalMetrics([accountId], sb)).get(accountId) ?? []
    : [];

  let previousPeriodValues: Record<string, number | null> | null = null;
  if (histMetrics.length > 0 && importRow.period_label) {
    const prevMetrics = histMetrics.filter(
      (m) => (m.period_label as string) < importRow.period_label!,
    );
    if (prevMetrics.length > 0) {
      const prev = prevMetrics[prevMetrics.length - 1];
      previousPeriodValues = {};
      for (const field of METRIC_FIELDS_TO_CHECK) {
        const v = prev[field];
        previousPeriodValues[field] = typeof v === 'number' ? v : null;
      }
    }
  }

  return detectAnomaliesForRow(importValues, histMetrics, previousPeriodValues);
}
