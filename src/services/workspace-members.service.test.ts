import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Workspace members service tests.
 *
 * Focuses on the two things that decide whether the Members UI is safe:
 *  - input validation (a typo must become an error, never a silent "no access")
 *  - Postgres SQLSTATE -> errorCode mapping (the routes pick the HTTP status from
 *    these codes, so a wrong mapping would turn a permission failure into a 500
 *    or, worse, a validation failure into a 403).
 *
 * The Supabase client is mocked; no network or database access.
 */

const mockRpc = vi.fn();
const mockFrom = vi.fn();

/**
 * Chainable query builder mirroring the PostgREST fluent API the service uses:
 *   .from(t).select(cols).eq(col, val).order(...)?.limit(n) -> Promise<{data,error}>
 *
 * `result` is what the terminal (awaited) step resolves to. Each call to
 * `mockFromOnce` queues one such builder.
 */
function makeQuery(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(result);
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => terminal());
  // Allow awaiting at any stage (matches a thenable query builder).
  chain.then = (onFulfilled: (v: unknown) => unknown) => terminal().then(onFulfilled);
  return chain;
}

/** Queue a single .from() call that resolves to `result`. */
function mockFromOnce(result: { data?: unknown; error?: unknown }) {
  const q = makeQuery(result);
  mockFrom.mockReturnValueOnce({ select: q.select });
  return q;
}

vi.mock('@/lib/db', () => ({
  getSupabase: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

import {
  createWorkspaceInvitation,
  listPermissionAudit,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateMemberAccess,
  buildAcceptUrl,
} from '@/services/workspace-members.service';

const WS = 'ws-1';
const USER = '11111111-2222-3333-4444-555555555555';

// Invite links are only built from this one variable, so every test that
// exercises an invite needs it present.
const APP_URL = 'https://app.example.com';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
});

describe('updateMemberAccess — validation', () => {
  it('rejects a non-uuid target without touching the database', async () => {
    const res = await updateMemberAccess('not-a-uuid', { role: 'member' });
    expect(res).toEqual({
      ok: false,
      errorCode: 'invalid_input',
      errorMessage: expect.any(String),
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects a body with neither role nor permissions', async () => {
    const res = await updateMemberAccess(USER, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects the owner role — owner is never assignable', async () => {
    const res = await updateMemberAccess(USER, { role: 'owner' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects an unknown permission level rather than dropping it', async () => {
    // The DB column is jsonb; an unknown level must not silently become "none".
    const res = await updateMemberAccess(USER, {
      permissions: { brands: 'superuser' },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects an unknown module key', async () => {
    const res = await updateMemberAccess(USER, {
      permissions: { secretModule: 'view' },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
  });

  it('accepts a valid matrix and forwards it to the RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, changed: true } });
    const res = await updateMemberAccess(USER, {
      permissions: { brands: 'edit', finance: 'view' },
    });
    expect(res).toEqual({ ok: true, data: { changed: true } });
    expect(mockRpc).toHaveBeenCalledWith('update_member_access', {
      p_target_user_id: USER,
      p_role: null,
      p_permissions: { brands: 'edit', finance: 'view' },
    });
  });

  it('passes null for the field that was not supplied', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, changed: true } });
    await updateMemberAccess(USER, { role: 'viewer' });
    expect(mockRpc).toHaveBeenCalledWith('update_member_access', {
      p_target_user_id: USER,
      p_role: 'viewer',
      p_permissions: null,
    });
  });

  it('reports a no-op change as changed:false', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, changed: false } });
    const res = await updateMemberAccess(USER, { role: 'member' });
    expect(res).toEqual({ ok: true, data: { changed: false } });
  });
});

describe('SQLSTATE -> errorCode mapping', () => {
  it('maps 42501 (authority refused) to forbidden', async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: '42501', message: 'only workspace owners/admins' },
    });
    const res = await updateMemberAccess(USER, { role: 'member' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('forbidden');
  });

  it('maps P0002 (target not a member) to not_found', async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: 'P0002', message: 'target is not a member' },
    });
    const res = await removeWorkspaceMember(USER);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('not_found');
  });

  it('maps 23505 (already a member) to conflict', async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate' },
    });
    const res = await createWorkspaceInvitation({ email: 'a@b.com' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('conflict');
  });

  it('maps a missing RPC (PGRST202) to not_configured, not a generic 500', async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: 'PGRST202', message: 'Could not find the function' },
    });
    const res = await updateMemberAccess(USER, { role: 'member' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('not_configured');
  });

  it('maps an unmapped DB error to server_error', async () => {
    mockRpc.mockResolvedValueOnce({ error: { code: '08006', message: 'conn' } });
    const res = await updateMemberAccess(USER, { role: 'member' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('server_error');
  });
});

