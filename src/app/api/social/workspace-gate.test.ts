import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Workspace-gate regression tests for the dynamic-parameter social routes
 * that still use the legacy `requireAuth()` from @/lib/auth (session-only).
 *
 * The 2026-10-01 security fix requires every one of those handlers to call
 * `getCurrentWorkspace()` themselves and 403 when the caller has no workspace
 * membership. These tests pin that contract for a representative sample —
 * one per handler shape (GET by params, POST body, GET+PATCH+DELETE family).
 *
 * Note: a signed-in user WITHOUT a workspace membership gets 403 from the
 * workspace gate, NOT a silent pass-through to the service layer.
 */

let mockAuthUser: { id: string; email: string } | null = null;
let mockWorkspace: {
  userId: string;
  workspaceId: string;
  role: string;
} | null = null;

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => mockAuthUser),
  isSyntheticUser: vi.fn(
    (user: { id: string } | null | undefined) =>
      !!user && (user.id === 'demo-user-000' || user.id === 'guest-user-000'),
  ),
  // Legacy session-only requireAuth — resolves via the mocked getAuthUser.
  requireAuth: vi.fn(async () => {
    if (!mockAuthUser) {
      const { NextResponse: NR } = await import('next/server');
      return NR.json(
        { ok: false, error: 'احراز هویت لازم است.' },
        { status: 401 },
      );
    }
    return mockAuthUser;
  }),
}));

vi.mock('@/lib/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => mockWorkspace),
}));

vi.mock('@/lib/db', () => ({
  getSupabase: vi.fn(async () => {
    throw new Error('no db in test');
  }),
  isTableAvailable: vi.fn(async () => false),
}));

async function importRoute<T>(rel: string): Promise<T> {
  return (await import(rel)) as T;
}

type RouteModule = Record<
  string,
  (req: Request, ctx: { params: unknown }) => Promise<Response>
>;

