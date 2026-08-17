import type { SupabaseClient } from '@supabase/supabase-js';
import {
  METRIC_COLUMN_BY_KEY,
  updateSocialMetric,
} from '@/services/social.service';
import { validateNormalizedMetricValue } from '@/services/social-sync.service';
import {
  PLATFORM_METRIC_FIELDS,
  SOCIAL_METRIC_FIELDS,
  type SocialMetricFieldKey,
} from '@/constants/social-fields';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import type {
  SocialMetric,
  SocialMetricPeriod,
  SocialMetricValues,
} from '@/types/social';

/**
 * Bulk edit service (PHASE 17).
 *
 * Edits EXISTING `social_metrics` rows only — it never creates rows
 * (creation stays with manual entry / bulk entry / sync). Every row is
 * committed through `updateSocialMetric` (the same canonical service the
 * manual edit form uses), so the column mapping, NULL semantics and
 * `followers` NOT NULL fallback are never duplicated here.
 *
 * Per target (account + period + label):
 *   1. resolve the concrete row by `social_metrics.id`
 *   2. validate platform compatibility (PLATFORM_METRIC_FIELDS)
 *   3. validate values (validateNormalizedMetricValue, shared with sync
 *      and data quality)
 *   4. compute actual changes (old !== new) — no-op fields are skipped
 *   5. compare-and-swap update: id + expected updated_at
 *   6. write field-level history rows (only when a value actually changed)
 *
 * Row-by-row processing, no transaction (there is no RPC/transaction
 * architecture in this project): every row returns its own status so a
 * partial failure is always reported, never silently swallowed.
 */

/** Hard cap per operation — matches the PostgREST 1000-row response limit
 * with headroom (500 rows × 1 update + 1 history insert each). */
export const SOCIAL_BULK_EDIT_MAX_RECORDS = 500;

/** History `source` for every row written by this service. */
export const SOCIAL_BULK_EDIT_SOURCE = 'bulk_edit';

/** One target record: an account × period × period_label metric row. */
export interface BulkEditTarget {
  accountId: string;
  /** `updated_at` read at selection/preview time — optimistic lock. */
  expectedUpdatedAt: string;
}

export type BulkEditRowStatus = 'success' | 'rejected' | 'conflict' | 'error';

/** Row-level outcome of a bulk edit. */
export interface BulkEditRowResult {
  accountId: string;
  /** Resolved `social_metrics.id`, or null when the row was never found. */
  metricId: number | null;
  status: BulkEditRowStatus;
  /** Fields whose stored value actually changed (empty for no-ops). */
  changedFields: SocialMetricFieldKey[];
  /** True when the metric updated but writing history failed. */
  historyFailed: boolean;
  message: string | null;
}

/** Aggregate result returned to the client. */
export interface BulkEditSummary {
  total: number;
  success: number;
  rejected: number;
  conflict: number;
  error: number;
  historyWarnings: number;
  rows: BulkEditRowResult[];
}

export interface BulkEditInput {
  period: SocialMetricPeriod;
  periodLabel: string;
  targets: BulkEditTarget[];
  /** Only the fields to change: number = set, null = clear, absent = no change. */
  values: SocialMetricValues;
}

/** The metric value columns (snake_case) this service can touch. */
const VALUE_COLUMNS = Object.values(METRIC_COLUMN_BY_KEY);

/** snake_case row shape the resolver reads from `social_metrics`. */
interface ResolvedMetricRow {
  id: number;
  account_id: string;
  period: SocialMetricPeriod;
  period_label: string;
  followers: number;
  following: number | null;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  engagement_rate: number | null;
  story_views: number | null;
  channel_members: number | null;
  retweets: number | null;
  subscribers: number | null;
  updated_at: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function makeResult(
  accountId: string,
  metricId: number | null,
  status: BulkEditRowStatus,
  changedFields: SocialMetricFieldKey[],
  historyFailed: boolean,
  message: string | null,
): BulkEditRowResult {
  return { accountId, metricId, status, changedFields, historyFailed, message };
}

/**
 * Apply a bulk edit. `supabase` and `updateMetric` are injectable for
 * tests; by default the service uses the real client and the canonical
 * `updateSocialMetric`. Throws when the read step itself fails (the route
 * turns that into a 500) — never on per-row outcomes.
 */
export async function bulkEditSocialMetrics(
  input: BulkEditInput,
  options: {
    supabase?: SupabaseClient;
    updateMetric?: typeof updateSocialMetric;
  } = {},
): Promise<BulkEditSummary> {
  const supabase =
    options.supabase ?? (await import('@/lib/supabase')).supabase;
  const updateMetric = options.updateMetric ?? updateSocialMetric;

  const rows: BulkEditRowResult[] = [];
  if (input.targets.length === 0) {
    return {
      total: 0,
      success: 0,
      rejected: 0,
      conflict: 0,
      error: 0,
      historyWarnings: 0,
      rows,
    };
  }
  if (input.targets.length > SOCIAL_BULK_EDIT_MAX_RECORDS) {
    throw new Error(
      `حداکثر ${SOCIAL_BULK_EDIT_MAX_RECORDS} رکورد در هر عملیات مجاز است.`,
    );
  }

  const accountIds = [...new Set(input.targets.map((t) => t.accountId))];

  // 1. Account platforms — the source of truth for platform validation.
  const platformByAccount = new Map<string, SocialPlatform>();
  for (const ids of chunk(accountIds, 100)) {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('id, platform')
      .in('id', ids);
    if (error) throw error;
    for (const account of data ?? []) {
      platformByAccount.set(
        account.id as string,
        account.platform as SocialPlatform,
      );
    }
  }

  // 2. Resolve the concrete metric rows (UNIQUE(account_id, period,
  //    period_label) ⇒ at most one row per target).
  const rowByAccount = new Map<string, ResolvedMetricRow>();
  for (const ids of chunk(accountIds, 100)) {
    const { data, error } = await supabase
      .from('social_metrics')
      .select(
        `id, account_id, period, period_label, ${VALUE_COLUMNS.join(', ')}, updated_at` as string,
      )
      .in('account_id', ids)
      .eq('period', input.period)
      .eq('period_label', input.periodLabel);
    if (error) throw error;
    for (const metric of (data ?? []) as unknown as Array<
      Record<string, unknown>
    >) {
      rowByAccount.set(
        metric.account_id as string,
        metric as unknown as ResolvedMetricRow,
      );
    }
  }

  // 3. Per-target processing.
  for (const target of input.targets) {
    const metric = rowByAccount.get(target.accountId);
    if (!metric) {
      rows.push(
        makeResult(
          target.accountId,
          null,
          'rejected',
          [],
          false,
          'رکورد آماری پیدا نشد.',
        ),
      );
      continue;
    }
    const platform = platformByAccount.get(target.accountId);
    if (!platform) {
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'rejected',
          [],
          false,
          'حساب یافت نشد.',
        ),
      );
      continue;
    }

