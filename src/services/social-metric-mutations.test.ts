import { beforeEach, describe, expect, it, vi } from 'vitest';
import { periodLabelForDate } from '@/services/social-metrics';
import {
  deleteSocialMetric,
  updateSocialMetric,
} from '@/services/social.service';
import type { SocialMetricValues } from '@/types/social';

/**
 * Tests for the metric mutations added for manual data fixes:
 *
 * - `deleteSocialMetric` — removes a row (with optional optimistic
 *   concurrency) and reports whether anything was actually deleted.
 * - `updateSocialMetric` with `identity` — lets an edit move the row's
 *   (account, period, period_label) key instead of only changing values,
 *   recomputing the label/range through the same canonical helpers as
 *   `recordSocialMetrics` and rejecting duplicate keys before the write.
 *
 * `@/lib/supabase` is mocked with an in-memory fake (same pattern as the
 * sync-flow tests).
 */

const { state } = vi.hoisted(() => ({
  state: {
    current: null as Record<string, unknown> | null,
    clash: null as Record<string, unknown> | null,
    updated: null as Record<string, unknown> | null,
    deletedCount: 0,
    failError: false,
    updatePatches: [] as Array<Record<string, unknown>>,
    deleteFilters: [] as Array<{ col: string; val: unknown }>,
  },
}));

vi.mock('@/lib/supabase', () => {
  function chain(_table: string) {
    const filters: Array<{ col: string; val: unknown }> = [];
    const q: Record<string, (...a: unknown[]) => unknown> = {
      select: () => q,
      eq: (col: unknown, val: unknown) => {
        filters.push({ col: String(col), val });
        return q;
      },
      neq: (col: unknown, val: unknown) => {
        filters.push({ col: `neq:${String(col)}`, val });
        return q;
      },
    };
    q.maybeSingle = async () => {
      // The duplicate-guard query filters by account_id; the "current row"
      // read filters by id only.
      if (filters.some((f) => f.col === 'account_id')) {
        return { data: state.clash, error: null };
      }
      return { data: state.current, error: null };
    };
    q.update = (patch: unknown) => {
      state.updatePatches.push(patch as Record<string, unknown>);
      const upd: Record<string, (...a: unknown[]) => unknown> = {
        eq: () => upd,
        select: () => ({
          maybeSingle: async () => {
            if (state.failError) {
              return { data: null, error: { message: 'db error' } };
            }
            return { data: state.updated, error: null };
          },
        }),
      };
      return upd;
    };
    q.delete = () => {
      const del: Record<string, (...a: unknown[]) => unknown> = {
        eq: (col: unknown, val: unknown) => {
          state.deleteFilters.push({ col: String(col), val });
          return del;
        },
        select: async () => {
          if (state.failError) {
            return { data: null, error: { message: 'db error' } };
          }
          return {
            data: state.deletedCount > 0 ? [{ id: 1 }] : [],
            error: null,
          };
        },
      };
      return del;
    };
    return q;
  }
  return { supabase: { from: (t: string) => chain(t) } };
});

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    account_id: 'acc-1',
    period: 'monthly',
    period_label: '1405-01',
    period_start: '2026-03-21T00:00:00.000Z',
    period_end: '2026-04-20T00:00:00.000Z',
    followers: 100,
    following: null,
    posts: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    impressions: null,
    engagement_rate: null,
    story_views: null,
    channel_members: null,
    retweets: null,
    subscribers: null,
    created_at: '2026-08-14T09:30:00.000Z',
    updated_at: '2026-08-14T09:30:00.000Z',
    ...overrides,
  };
}

const VALUES: SocialMetricValues = { followers: 120 };

beforeEach(() => {
  state.current = null;
  state.clash = null;
  state.updated = null;
  state.deletedCount = 0;
  state.failError = false;
  state.updatePatches = [];
  state.deleteFilters = [];
});

describe('updateSocialMetric — identity (account/period/label) edits', () => {
  it('writes only values when no identity is provided', async () => {
    state.updated = row({ followers: 120 });
    const result = await updateSocialMetric(1, VALUES);
    expect(result).not.toBeNull();
    expect(state.updatePatches).toHaveLength(1);
    const patch = state.updatePatches[0];
    expect(patch.followers).toBe(120);
    expect(patch).not.toHaveProperty('period_label');
    expect(patch).not.toHaveProperty('period');
    expect(patch).not.toHaveProperty('account_id');
  });

  it('moves the month: recomputes period_label + range from the date', async () => {
    state.current = row();
    const date = new Date('2026-04-15T00:00:00Z'); // 1405-02
    state.updated = row({ period_label: periodLabelForDate(date, 'monthly') });
    const result = await updateSocialMetric(1, VALUES, {
      identity: { accountId: 'acc-1', period: 'monthly', date },
    });
    expect(result).not.toBeNull();
    const patch = state.updatePatches[0];
    expect(patch.period).toBe('monthly');
    expect(patch.period_label).toBe(periodLabelForDate(date, 'monthly'));
    expect(patch.period_start).toBeTruthy();
    expect(patch.period_end).toBeTruthy();
    expect(patch.followers).toBe(120);
  });

  it('rejects moving onto a key that already belongs to another row', async () => {
    state.current = row();
    state.clash = row({ id: 99 });
    const result = await updateSocialMetric(1, VALUES, {
      identity: { accountId: 'acc-1', period: 'monthly', date: new Date() },
    });
    expect(result).toBeNull();
    expect(state.updatePatches).toHaveLength(0);
  });

  it('returns null when the current row no longer exists', async () => {
    state.current = null;
    const result = await updateSocialMetric(1, VALUES, {
      identity: { accountId: 'acc-1', period: 'monthly', date: new Date() },
    });
    expect(result).toBeNull();
    expect(state.updatePatches).toHaveLength(0);
  });

  it('returns null when expected updated_at no longer matches', async () => {
    state.updated = null; // CAS miss — no row matched
    const result = await updateSocialMetric(1, VALUES, {
      expectedUpdatedAt: '2026-08-14T09:30:00.000Z',
    });
    expect(result).toBeNull();
  });
});

describe('deleteSocialMetric', () => {
  it('deletes the row and returns true', async () => {
    state.deletedCount = 1;
    const ok = await deleteSocialMetric(1);
    expect(ok).toBe(true);
    expect(state.deleteFilters.some((f) => f.col === 'id' && f.val === 1)).toBe(
      true,
    );
  });

  it('filters by expected updated_at for optimistic concurrency', async () => {
    state.deletedCount = 1;
    const ok = await deleteSocialMetric(1, {
      expectedUpdatedAt: '2026-08-14T09:30:00.000Z',
    });
    expect(ok).toBe(true);
    expect(
      state.deleteFilters.some(
        (f) => f.col === 'updated_at' && f.val === '2026-08-14T09:30:00.000Z',
      ),
    ).toBe(true);
  });

  it('returns false when nothing matched (concurrent change)', async () => {
    state.deletedCount = 0;
    const ok = await deleteSocialMetric(1, {
      expectedUpdatedAt: 'stale-timestamp',
    });
    expect(ok).toBe(false);
  });

  it('returns false on a database error', async () => {
    state.failError = true;
    const ok = await deleteSocialMetric(1);
    expect(ok).toBe(false);
  });
});
