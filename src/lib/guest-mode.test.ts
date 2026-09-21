import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Guest Mode unit tests.
 *
 * Covers: runtime flag (DB-backed with TTL cache + env fallback), guest
 * identity, write-method blocking, deny-by-default API allowlist, blocked
 * pages, and the getAuthUser() guest fallback in real-auth mode.
 */

import {
  GUEST_USER_ID,
  GUEST_WORKSPACE_ID,
  GUEST_WORKSPACE_UUID,
  GUEST_ROLE,
  GUEST_MODE_TTL_MS,
  getGuestContext,
  isGuestModeEnabled,
  resetGuestModeCacheForTests,
  isGuestUser,
  isGuestApiReadAllowed,
  isGuestPageBlocked,
  isWriteMethod,
} from '@/lib/guest-mode';

/* ===========================================================================
 * DB-fetch stub helpers (lightweight anon REST fetch of app_settings)
 * ========================================================================= */

function stubDbRow(row: { guest_mode_enabled: boolean } | null) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(row ? [row] : []), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubDbFailure() {
  const fetchMock = vi.fn(async () => {
    throw new Error('network down');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('guest mode flag (DB-backed with TTL cache + env fallback)', () => {
  const ORIGINAL = process.env.GUEST_MODE_ENABLED;

  beforeEach(() => {
    resetGuestModeCacheForTests();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (ORIGINAL === undefined) delete process.env.GUEST_MODE_ENABLED;
    else process.env.GUEST_MODE_ENABLED = ORIGINAL;
    resetGuestModeCacheForTests();
  });

  it('is disabled by default (no row, no env)', async () => {
    delete process.env.GUEST_MODE_ENABLED;
    const fetchMock = stubDbRow(null);
    await expect(isGuestModeEnabled()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads enabled=true from the app_settings row', async () => {
    delete process.env.GUEST_MODE_ENABLED;
    stubDbRow({ guest_mode_enabled: true });
    await expect(isGuestModeEnabled()).resolves.toBe(true);
  });

  it('DB row wins over the env var (DB is the source of truth)', async () => {
    process.env.GUEST_MODE_ENABLED = 'true';
    stubDbRow({ guest_mode_enabled: false });
    await expect(isGuestModeEnabled()).resolves.toBe(false);
  });

  it('falls back to the env var when the row is absent', async () => {
    process.env.GUEST_MODE_ENABLED = 'true';
    stubDbRow(null);
    await expect(isGuestModeEnabled()).resolves.toBe(true);
  });

  it('falls back to the env var when the fetch fails', async () => {
    process.env.GUEST_MODE_ENABLED = 'true';
    stubDbFailure();
    await expect(isGuestModeEnabled()).resolves.toBe(true);
  });

  it('defaults OFF when everything fails (fail closed)', async () => {
    delete process.env.GUEST_MODE_ENABLED;
    stubDbFailure();
    await expect(isGuestModeEnabled()).resolves.toBe(false);
  });

  it('uses the env fallback without any fetch when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder.supabase.co');
    process.env.GUEST_MODE_ENABLED = 'true';
    const fetchMock = stubDbRow({ guest_mode_enabled: true });
    await expect(isGuestModeEnabled()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches the DB value and re-fetches only after the TTL', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = stubDbRow({ guest_mode_enabled: true });
      await expect(isGuestModeEnabled()).resolves.toBe(true);
      await expect(isGuestModeEnabled()).resolves.toBe(true); // cached
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance past the TTL → next call re-fetches.
      vi.setSystemTime(Date.now() + GUEST_MODE_TTL_MS + 1);
      await expect(isGuestModeEnabled()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('guest identity', () => {
  it('getGuestContext returns the guest AuthUser shape', () => {
    expect(getGuestContext()).toEqual({
      id: GUEST_USER_ID,
      email: 'guest@mediadeck.local',
    });
  });

  it('isGuestUser matches only the guest id', () => {
    expect(isGuestUser({ id: GUEST_USER_ID })).toBe(true);
    expect(isGuestUser({ id: 'user-123' })).toBe(false);
    expect(isGuestUser(null)).toBe(false);
    expect(isGuestUser(undefined)).toBe(false);
  });

  it('guest workspace constants stay in sync', () => {
    expect(GUEST_WORKSPACE_ID).toBe('demo-workspace-000');
    expect(GUEST_WORKSPACE_UUID).toBe('deb00d00-0000-4000-8000-deb00d000001');
    expect(GUEST_ROLE).toBe('guest');
  });
});

describe('write blocking', () => {
  it('marks mutations as writes and reads as reads', () => {
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      expect(isWriteMethod(m)).toBe(true);
      expect(isWriteMethod(m.toLowerCase())).toBe(true);
    }
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      expect(isWriteMethod(m)).toBe(false);
    }
  });
});

describe('deny-by-default API allowlist', () => {
  it('allows exactly the five guest read routes (summary NOT among them)', () => {
    expect(isGuestApiReadAllowed('/api/brands')).toBe(true);
    // summary carries an unscoped FlowBoard Prisma block — never guest-safe:
    expect(isGuestApiReadAllowed('/api/brands/summary')).toBe(false);
    expect(isGuestApiReadAllowed('/api/brands/summary/extra')).toBe(false);
    expect(isGuestApiReadAllowed('/api/brands/abc-123')).toBe(true);
    expect(isGuestApiReadAllowed('/api/content')).toBe(true);
    expect(isGuestApiReadAllowed('/api/content/xyz')).toBe(true);
    expect(isGuestApiReadAllowed('/api/command-center')).toBe(true);
  });

  it('denies everything else (deny by default)', () => {
    expect(isGuestApiReadAllowed('/api/social/analytics')).toBe(false);
    expect(isGuestApiReadAllowed('/api/social/brand/acme')).toBe(false);
    expect(isGuestApiReadAllowed('/api/intelligence')).toBe(false);
    expect(isGuestApiReadAllowed('/api/settings')).toBe(false);
    expect(isGuestApiReadAllowed('/api/settings/guest-mode')).toBe(false);
    expect(isGuestApiReadAllowed('/api/finance/expenses')).toBe(false);
    expect(isGuestApiReadAllowed('/api/notifications')).toBe(false);
    expect(isGuestApiReadAllowed('/api/team/workload')).toBe(false);
    expect(isGuestApiReadAllowed('/api/unknown')).toBe(false);
    expect(isGuestApiReadAllowed('/api')).toBe(false);
    expect(isGuestApiReadAllowed('/api/brands/abc/performance')).toBe(false);
    expect(isGuestApiReadAllowed('/api/content/tasks-count')).toBe(false);
  });

  it('denies path traversal style suffixes', () => {
    expect(isGuestApiReadAllowed('/api/brands/summary/extra')).toBe(false);
    expect(isGuestApiReadAllowed('/api/brands/a/b')).toBe(false);
  });
});

describe('blocked guest pages', () => {
  it('blocks pages whose server data path reads legacy anon-readable tables', () => {
    for (const p of [
      '/social',
      '/social/accounts',
      '/social/abc',
      '/audience',
      '/analytics',
      '/intelligence',
      '/settings',
      '/tasks',
    ]) {
      expect(isGuestPageBlocked(p)).toBe(true);
    }
  });

  it('does not block main read-only pages', () => {
    for (const p of [
      '/',
      '/command-center',
      '/brands',
      '/content',
      '/finance',
    ]) {
      expect(isGuestPageBlocked(p)).toBe(false);
    }
  });
});

describe('getAuthUser guest fallback (real-auth mode)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // The flag resolver probes app_settings over REST; stub it to a 404 so
    // these tests exercise the env-var fallback path quickly and offline.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubNoSession() {
    vi.doMock('@/lib/supabase-server', () => ({
      createSupabaseServerClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
      })),
    }));
  }

  async function importAuth() {
    return (await import('@/lib/auth')).getAuthUser;
  }

  it('returns the guest user when flag is on and no session exists', async () => {
    stubNoSession();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    vi.stubEnv('GUEST_MODE_ENABLED', 'true');
    vi.stubEnv('DEMO_MODE', '');
    const getAuthUser = await importAuth();
    const user = await getAuthUser();
    expect(user?.id).toBe(GUEST_USER_ID);
  });

  it('returns null when flag is off and no session exists', async () => {
    stubNoSession();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    delete process.env.GUEST_MODE_ENABLED;
    vi.stubEnv('DEMO_MODE', '');
    const getAuthUser = await importAuth();
    const user = await getAuthUser();
    expect(user).toBeNull();
  });

  it('never returns the guest user in demo mode', async () => {
    vi.doMock('@/lib/supabase-server', () => ({
      createSupabaseServerClient: vi.fn(),
    }));
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('GUEST_MODE_ENABLED', 'true');
    const getAuthUser = await importAuth();
    const user = await getAuthUser();
    expect(user?.id).toBe('demo-user-000');
    expect(user?.id).not.toBe(GUEST_USER_ID);
  });
});