    // Field-level platform + value validation, computing the actual
    // changes (a field whose stored value already equals the new value is
    // not a change — it is skipped, so no update and no history).
    const changes: SocialMetricValues = {};
    let rejectedMessage: string | null = null;
    for (const key of Object.keys(input.values) as SocialMetricFieldKey[]) {
      const newValue = input.values[key] as number | null;
      if (!PLATFORM_METRIC_FIELDS[platform].includes(key)) {
        rejectedMessage = `فیلد «${SOCIAL_METRIC_FIELDS[key].label}» برای ${SOCIAL_PLATFORM_LABELS[platform]} مجاز نیست.`;
        break;
      }
      if (key === 'followers' && newValue === null) {
        // followers is NOT NULL in the schema — an explicit clear is a
        // validation error, never a silent 0.
        rejectedMessage = 'این فیلد نمی‌تواند خالی باشد.';
        break;
      }
      const valueError = validateNormalizedMetricValue(key, newValue);
      if (valueError) {
        rejectedMessage = valueError;
        break;
      }
      const column = METRIC_COLUMN_BY_KEY[key];
      const oldValue = metric[column as keyof ResolvedMetricRow] as
        number | null;
      if (oldValue === newValue) continue;
      changes[key] = newValue;
    }

    if (rejectedMessage) {
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'rejected',
          [],
          false,
          rejectedMessage,
        ),
      );
      continue;
    }

    const changedFields = Object.keys(changes) as SocialMetricFieldKey[];
    if (changedFields.length === 0) {
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'success',
          [],
          false,
          'بدون تغییر',
        ),
      );
      continue;
    }

    // 4. Compare-and-swap through the canonical update path. Null result =
    //    the row was changed or deleted after the preview — never overwrite.
    let updated: SocialMetric | null;
    try {
      updated = await updateMetric(metric.id, changes, {
        expectedUpdatedAt: target.expectedUpdatedAt,
      });
    } catch (err) {
      console.warn('[social-bulk-edit] Could not update a metric row.', err);
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'error',
          [],
          false,
          'خطای ناشناخته در به‌روزرسانی رکورد.',
        ),
      );
      continue;
    }
    if (!updated) {
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'conflict',
          [],
          false,
          'این رکورد پس از پیش‌نمایش توسط فرآیند دیگری تغییر کرده است.',
        ),
      );
      continue;
    }

    // 5. Field-level history — one row per field that actually changed,
    //    written in a single insert per metric. NULL is preserved as JSON
    //    null, never 0 or empty string.
    const historyRows = changedFields.map((fieldKey) => {
      const column = METRIC_COLUMN_BY_KEY[fieldKey];
      return {
        metric_id: metric.id,
        account_id: metric.account_id,
        period: metric.period,
        period_label: metric.period_label,
        field: fieldKey,
        old_value: metric[column as keyof ResolvedMetricRow] as number | null,
        new_value: changes[fieldKey] as number | null,
        edited_by: null,
        edited_at: new Date().toISOString(),
        source: SOCIAL_BULK_EDIT_SOURCE,
      };
    });
    const { error: historyError } = await supabase
      .from('social_metric_edit_logs')
      .insert(historyRows);
    if (historyError) {
      // The metric IS updated, but the audit trail failed — surface it.
      console.warn(
        '[social-bulk-edit] Could not write edit history.',
        historyError,
      );
      rows.push(
        makeResult(
          target.accountId,
          metric.id,
          'success',
          changedFields,
          true,
          'متریک به‌روزرسانی شد اما ثبت تاریخچه انجام نشد.',
        ),
      );
      continue;
    }

    rows.push(
      makeResult(
        target.accountId,
        metric.id,
        'success',
        changedFields,
        false,
        null,
      ),
    );
  }

  const success = rows.filter((r) => r.status === 'success').length;
  const rejected = rows.filter((r) => r.status === 'rejected').length;
  const conflict = rows.filter((r) => r.status === 'conflict').length;
  const error = rows.filter((r) => r.status === 'error').length;
  const historyWarnings = rows.filter((r) => r.historyFailed).length;

  return {
    total: rows.length,
    success,
    rejected,
    conflict,
    error,
    historyWarnings,
    rows,
  };
}
