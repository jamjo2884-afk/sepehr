import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

/**
 * requireRole tests (Phase 23 — permission foundation).
 *
 * Verifies the wrapper enforces roles server-side, always after the
 * workspace membership check performed by withAuth.
 */

let mockAuthUser: { id: string; email: string } | null = null;
let mockWorkspace: {
  userId: string;
  workspaceId: string;
  role: string;
} | null = null;

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => mockAuthUser),
}));

vi.mock('@/lib/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => mockWorkspace),
}));

async function makeHandler() {
  const { requireRole } = await import('@/lib/route-auth');
  return requireRole(
    'owner',
    'admin',
  )(async () => NextResponse.json({ ok: true }));
}

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = null;
    mockWorkspace = null;
  });

  it('1. returns 401 when unauthenticated', async () => {
    const handler = await makeHandler();
    const res = await handler(new Request('http://localhost/api/test'));
    expect(res.status).toBe(401);
  });

  it('2. returns 403 when no workspace membership', async () => {
    mockAuthUser = { id: 'u1', email: 'u1@test.com' };
    mockWorkspace = null;
    const handler = await makeHandler();
    const res = await handler(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
  });

  it('3. allows owner and admin roles', async () => {
    mockAuthUser = { id: 'u1', email: 'u1@test.com' };

    mockWorkspace = { userId: 'u1', workspaceId: 'ws-1', role: 'owner' };
    const asOwner = await makeHandler();
    expect(
      (await asOwner(new Request('http://localhost/api/test'))).status,
    ).toBe(200);

    mockWorkspace = { userId: 'u1', workspaceId: 'ws-1', role: 'admin' };
    const asAdmin = await makeHandler();
    expect(
      (await asAdmin(new Request('http://localhost/api/test'))).status,
    ).toBe(200);
  });

  it('4. denies viewer with 403 and a Persian message', async () => {
    mockAuthUser = { id: 'u2', email: 'u2@test.com' };
    mockWorkspace = { userId: 'u2', workspaceId: 'ws-1', role: 'viewer' };

    const handler = await makeHandler();
    const res = await handler(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('دسترسی');
  });

  it('5. membership check is independent of role (viewer with membership reaches the guard)', async () => {
    // The guard must be reached (403 from role check, not 403 from workspace)
    mockAuthUser = { id: 'u2', email: 'u2@test.com' };
    mockWorkspace = { userId: 'u2', workspaceId: 'ws-1', role: 'viewer' };
    const { getCurrentWorkspace } = await import('@/lib/workspace');

    const handler = await makeHandler();
    const res = await handler(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
    expect(getCurrentWorkspace).toHaveBeenCalled();
  });
});

/* =========================================================================
 * Guest gating (withAuth + requireAuth wrappers)
 * ========================================================================= */

describe('guest gating in route-auth wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = null;
    mockWorkspace = null;
  });

  function guestUser() {
    return { id: 'guest-user-000', email: 'guest@mediadeck.local' };
  }

  async function makeWithAuthHandler() {
    const { withAuth } = await import('@/lib/route-auth');
    return withAuth(async () => NextResponse.json({ ok: true, touched: true }));
  }

  it('1. guest mutation gets 403 before the handler runs (withAuth)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/brands', { method: 'POST' }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).touched).toBeUndefined();
  });

  it('2. guest read on a non-allowlisted path gets 403 (withAuth)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/social/analytics'),
    );
    expect(res.status).toBe(403);
  });

  it('3. guest read on an allowlisted path reaches the handler', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(new Request('http://localhost/api/brands'));
    expect(res.status).toBe(200);
    expect((await res.json()).touched).toBe(true);
  });

  it('3b. guest read on /api/brands/summary is denied (unscoped Prisma path)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/brands/summary'),
    );
    expect(res.status).toBe(403);
  });

  it('3c. guest read on a deep brands path is denied (not on allowlist)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/brands/abc-123/performance'),
    );
    expect(res.status).toBe(403);
  });

  it('4. guest GET on /api/content/tasks-count is denied (Prisma path)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/content/tasks-count'),
    );
    expect(res.status).toBe(403);
  });

  it('5. guest POST on an allowlisted path is still 403 (writes never pass)', async () => {
    mockAuthUser = guestUser();
    mockWorkspace = {
      userId: 'guest-user-000',
      workspaceId: 'deb00d00-0000-4000-8000-deb00d000001',
      role: 'guest',
    };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/brands', { method: 'POST' }),
    );
    expect(res.status).toBe(403);
  });

  it('6. requireAuth wrapper applies the same guest gate', async () => {
    mockAuthUser = guestUser();
    const { requireAuth } = await import('@/lib/route-auth');
    const handler = requireAuth(async () => NextResponse.json({ ok: true }));
    const res = await handler(
      new Request('http://localhost/api/unknown-thing', { method: 'DELETE' }),
    );
    expect(res.status).toBe(403);
  });

  it('7. non-guest users are unaffected by the guest gate', async () => {
    mockAuthUser = { id: 'u9', email: 'u9@test.com' };
    mockWorkspace = { userId: 'u9', workspaceId: 'ws-1', role: 'owner' };
    const handler = await makeWithAuthHandler();
    const res = await handler(
      new Request('http://localhost/api/social/analytics'),
    );
    expect(res.status).toBe(200);
  });
});
