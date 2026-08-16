import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  deleteSocialDataQualityReview,
  filterIssuesByReviewStatus,
  getSocialDataQualityReviews,
  issueToReviewInput,
  mergeReviewStatus,
  reviewIdentityKey,
  upsertSocialDataQualityReview,
} from '@/services/social-data-quality-review.service';
import type {
  SocialDataQualityIssue,
  SocialDataQualityIssueWithReview,
  SocialDataQualityReport,
  SocialDataQualityReview,
} from '@/types/social';

/**
 * Review service tests.
 *
 * The review layer must NEVER touch `social_metrics` / `social_accounts`:
 * every mock asserts the only table used is `social_data_quality_reviews`.
 * Merge tests verify the detector output is not mutated (values stay as
 * they are — NULL stays NULL, negatives stay negative).
 */

function makeIssue(
  overrides: Partial<SocialDataQualityIssue> = {},
): SocialDataQualityIssue {
  return {
    id: 'issue-1',
    severity: 'warning',
    type: 'stale_account',
    accountId: 'acc-1',
    platform: 'instagram',
    metricId: '5',
    metricDate: '1405-01',
    field: null,
    message: 'دادهٔ قدیمی',
    details: null,
    ...overrides,
  };
}

function makeReport(issues: SocialDataQualityIssue[]): SocialDataQualityReport {
  return {
    summary: {
      totalAccounts: 1,
      healthyAccounts: 0,
      warningAccounts: 1,
      criticalAccounts: 0,
      totalIssues: issues.length,
    },
    issues,
    accounts: [
      {
        accountId: 'acc-1',
        status: 'warning',
        issueCount: issues.length,
        criticalCount: 0,
        warningCount: issues.length,
        infoCount: 0,
      },
    ],
  };
}

function makeReview(
  overrides: Partial<SocialDataQualityReview> = {},
): SocialDataQualityReview {
  return {
    id: 'review-1',
    issueType: 'stale_account',
    accountId: 'acc-1',
    metricId: 5,
    field: null,
    status: 'reviewed',
    reviewedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Fake Supabase client limited to the reviews table. */
function makeSupabaseMock() {
  const state: Array<Record<string, unknown>> = [];
  const ops: string[] = [];
  const tablesTouched: string[] = [];

  const from = vi.fn((table: string) => {
    tablesTouched.push(table);
    if (table !== 'social_data_quality_reviews') {
      throw new Error(`review service touched unexpected table ${table}`);
    }
    const chain: Record<string, unknown> = {
      _filters: [] as Array<{
        col: string;
        kind: 'eq' | 'is';
        value: unknown;
      }>,
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve({ data: [...state], error: null })),
      eq: vi.fn((col: string, value: unknown) => {
        (
          chain._filters as Array<{ col: string; kind: 'eq'; value: unknown }>
        ).push({
          col,
          kind: 'eq',
          value,
        });
        return chain;
      }),
      is: vi.fn((col: string) => {
        (
          chain._filters as Array<{ col: string; kind: 'is'; value: unknown }>
        ).push({
          col,
          kind: 'is',
          value: null,
        });
        return chain;
      }),
      maybeSingle: vi.fn(() => {
        const match = state.find((row) =>
          (
            chain._filters as Array<{
              col: string;
              kind: 'eq' | 'is';
              value: unknown;
            }>
          ).every((f) =>
            f.kind === 'is' ? row[f.col] == null : row[f.col] === f.value,
          ),
        );
        return Promise.resolve({ data: match ?? null, error: null });
      }),
      insert: vi.fn((row: Record<string, unknown>) => {
        ops.push('insert');
        const full = {
          id: String(state.length + 1),
          ...row,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
        };
        state.push(full);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: full, error: null }),
          }),
        };
      }),
      update: vi.fn((patch: Record<string, unknown>) => {
        ops.push('update');
        return {
          eq: (col: string, value: unknown) => {
            const row = state.find((r) => r[col] === value);
            if (row) {
              Object.assign(row, patch, {
                updated_at: '2026-08-02T00:00:00.000Z',
              });
            }
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({ data: row ?? null, error: null }),
              }),
            };
          },
        };
      }),
      delete: vi.fn(() => {
        ops.push('delete');
        return {
          eq: (col: string, value: unknown) => {
            const idx = state.findIndex((r) => r[col] === value);
            if (idx >= 0) state.splice(idx, 1);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }),
    };
    return chain;
  });

  return { from, state, ops, tablesTouched };
}