describe('listWorkspaceMembers', () => {
  it('sanitises the jsonb permissions column (unknown keys/levels dropped)', async () => {
    mockFromOnce({
      data: [
        {
          user_id: USER,
          role: 'member',
          // A hostile/legacy row: unknown module + unknown level + good key.
          permissions: {
            brands: 'view',
            nope: 'edit',
            social: 'superuser',
          },
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const res = await listWorkspaceMembers(WS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Fail closed: only the valid module/level survives.
      expect(res.data[0].permissions).toEqual({ brands: 'view' });
    }
  });

  it('defaults a missing permissions column to an empty matrix', async () => {
    mockFromOnce({
      data: [
        {
          user_id: USER,
          role: 'viewer',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const res = await listWorkspaceMembers(WS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data[0].permissions).toEqual({});
  });
});

describe('listPermissionAudit', () => {
  it('clamps the limit into 1..200', async () => {
    let seenLimit: number | null = null;
    const q = makeQuery({ data: [], error: null });
    const origLimit = q.limit as (n: number) => Promise<unknown>;
    q.limit = vi.fn((n: number) => {
      seenLimit = n;
      return origLimit(n);
    });
    mockFrom.mockReturnValueOnce({ select: q.select });

    await listPermissionAudit(WS, 9999);
    expect(mockFrom).toHaveBeenCalledWith('permission_audit');
    expect(seenLimit).not.toBeNull();
    expect(seenLimit as unknown as number).toBeGreaterThanOrEqual(1);
    expect(seenLimit as unknown as number).toBeLessThanOrEqual(200);
  });
});

describe('createWorkspaceInvitation', () => {
  it('rejects an invalid email before calling the RPC', async () => {
    const res = await createWorkspaceInvitation({ email: 'not-an-email' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('refuses to invite as owner', async () => {
    const res = await createWorkspaceInvitation({
      email: 'a@b.com',
      role: 'owner',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('defaults to the most restrictive role (member)', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'inv-1', error: null });
    mockFromOnce({
      data: [
        {
          id: 'inv-1',
          email: 'a@b.com',
          role: 'member',
          permissions: {},
          token: 'tok-abc',
          invited_by: USER,
          status: 'pending',
          expires_at: '2026-01-08T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          accepted_at: null,
        },
      ],
      error: null,
    });

    const res = await createWorkspaceInvitation({ email: 'A@B.com' });
    expect(res.ok).toBe(true);
    // Email is normalised to lowercase before the RPC sees it.
    expect(mockRpc).toHaveBeenCalledWith('create_workspace_invitation', {
      p_email: 'a@b.com',
      p_role: 'member',
      p_permissions: {},
    });
    if (res.ok) {
      // The RPC returns only an id; the token comes from the read-back.
      expect(res.data.invitation.token).toBe('tok-abc');
      // Accept link lives on the record, built from NEXT_PUBLIC_APP_URL.
      expect(res.data.invitation.acceptUrl).toContain('tok-abc');
    }
  });
});

describe('invite links require a configured public origin', () => {
  it('createWorkspaceInvitation refuses BEFORE writing an unredeemable row', async () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    // On Vercel this var is always present, so the guard has to hold in exactly
    // that condition — a bare unset APP_URL would pass even if some fallback
    // silently rescued the link.
    process.env.VERCEL_URL = 'sepehr-abc123-jamjo2884-afks-projects.vercel.app';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await createWorkspaceInvitation({ email: 'a@b.com' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errorCode).toBe('not_configured');
      // Nothing was written: no RPC, no read-back.
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
      if (prevVercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercel;
    }
  });

  it('listWorkspaceInvitations reports not_configured rather than blank links', async () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = 'sepehr-abc123-jamjo2884-afks-projects.vercel.app';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await listWorkspaceInvitations(WS);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errorCode).toBe('not_configured');
      expect(mockFrom).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
      if (prevVercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercel;
    }
  });

  it('every listed invitation carries an absolute link on the configured origin', async () => {
    mockFromOnce({
      data: [
        {
          id: 'inv-1',
          email: 'a@b.com',
          role: 'member',
          permissions: {},
          token: 'tok-one',
          invited_by: null,
          status: 'pending',
          expires_at: '2026-02-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          accepted_at: null,
        },
      ],
      error: null,
    });
    const res = await listWorkspaceInvitations(WS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].acceptUrl).toBe(`${APP_URL}/invite/tok-one`);
      // The link is absolute — never a bare path the browser would resolve
      // against whatever host the owner happens to be looking at.
      expect(res.data[0].acceptUrl.startsWith('http')).toBe(true);
    }
  });
});

describe('revokeWorkspaceInvitation', () => {
  it('rejects a token that is too short to be real', async () => {
    const res = await revokeWorkspaceInvitation('short');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('invalid_input');
  });

  it('returns not_found when the token matches no invitation', async () => {
    mockFromOnce({ data: [], error: null });
    const res = await revokeWorkspaceInvitation('unknown-token-value');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('not_found');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('resolves token -> invitation id, then revokes via the RPC', async () => {
    mockFromOnce({ data: [{ id: 'inv-9' }], error: null });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const res = await revokeWorkspaceInvitation('a-real-looking-token');
    expect(res).toEqual({ ok: true, data: { revoked: true } });
    expect(mockRpc).toHaveBeenCalledWith('revoke_workspace_invitation', {
      p_invitation_id: 'inv-9',
    });
  });
});

describe('buildAcceptUrl', () => {
  it('returns an empty string and logs when no public origin is configured', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.NEXT_PUBLIC_APP_URL;
    // VERCEL_URL must NOT rescue the link: on Vercel it names the current
    // deployment, and preview hosts sit behind Deployment Protection.
    process.env.VERCEL_URL = 'sepehr-abc123-jamjo2884-afks-projects.vercel.app';
    try {
      expect(buildAcceptUrl('abc')).toBe('');
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('NEXT_PUBLIC_APP_URL is not set'),
      );
    } finally {
      spy.mockRestore();
      if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
      if (prevVercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercel;
    }
  });

  it('uses the configured origin when present', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/';
    try {
      expect(buildAcceptUrl('abc')).toBe('https://app.example.com/invite/abc');
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });

  it('ignores a configured SITE_URL — NEXT_PUBLIC_APP_URL is the only source', () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://stale.example.com';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(buildAcceptUrl('abc')).toBe('');
      spy.mockRestore();
    } finally {
      if (prevApp !== undefined) process.env.NEXT_PUBLIC_APP_URL = prevApp;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });
});
