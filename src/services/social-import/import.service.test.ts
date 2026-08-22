import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importSocialMetricsRows } from '@/services/social-import/import.service';
import type { SocialAccount } from '@/types/social';
import type { SocialMetricImportRow } from '@/services/social-import/types';

const accounts: SocialAccount[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    brand: 'ازما',
    platform: 'instagram',
    username: 'azmaa',
    displayName: 'ازما',
    url: null,
    externalId: null,
    status: 'active',
    createdAt: '',
    updatedAt: '',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
  },
];

/**
 * Minimal Supabase client mock that behaves like the real one.
 *
 * The service uses three chains:
 *   existingKeys:  .from('social_metrics').select(...).in('account_id', ids)
 *   recordSocialMetrics pre-check:
 *                  .from('social_metrics').select('*').eq(...).eq(...).eq(...).maybeSingle()
 *   recordSocialMetrics upsert:
 *                  .from('social_metrics').upsert(row, opts).select().single()
 */
function makeSupabaseMock() {
  const existingRows: Array<Record<string, unknown>> = [];
  const storedRows: Array<Record<string, unknown> | null> = [];

  const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const single = vi.fn(() =>
    Promise.resolve({ data: storedRows.pop() ?? null, error: null }),
  );
  const inFilter = vi.fn(() =>
    Promise.resolve({ data: existingRows, error: null }),
  );

  // Builder that lets each chained method return the next stage.
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: inFilter,
    upsert: vi.fn(() => ({ select: () => ({ single }) })),
    maybeSingle,
  };

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'social_metrics') return chain;
        throw new Error(`unexpected table ${table}`);
      }),
    },
    chain,
    maybeSingle,
    single,
    setExisting(rows: Array<Record<string, unknown>>) {
      existingRows.splice(0, existingRows.length, ...rows);
    },
    pushStored(row: Record<string, unknown> | null) {
      storedRows.push(row);
    },
  };
}

let mock: ReturnType<typeof makeSupabaseMock>;

beforeEach(() => {
  mock = makeSupabaseMock();
});

function row(
  overrides: Partial<SocialMetricImportRow> = {},
): SocialMetricImportRow {
  return {
    rowNumber: 1,
    platform: 'instagram',
    accountIdentifier: 'azmaa',
    period: 'monthly',
    periodLabel: '1405-05',
    values: { followers: 125000, views: 450000, likes: 12000 },
    errors: [],
    ...overrides,
  };
}

describe('importSocialMetricsRows', () => {
  it('imports valid rows and reports inserted count', async () => {
    mock.pushStored({ id: 1, followers: 125000 });
    const summary = await importSocialMetricsRows([row()], {
      accounts,
      supabase: mock.client as never,
    });
    expect(summary.total).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.rejected).toBe(0);
    expect(summary.duplicate).toBe(0);
  });

  it('rejects rows whose account is ambiguous or missing', async () => {
    mock.pushStored({ id: 1, followers: 100 });
    const summary = await importSocialMetricsRows(
      [
        row({ rowNumber: 1, accountIdentifier: 'nobody' }),
        row({ rowNumber: 2, accountIdentifier: 'azmaa' }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.rejected).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.errors[0].message).toContain('یافت نشد');
  });

  it('rejects rows with validation errors', async () => {
    const summary = await importSocialMetricsRows(
      [row({ errors: ['platform نامعتبر است.'] })],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.rejected).toBe(1);
    expect(summary.inserted).toBe(0);
  });

  it('counts an existing (account, period, label) as updated, not inserted', async () => {
    // The pre-check finds an existing key for this period.
    mock.setExisting([
      {
        account_id: accounts[0].id,
        period: 'monthly',
        period_label: '1405-05',
      },
    ]);
    mock.pushStored({ id: 1, followers: 100000 });
    const summary = await importSocialMetricsRows([row()], {
      accounts,
      supabase: mock.client as never,
    });
    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(0);
  });

  it('never reports duplicates (upsert + unique constraint)', async () => {
    mock.pushStored({ id: 1, followers: 100 });
    mock.pushStored({ id: 2, followers: 200 });
    const summary = await importSocialMetricsRows(
      [row({ rowNumber: 1 }), row({ rowNumber: 2 })],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.duplicate).toBe(0);
    expect(summary.inserted).toBe(2);
  });

  // ── resolvedAccountId security ─────────────────────────────────────

  it('accepts resolvedAccountId with same platform', async () => {
    mock.pushStored({ id: 1, followers: 125000 });
    const summary = await importSocialMetricsRows(
      [
        row({
          rowNumber: 1,
          platform: 'instagram',
          accountIdentifier: 'nobody',
          resolvedAccountId: accounts[0].id,
        }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.inserted).toBe(1);
    expect(summary.rejected).toBe(0);
  });

  it('rejects resolvedAccountId with different platform', async () => {
    const summary = await importSocialMetricsRows(
      [
        row({
          rowNumber: 1,
          platform: 'telegram',
          accountIdentifier: 'nobody',
          resolvedAccountId: accounts[0].id, // instagram account
        }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.rejected).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.errors[0].message).toContain('پلتفرم');
  });

  it('rejects nonexistent resolvedAccountId', async () => {
    const summary = await importSocialMetricsRows(
      [
        row({
          rowNumber: 1,
          platform: 'instagram',
          accountIdentifier: 'nobody',
          resolvedAccountId: 'nonexistent-id-000',
        }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.rejected).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.errors[0].message).toContain('پیدا نشد');
  });

  it('validates each row independently with different platforms', async () => {
    mock.pushStored({ id: 1, followers: 100 });
    mock.pushStored({ id: 2, followers: 200 });
    // Row 1: valid resolvedAccountId (instagram account for instagram row)
    // Row 2: invalid resolvedAccountId (instagram account for telegram row)
    const summary = await importSocialMetricsRows(
      [
        row({
          rowNumber: 1,
          platform: 'instagram',
          accountIdentifier: 'nobody',
          resolvedAccountId: accounts[0].id, // instagram account
        }),
        row({
          rowNumber: 2,
          platform: 'telegram',
          accountIdentifier: 'nobody',
          resolvedAccountId: accounts[0].id, // instagram account → wrong platform
        }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.inserted).toBe(1);
    expect(summary.rejected).toBe(1);
  });

  it('rejected resolvedAccountId row must not write social_metrics', async () => {
    // Only one row, with wrong platform → should be rejected, no write
    const summary = await importSocialMetricsRows(
      [
        row({
          rowNumber: 1,
          platform: 'telegram',
          accountIdentifier: 'nobody',
          resolvedAccountId: accounts[0].id, // instagram account
        }),
      ],
      { accounts, supabase: mock.client as never },
    );
    expect(summary.rejected).toBe(1);
    expect(summary.inserted).toBe(0);
    // upsert should never have been called
    expect(mock.chain.upsert).not.toHaveBeenCalled();
  });
});