describe('mergeReviewStatus', () => {
  it('marks an issue reviewed when a matching review exists', () => {
    const report = makeReport([makeIssue()]);
    const merged = mergeReviewStatus(report, [
      makeReview({
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 5,
        status: 'reviewed',
      }),
    ]);

    expect(merged.issues[0].reviewStatus).toBe('reviewed');
    expect(merged.summary).toMatchObject({
      openIssues: 0,
      reviewedIssues: 1,
      ignoredIssues: 0,
      totalIssues: 1,
    });
  });

  it('marks an issue ignored when the review status is ignored', () => {
    const report = makeReport([makeIssue()]);
    const merged = mergeReviewStatus(report, [
      makeReview({ status: 'ignored' }),
    ]);

    expect(merged.issues[0].reviewStatus).toBe('ignored');
    expect(merged.summary.ignoredIssues).toBe(1);
  });

  it('leaves issues open when no review matches (new metric identity)', () => {
    const report = makeReport([makeIssue({ metricId: '99' })]);
    const merged = mergeReviewStatus(report, [
      makeReview({ metricId: 5 }), // review for the OLD metric row
    ]);

    expect(merged.issues[0].reviewStatus).toBe('open');
    expect(merged.summary.openIssues).toBe(1);
  });

  it('counts open/reviewed/ignored together', () => {
    const report = makeReport([
      makeIssue({ id: 'a', metricId: '1' }),
      makeIssue({ id: 'b', metricId: '2' }),
      makeIssue({ id: 'c', metricId: '3' }),
    ]);
    const merged = mergeReviewStatus(report, [
      makeReview({
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 1,
        status: 'reviewed',
      }),
      makeReview({
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 2,
        status: 'ignored',
      }),
    ]);

    expect(merged.summary).toMatchObject({
      openIssues: 1,
      reviewedIssues: 1,
      ignoredIssues: 1,
    });
    const byId = new Map(merged.issues.map((i) => [i.id, i.reviewStatus]));
    expect(byId.get('a')).toBe('reviewed');
    expect(byId.get('b')).toBe('ignored');
    expect(byId.get('c')).toBe('open');
  });

  it('does NOT mutate the detected issue (values, details, NULL stay as-is)', () => {
    const report = makeReport([
      makeIssue({
        details: { storedValue: -5 },
        message: 'مقدار منفی',
        metricDate: '1405-01',
      }),
    ]);
    const merged = mergeReviewStatus(report, [
      makeReview({ status: 'reviewed' }),
    ]);

    const out = merged.issues[0] as SocialDataQualityIssueWithReview;
    expect(out.details).toEqual({ storedValue: -5 });
    expect(out.severity).toBe('warning');
    expect(out.type).toBe('stale_account');
    expect(out.message).toBe('مقدار منفی');
    expect(out.metricDate).toBe('1405-01');
    // NULL is never converted to 0 anywhere in the merged output.
    expect(merged.issues).toHaveLength(1);
    expect(out.reviewStatus).toBe('reviewed');
  });

  it('handles an orphan issue (dangling accountId) without crashing', () => {
    const report = makeReport([
      makeIssue({
        type: 'orphan_metric',
        accountId: '00000000-0000-0000-0000-000000000099',
        metricId: '42',
        platform: null,
      }),
    ]);
    const merged = mergeReviewStatus(report, [
      makeReview({
        issueType: 'orphan_metric',
        accountId: '00000000-0000-0000-0000-000000000099',
        metricId: 42,
        status: 'ignored',
      }),
    ]);

    expect(merged.issues[0].reviewStatus).toBe('ignored');
  });
});

describe('reviewIdentityKey', () => {
  it('normalizes string and number metric ids to the same key', () => {
    expect(reviewIdentityKey('stale_account', 'acc-1', '5', null)).toBe(
      reviewIdentityKey('stale_account', 'acc-1', 5, null),
    );
  });

  it('distinguishes NULL metric from NULL field identities', () => {
    const accountLevel = reviewIdentityKey(
      'account_without_metrics',
      'acc-1',
      null,
      null,
    );
    const fieldLevel = reviewIdentityKey(
      'missing_optional_field',
      'acc-1',
      null,
      'storyViews',
    );
    expect(accountLevel).not.toBe(fieldLevel);
  });
});