describe('workspace gate on legacy-auth social routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = { id: 'u1', email: 'u1@test.com' };
    mockWorkspace = null;
  });

  const noMembership = () => {
    mockAuthUser = { id: 'u2', email: 'u2@test.com' };
    mockWorkspace = null;
  };
  const withMembership = () => {
    mockAuthUser = { id: 'u1', email: 'u1@test.com' };
    mockWorkspace = { userId: 'u1', workspaceId: 'ws-1', role: 'owner' };
  };

  it('1. metrics/[id] DELETE → 403 without membership, service untouched', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>('./metrics/[id]/route.ts');
    const res = await mod.DELETE(
      new Request('http://localhost/api/social/metrics/5', { method: 'DELETE' }),
      { params: { id: '5' } },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('فضای کاری');
  });

  it('2. metrics/[id] DELETE → passes the gate with membership', async () => {
    withMembership();
    const mod = await importRoute<RouteModule>('./metrics/[id]/route.ts');
    // With membership the handler proceeds; the (mocked) service layer throws
    // — what matters is the response is NOT the 403 workspace gate.
    const res = await mod.DELETE(
      new Request('http://localhost/api/social/metrics/5', {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
      { params: { id: '5' } },
    );
    expect(res.status).not.toBe(403);
  });

  it('3. import/review/upload POST → 403 without membership', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>(
      './import/review/upload/route.ts',
    );
    const form = new FormData();
    form.append('file', new Blob(['x']), 'f.xlsx');
    const res = await mod.POST(
      new Request('http://localhost/api/social/import/review/upload', {
        method: 'POST',
        body: form,
      }),
      { params: {} },
    );
    expect(res.status).toBe(403);
  });

  it('4. import/review/sessions GET → 403 without membership', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>(
      './import/review/sessions/route.ts',
    );
    const res = await mod.GET(
      new Request('http://localhost/api/social/import/review/sessions'),
      { params: {} },
    );
    expect(res.status).toBe(403);
  });

  it('5. import/review/sessions POST → 403 without membership', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>(
      './import/review/sessions/route.ts',
    );
    const res = await mod.POST(
      new Request('http://localhost/api/social/import/review/sessions', {
        method: 'POST',
        body: JSON.stringify({ filename: 'f.xlsx', total_rows: 3 }),
      }),
      { params: {} },
    );
    expect(res.status).toBe(403);
  });

  it('6. import/review/sessions/[id] GET/PATCH/DELETE → 403 without membership', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>(
      './import/review/sessions/[id]/route.ts',
    );
    const base = 'http://localhost/api/social/import/review/sessions/s-1';
    expect(
      (await mod.GET(new Request(base), { params: Promise.resolve({ id: 's-1' }) }))
        .status,
    ).toBe(403);
    expect(
      (
        await mod.PATCH(
          new Request(base, { method: 'PATCH', body: JSON.stringify({}) }),
          { params: Promise.resolve({ id: 's-1' }) },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await mod.DELETE(new Request(base, { method: 'DELETE' }), {
          params: Promise.resolve({ id: 's-1' }),
        })
      ).status,
    ).toBe(403);
  });

  it('7. sessions/[id] subroutes (validate/preview/commit/rows/anomalies) → 403 without membership', async () => {
    noMembership();

    const validate = await importRoute<RouteModule>(
      './import/review/sessions/[id]/validate/route.ts',
    );
    expect(
      (
        await validate.POST(new Request('http://x', { method: 'POST' }), {
          params: Promise.resolve({ id: 's-1' }),
        })
      ).status,
    ).toBe(403);

    const preview = await importRoute<RouteModule>(
      './import/review/sessions/[id]/preview/route.ts',
    );
    expect(
      (
        await preview.POST(new Request('http://x', { method: 'POST' }), {
          params: Promise.resolve({ id: 's-1' }),
        })
      ).status,
    ).toBe(403);

    const commit = await importRoute<RouteModule>(
      './import/review/sessions/[id]/commit/route.ts',
    );
    expect(
      (
        await commit.POST(new Request('http://x', { method: 'POST' }), {
          params: Promise.resolve({ id: 's-1' }),
        })
      ).status,
    ).toBe(403);

    const rows = await importRoute<RouteModule>(
      './import/review/sessions/[id]/rows/route.ts',
    );
    expect(
      (
        await rows.GET(new Request('http://x'), {
          params: Promise.resolve({ id: 's-1' }),
        })
      ).status,
    ).toBe(403);

    const anomalies = await importRoute<RouteModule>(
      './import/review/sessions/[id]/anomalies/route.ts',
    );
    expect(
      (
        await anomalies.GET(new Request('http://x'), {
          params: { id: 's-1' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await anomalies.PATCH(
          new Request('http://x', { method: 'PATCH', body: '{}' }),
          { params: { id: 's-1' } },
        )
      ).status,
    ).toBe(403);
  });

  it('8. rows/[rowId] family (row/candidates/resolve/reject) → 403 without membership', async () => {
    noMembership();
    const rowMod = await importRoute<RouteModule>(
      './import/review/sessions/[id]/rows/[rowId]/route.ts',
    );
    expect(
      (
        await rowMod.GET(new Request('http://x'), {
          params: Promise.resolve({ id: 's-1', rowId: 'r-1' }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await rowMod.PATCH(
          new Request('http://x', { method: 'PATCH', body: '{}' }),
          { params: Promise.resolve({ id: 's-1', rowId: 'r-1' }) },
        )
      ).status,
    ).toBe(403);

    const candidates = await importRoute<RouteModule>(
      './import/review/sessions/[id]/rows/[rowId]/candidates/route.ts',
    );
    expect(
      (
        await candidates.GET(new Request('http://x'), {
          params: Promise.resolve({ id: 's-1', rowId: 'r-1' }),
        })
      ).status,
    ).toBe(403);

    const resolve = await importRoute<RouteModule>(
      './import/review/sessions/[id]/rows/[rowId]/resolve/route.ts',
    );
    expect(
      (
        await resolve.POST(
          new Request('http://x', {
            method: 'POST',
            body: JSON.stringify({ matched_account_id: '00000000-0000-4000-8000-000000000000' }),
          }),
          { params: Promise.resolve({ id: 's-1', rowId: 'r-1' }) },
        )
      ).status,
    ).toBe(403);

    const reject = await importRoute<RouteModule>(
      './import/review/sessions/[id]/rows/[rowId]/reject/route.ts',
    );
    expect(
      (
        await reject.POST(
          new Request('http://x', {
            method: 'POST',
            body: JSON.stringify({ reason: 'test' }),
          }),
          { params: Promise.resolve({ id: 's-1', rowId: 'r-1' }) },
        )
      ).status,
    ).toBe(403);
  });

  it('9. brand/[brand] GET → 403 without membership even for a real session', async () => {
    noMembership();
    const mod = await importRoute<RouteModule>(
      './brand/[brand]/route.ts',
    );
    const res = await mod.GET(new Request('http://x'), {
      params: { brand: 'nesim' },
    });
    expect(res.status).toBe(403);
  });

  it('10. brand/[brand] GET with membership passes the workspace gate (401 synthetic check applies to demo ids only)', async () => {
    withMembership();
    const mod = await importRoute<RouteModule>(
      './brand/[brand]/route.ts',
    );
    // Service layer will throw (mocked getSupabase) → the route should map it
    // to a 500/4xx other than the workspace-gate 403 with the membership text.
    const res = await mod.GET(new Request('http://x'), {
      params: { brand: 'nesim' },
    });
    expect(res.status).not.toBe(403);
  });
});
