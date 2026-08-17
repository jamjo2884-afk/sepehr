import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  bulkEditSocialMetrics,
  SOCIAL_BULK_EDIT_MAX_RECORDS,
  type BulkEditInput,
  type BulkEditTarget,
} from '@/services/social-bulk-edit.service';
import type { SocialMetric, SocialMetricValues } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';

/**
 * Bulk-edit service tests.
 *
 * The service must edit EXISTING rows through the canonical
 * `updateSocialMetric` (injected here as a fake) and must NEVER touch
 * anything else: platform data comes from `social_accounts`, rows from
 * `social_metrics`, history goes only to `social_metric_edit_logs`. The
 * mock throws on any other table (e.g. `social_data_quality_reviews`) so
 * a regression is caught immediately.
 */

const PERIOD = 'monthly';
const LABEL = '1404-08';

interface MockMetricRow {
  id: number;
  account_id: string;
  period: string;
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

function makeRow(overrides: Partial<MockMetricRow> = {}): MockMetricRow {
  return {
    id: 1,
    account_id: 'acc-1',
    period: PERIOD,
    period_label: LABEL,
    followers: 100,
    following: 10,
    posts: 5,
    views: null,
    likes: 50,
    comments: 4,
    shares: 2,
    saves: null,
    reach: null,
    impressions: null,
    engagement_rate: null,
    story_views: null,
    channel_members: null,
    retweets: null,
    subscribers: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSupabaseMock(
  options: {
    accounts?: Array<{ id: string; platform: SocialPlatform }>;
    metrics?: MockMetricRow[];
    failHistory?: boolean;
  } = {},
) {
  const accounts = options.accounts ?? [
    { id: 'acc-1', platform: 'instagram' as SocialPlatform },
    { id: 'acc-2', platform: 'telegram' as SocialPlatform },
  ];
  const metrics = options.metrics ?? [makeRow()];
  const history: Array<Record<string, unknown>> = [];
  const tablesTouched: string[] = [];

  const from = vi.fn((table: string) => {
    tablesTouched.push(table);
    if (table === 'social_accounts') {
      return {
        select: () => ({
          in: (_col: string, values: string[]) =>
            Promise.resolve({
              data: accounts.filter((a) => values.includes(a.id)),
              error: null,
            }),
        }),
      };
    }
    if (table === 'social_metrics') {
      return {
        select: () => {
          const filters: Array<{
            col: string;
            kind: 'in' | 'eq';
            value: unknown;
          }> = [];
          const apply = () =>
            metrics.filter((m) =>
              filters.every((f) =>
                f.kind === 'in'
                  ? (f.value as unknown[]).includes(
                      m[f.col as keyof MockMetricRow],
                    )
                  : (m as unknown as Record<string, unknown>)[f.col] ===
                    f.value,
              ),
            );
          return {
            in: (col: string, values: unknown[]) => {
              filters.push({ col, kind: 'in', value: values });
              return {
                eq: (c: string, v: unknown) => {
                  filters.push({ col: c, kind: 'eq', value: v });
                  return {
                    eq: (c2: string, v2: unknown) => {
                      filters.push({ col: c2, kind: 'eq', value: v2 });
                      return Promise.resolve({ data: apply(), error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    }
    if (table === 'social_metric_edit_logs') {
      return {
        insert: vi.fn((rows: unknown) => {
          const list = Array.isArray(rows) ? rows : [rows];
          if (options.failHistory) {
            return Promise.resolve({ data: null, error: new Error('db down') });
          }
          history.push(...(list as Array<Record<string, unknown>>));
          return Promise.resolve({ data: list, error: null });
        }),
      };
    }
    throw new Error(`bulk-edit service touched unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    history,
    tablesTouched,
  };
}

function fakeUpdateMetric(options: { conflictIds?: Set<number> } = {}) {
  const calls: Array<{
    metricId: number | string;
    values: SocialMetricValues;
    options?: { expectedUpdatedAt?: string | null };
  }> = [];
  const impl = async (
    metricId: number | string,
    values: SocialMetricValues,
    opts?: { expectedUpdatedAt?: string | null },
  ): Promise<SocialMetric | null> => {
    calls.push({ metricId, values, options: opts });
    if (options.conflictIds?.has(Number(metricId))) return null;
    return { id: metricId } as unknown as SocialMetric;
  };
  return { impl, calls };
}

function target(
  accountId: string,
  updatedAt = '2026-08-01T00:00:00.000Z',
): BulkEditTarget {
  return { accountId, expectedUpdatedAt: updatedAt };
}

function input(
  targets: BulkEditTarget[],
  values: SocialMetricValues,
): BulkEditInput {
  return { period: PERIOD, periodLabel: LABEL, targets, values };
}

async function run(
  targets: BulkEditTarget[],
  values: SocialMetricValues,
  mock: ReturnType<typeof makeSupabaseMock>,
  update: ReturnType<typeof fakeUpdateMetric>,
) {
  return bulkEditSocialMetrics(input(targets, values), {
    supabase: mock.supabase,
    updateMetric: update.impl,
  });
}

describe('bulkEditSocialMetrics — editing semantics', () => {
  it('edits one metric', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ id: 7 })] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { followers: 200 },
      mock,
      update,
    );

    expect(summary.total).toBe(1);
    expect(summary.success).toBe(1);
    expect(summary.rows[0]).toMatchObject({
      accountId: 'acc-1',
      metricId: 7,
      status: 'success',
      changedFields: ['followers'],
    });
    expect(update.calls).toEqual([
      {
        metricId: 7,
        values: { followers: 200 },
        options: { expectedUpdatedAt: '2026-08-01T00:00:00.000Z' },
      },
    ]);
  });

  it('edits multiple metrics in one operation', async () => {
    const mock = makeSupabaseMock({
      metrics: [
        makeRow({ id: 1, account_id: 'acc-1' }),
        makeRow({ id: 2, account_id: 'acc-2', followers: 200 }),
      ],
    });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1'), target('acc-2')],
      { followers: 999 },
      mock,
      update,
    );

    expect(summary.success).toBe(2);
    expect(summary.rows.map((r) => r.metricId)).toEqual([1, 2]);
    expect(update.calls).toHaveLength(2);
  });

  it('updates only the requested fields (partial update)', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { followers: 150 }, mock, update);

    expect(update.calls[0].values).toEqual({ followers: 150 });
    // likes must not be part of the update payload.
    expect(Object.keys(update.calls[0].values)).not.toContain('likes');
  });

  it('writes an explicit zero', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ followers: 10 })] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { followers: 0 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('success');
    expect(update.calls[0].values).toEqual({ followers: 0 });
    expect(mock.history[0]).toMatchObject({
      field: 'followers',
      old_value: 10,
      new_value: 0,
    });
  });

  it('clears a nullable field with NULL (never 0)', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ posts: 5 })] });
    const update = fakeUpdateMetric();
    const summary = await run([target('acc-1')], { posts: null }, mock, update);

    expect(summary.rows[0].status).toBe('success');
    expect(update.calls[0].values).toEqual({ posts: null });
    expect(mock.history[0]).toMatchObject({
      field: 'posts',
      old_value: 5,
      new_value: null,
    });
  });

  it('skips a field whose value did not change (no update, no history)', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ followers: 100 })] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { followers: 100 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('success');
    expect(summary.rows[0].changedFields).toEqual([]);
    expect(update.calls).toHaveLength(0);
    expect(mock.history).toHaveLength(0);
  });

  it('rejects clearing followers (NOT NULL schema)', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { followers: null },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('rejected');
    expect(summary.rows[0].message).toBe('این فیلد نمی‌تواند خالی باشد.');
    expect(update.calls).toHaveLength(0);
  });

  it('rejects an engagement rate above 100', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { engagementRate: 150 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('rejected');
    expect(summary.rows[0].message).toContain('نرخ تعامل');
    expect(update.calls).toHaveLength(0);
  });

  it('accepts a valid engagement rate', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { engagementRate: 12.5 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('success');
    expect(update.calls[0].values).toEqual({ engagementRate: 12.5 });
  });

  it('rejects negative values', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    const summary = await run([target('acc-1')], { likes: -5 }, mock, update);

    expect(summary.rows[0].status).toBe('rejected');
    expect(summary.rows[0].message).toContain('منفی');
    expect(update.calls).toHaveLength(0);
  });
});

describe('bulkEditSocialMetrics — platform safety', () => {
  it('accepts a platform-specific field on the right platform', async () => {
    const mock = makeSupabaseMock({
      metrics: [makeRow({ id: 2, account_id: 'acc-2', channel_members: 40 })],
    });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-2')],
      { channelMembers: 55 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('success');
    expect(update.calls[0].values).toEqual({ channelMembers: 55 });
  });

  it('rejects a platform-specific field on the wrong platform', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] }); // acc-1 = instagram
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { channelMembers: 5 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('rejected');
    expect(summary.rows[0].message).toContain('مجاز نیست');
    expect(update.calls).toHaveLength(0);
  });

  it('never touches review records', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow()] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { followers: 200 }, mock, update);

    expect(mock.tablesTouched).not.toContain('social_data_quality_reviews');
  });
});

describe('bulkEditSocialMetrics — concurrency', () => {
  it('passes the expected updated_at to the canonical update', async () => {
    const mock = makeSupabaseMock({
      metrics: [makeRow({ updated_at: '2026-08-05T10:00:00.000Z' })],
    });
    const update = fakeUpdateMetric();
    await run(
      [target('acc-1', '2026-08-05T10:00:00.000Z')],
      { followers: 200 },
      mock,
      update,
    );

    expect(update.calls[0].options?.expectedUpdatedAt).toBe(
      '2026-08-05T10:00:00.000Z',
    );
  });

  it('reports a conflict when the row changed after preview', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ id: 9 })] });
    const update = fakeUpdateMetric({ conflictIds: new Set([9]) });
    const summary = await run(
      [target('acc-1')],
      { followers: 200 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('conflict');
    expect(summary.rows[0].message).toContain('فرآیند دیگری');
    expect(mock.history).toHaveLength(0);
  });
});

describe('bulkEditSocialMetrics — operation limits', () => {
  it('rejects more than 500 records before mutating anything', async () => {
    const mock = makeSupabaseMock({ metrics: [] });
    const update = fakeUpdateMetric();
    const targets = Array.from(
      { length: SOCIAL_BULK_EDIT_MAX_RECORDS + 1 },
      (_, i) => target(`acc-${i}`),
    );
    await expect(run(targets, { followers: 1 }, mock, update)).rejects.toThrow(
      'حداکثر',
    );
    expect(update.calls).toHaveLength(0);
    expect(mock.history).toHaveLength(0);
  });
});

describe('bulkEditSocialMetrics — missing records & partial failure', () => {
  it('rejects a target with no matching metric row', async () => {
    const mock = makeSupabaseMock({
      metrics: [makeRow({ account_id: 'acc-1' })],
    });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-2')],
      { followers: 1 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('rejected');
    expect(summary.rows[0].metricId).toBeNull();
    expect(summary.rows[0].message).toBe('رکورد آماری پیدا نشد.');
    expect(update.calls).toHaveLength(0);
  });

  it('reports every row individually on partial failure', async () => {
    const mock = makeSupabaseMock({
      metrics: [
        makeRow({ id: 1, account_id: 'acc-1' }),
        makeRow({ id: 2, account_id: 'acc-2' }),
      ],
      accounts: [
        { id: 'acc-1', platform: 'instagram' },
        { id: 'acc-2', platform: 'telegram' },
        { id: 'acc-3', platform: 'instagram' },
      ],
    });
    const update = fakeUpdateMetric({ conflictIds: new Set([2]) });
    const summary = await run(
      [
        target('acc-1'),
        target('acc-2'),
        target('acc-3', '2026-08-01T00:00:00.000Z'),
      ],
      { followers: 500 },
      mock,
      update,
    );

    expect(summary.total).toBe(3);
    expect(summary.success).toBe(1);
    expect(summary.conflict).toBe(1);
    expect(summary.rejected).toBe(1);
    // acc-1 → success, acc-2 → conflict (changed after preview),
    // acc-3 → rejected (no row exists for it).
    expect(summary.rows.map((r) => r.status).sort()).toEqual([
      'conflict',
      'rejected',
      'success',
    ]);
    expect(summary.rows).toHaveLength(3);
  });

  it('leaves metric data unchanged when validation fails', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ likes: 50 })] });
    const update = fakeUpdateMetric();
    const summary = await run([target('acc-1')], { likes: -1 }, mock, update);

    expect(summary.rows[0].status).toBe('rejected');
    expect(update.calls).toHaveLength(0);
    expect(mock.history).toHaveLength(0);
    // The stored row is untouched (mock rows are the source of truth).
    expect(mock.tablesTouched).toContain('social_metrics');
  });
});

describe('bulkEditSocialMetrics — history', () => {
  it('writes field-level history when a value changes (number → number)', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ followers: 10 })] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { followers: 20 }, mock, update);

    expect(mock.history).toHaveLength(1);
    expect(mock.history[0]).toMatchObject({
      metric_id: 1,
      account_id: 'acc-1',
      period: PERIOD,
      period_label: LABEL,
      field: 'followers',
      old_value: 10,
      new_value: 20,
      source: 'bulk_edit',
      edited_by: null,
    });
  });

  it('writes history for NULL → number', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ posts: null })] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { posts: 5 }, mock, update);

    expect(mock.history).toHaveLength(1);
    expect(mock.history[0]).toMatchObject({
      field: 'posts',
      old_value: null,
      new_value: 5,
    });
  });

  it('writes history for number → NULL', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ posts: 5 })] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { posts: null }, mock, update);

    expect(mock.history).toHaveLength(1);
    expect(mock.history[0]).toMatchObject({
      field: 'posts',
      old_value: 5,
      new_value: null,
    });
  });

  it('creates one history row per changed field', async () => {
    const mock = makeSupabaseMock({
      metrics: [makeRow({ followers: 100, likes: 50, posts: 5 })],
    });
    const update = fakeUpdateMetric();
    await run(
      [target('acc-1')],
      { followers: 111, likes: 60, posts: 6 },
      mock,
      update,
    );

    expect(mock.history).toHaveLength(3);
    expect(mock.history.map((h) => h.field).sort()).toEqual([
      'followers',
      'likes',
      'posts',
    ]);
  });

  it('writes no history for a no-op', async () => {
    const mock = makeSupabaseMock({ metrics: [makeRow({ followers: 100 })] });
    const update = fakeUpdateMetric();
    await run([target('acc-1')], { followers: 100 }, mock, update);

    expect(mock.history).toHaveLength(0);
  });

  it('surfaces a history-write failure without hiding the successful update', async () => {
    const mock = makeSupabaseMock({
      metrics: [makeRow({ followers: 10 })],
      failHistory: true,
    });
    const update = fakeUpdateMetric();
    const summary = await run(
      [target('acc-1')],
      { followers: 20 },
      mock,
      update,
    );

    expect(summary.rows[0].status).toBe('success');
    expect(summary.rows[0].historyFailed).toBe(true);
    expect(summary.rows[0].message).toContain('تاریخچه');
    expect(summary.historyWarnings).toBe(1);
    // The metric update itself still went through the canonical path.
    expect(update.calls).toHaveLength(1);
  });
});