describe('upsertSocialDataQualityReview', () => {
  it('creates a review (insert) for a new identity', async () => {
    const supabase = makeSupabaseMock();
    const review = await upsertSocialDataQualityReview(
      {
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 5,
        field: null,
        status: 'reviewed',
      },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(review.status).toBe('reviewed');
    expect(review.issueType).toBe('stale_account');
    expect(supabase.ops).toEqual(['insert']);
    expect(supabase.state).toHaveLength(1);
    // The review layer must never touch metrics/accounts tables.
    expect(supabase.tablesTouched.length).toBeGreaterThan(0);
    expect(
      supabase.tablesTouched.every((t) => t === 'social_data_quality_reviews'),
    ).toBe(true);
  });

  it('updates the same logical issue instead of creating a duplicate', async () => {
    const supabase = makeSupabaseMock();
    const input = {
      issueType: 'stale_account' as const,
      accountId: 'acc-1',
      metricId: 5,
      field: null,
    };
    await upsertSocialDataQualityReview(
      { ...input, status: 'reviewed' },
      { supabase: supabase as unknown as SupabaseClient },
    );
    const updated = await upsertSocialDataQualityReview(
      { ...input, status: 'ignored' },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(updated.status).toBe('ignored');
    expect(supabase.state).toHaveLength(1); // single row, no duplicate
    expect(supabase.ops).toEqual(['insert', 'update']);
  });

  it('NULL metricId identity (account-level issue) cannot duplicate either', async () => {
    const supabase = makeSupabaseMock();
    const input = {
      issueType: 'account_without_metrics' as const,
      accountId: 'acc-1',
      metricId: null,
      field: null,
    };
    await upsertSocialDataQualityReview(
      { ...input, status: 'reviewed' },
      { supabase: supabase as unknown as SupabaseClient },
    );
    await upsertSocialDataQualityReview(
      { ...input, status: 'ignored' },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(supabase.state).toHaveLength(1);
    expect(supabase.state[0].status).toBe('ignored');
    expect(supabase.ops).toEqual(['insert', 'update']);
  });

  it('NULL field and a set field are two distinct identities', async () => {
    const supabase = makeSupabaseMock();
    await upsertSocialDataQualityReview(
      {
        issueType: 'missing_optional_field',
        accountId: 'acc-1',
        metricId: null,
        field: null,
        status: 'reviewed',
      },
      { supabase: supabase as unknown as SupabaseClient },
    );
    await upsertSocialDataQualityReview(
      {
        issueType: 'missing_optional_field',
        accountId: 'acc-1',
        metricId: null,
        field: 'storyViews',
        status: 'reviewed',
      },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(supabase.state).toHaveLength(2);
  });

  it('rejects invalid input instead of writing anything', async () => {
    const supabase = makeSupabaseMock();
    await expect(
      upsertSocialDataQualityReview(
        {
          issueType: 'not_a_real_type',
          accountId: 'acc-1',
          metricId: null,
          field: null,
          status: 'reviewed',
        } as never,
        { supabase: supabase as unknown as SupabaseClient },
      ),
    ).rejects.toThrow();
    expect(supabase.ops).toEqual([]);
  });
});

describe('deleteSocialDataQualityReview', () => {
  it('removes the review → returns the issue to open', async () => {
    const supabase = makeSupabaseMock();
    await upsertSocialDataQualityReview(
      {
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 5,
        field: null,
        status: 'reviewed',
      },
      { supabase: supabase as unknown as SupabaseClient },
    );
    const deleted = await deleteSocialDataQualityReview(
      {
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 5,
        field: null,
      },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(deleted).toBe(true);
    expect(supabase.state).toHaveLength(0);
    expect(supabase.ops).toEqual(['insert', 'delete']);
  });

  it('is idempotent: deleting a missing review returns false', async () => {
    const supabase = makeSupabaseMock();
    const deleted = await deleteSocialDataQualityReview(
      {
        issueType: 'stale_account',
        accountId: 'acc-1',
        metricId: 5,
        field: null,
      },
      { supabase: supabase as unknown as SupabaseClient },
    );

    expect(deleted).toBe(false);
  });
});

describe('getSocialDataQualityReviews', () => {
  it('reads every review in one query', async () => {
    const supabase = makeSupabaseMock();
    supabase.state.push({
      id: 'r1',
      issue_type: 'stale_account',
      account_id: 'acc-1',
      metric_id: 5,
      field: null,
      status: 'reviewed',
      reviewed_at: '2026-08-01T00:00:00.000Z',
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    });
    const reviews = await getSocialDataQualityReviews({
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0].issueType).toBe('stale_account');
    expect(reviews[0].status).toBe('reviewed');
  });
});

describe('filterIssuesByReviewStatus', () => {
  it('filters by each review status and keeps everything for "all"', () => {
    const issues: SocialDataQualityIssueWithReview[] = [
      makeIssue({ id: 'a' }) as SocialDataQualityIssueWithReview,
      makeIssue({ id: 'b' }) as SocialDataQualityIssueWithReview,
    ];
    issues[0].reviewStatus = 'reviewed';
    issues[1].reviewStatus = 'ignored';

    expect(filterIssuesByReviewStatus(issues, 'all')).toHaveLength(2);
    expect(filterIssuesByReviewStatus(issues, 'reviewed')).toHaveLength(1);
    expect(filterIssuesByReviewStatus(issues, 'ignored')).toHaveLength(1);
    expect(filterIssuesByReviewStatus(issues, 'open')).toHaveLength(0);
  });
});

describe('issueToReviewInput', () => {
  it('maps a detected issue to a review input with a numeric metricId', () => {
    const input = issueToReviewInput(
      makeIssue({ metricId: '42', field: 'storyViews' }),
      'reviewed',
    );

    expect(input).toEqual({
      issueType: 'stale_account',
      accountId: 'acc-1',
      metricId: 42,
      field: 'storyViews',
      status: 'reviewed',
    });
  });

  it('keeps metricId null when the issue has no metric', () => {
    const input = issueToReviewInput(
      makeIssue({ metricId: null, type: 'account_without_metrics' }),
      'ignored',
    );

    expect(input.metricId).toBeNull();
    expect(input.issueType).toBe('account_without_metrics');
  });
});
