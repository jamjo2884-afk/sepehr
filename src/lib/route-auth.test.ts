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
  return requireRole('owner', 'admin')(async () =>
    NextResponse.json({ ok: true }),
  );
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
    expect((await asOwner(new Request('http://localhost/api/test'))).status).toBe(200);

    mockWorkspace = { userId: 'u1', workspaceId: 'ws-1', role: 'admin' };
    const asAdmin = await makeHandler();
    expect((await asAdmin(new Request('http://localhost/api/test'))).status).toBe(200);
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