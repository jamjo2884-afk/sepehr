import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Guest Mode unit tests.
 *
 * Covers: runtime flag on/off, guest identity, write-method blocking,
 * deny-by-default API allowlist, blocked pages, and the getAuthUser() guest
 * fallback in real-auth mode.
 */

import {
  GUEST_USER_ID,
  GUEST_WORKSPACE_ID,
  GUEST_WORKSPACE_UUID,
  GUEST_ROLE,
  getGuestContext,
  isGuestModeEnabled,
  isGuestUser,
  isGuestApiReadAllowed,
  isGuestPageBlocked,
  isWriteMethod,
} from '@/lib/guest-mode';

describe('guest mode flag', () => {
  const ORIGINAL = process.env.GUEST_MODE_ENABLED;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GUEST_MODE_ENABLED;
    else process.env.GUEST_MODE_ENABLED = ORIGINAL;
  });

  it('is disabled by default (unset)', () => {
    delete process.env.GUEST_MODE_ENABLED;
    expect(isGuestModeEnabled()).toBe(false);
  });

  it('requires the exact value "true"', () => {
    process.env.GUEST_MODE_ENABLED = 'true';
    expect(isGuestModeEnabled()).toBe(true);
    process.env.GUEST_MODE_ENABLED = 'True';
    expect(isGuestModeEnabled()).toBe(false);
    process.env.GUEST_MODE_ENABLED = '1';
    expect(isGuestModeEnabled()).toBe(false);
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
  it('allows exactly the guest read routes', () => {
    expect(isGuestApiReadAllowed('/api/brands')).toBe(true);
    expect(isGuestApiReadAllowed('/api/brands/summary')).toBe(true);
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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
