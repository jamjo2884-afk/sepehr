/**
 * Centralized Supabase client accessor and table availability checker.
 *
 * Provides:
 * - `getSupabase()` — returns a Supabase client appropriate to the runtime:
 *   - Server (inside a Route Handler / Server Component request scope): a
 *     cookie-backed SSR client, so RLS runs as the authenticated user
 *     (Model A: authenticated + workspace-scoped policies).
 *   - Browser: the cookie-backed browser session client.
 *   - Fallback (tests, build-time, demo placeholder, non-request scope): the
 *     shared anon client from `@/lib/supabase` (previous behavior).
 * - `isTableAvailable(table)` — probes a table once, caches the result per table name.
 * - `resetTableCache()` — clears the cache (for tests).
 *
 * IMPORTANT: the SSR client is request-scoped and must never be cached across
 * requests (each request has its own cookies). The anon and browser clients are
 * process-safe singletons.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getRegisteredServerClientFactory } from '@/lib/supabase-registry';

// ── Runtime detection ────────────────────────────────────────────────────────

function hasRealSupabaseConfig(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
}

// ── Clients ────────────────────────────────────────────────────────────────

let _anon: SupabaseClient | null = null;
let _browser: SupabaseClient | null = null;

async function getAnonClient(): Promise<SupabaseClient> {
  if (_anon) return _anon;
  const { supabase } = await import('@/lib/supabase');
  _anon = supabase;
  return _anon;
}

async function getBrowserClient(): Promise<SupabaseClient> {
  if (_browser) return _browser;
  const { supabaseBrowser } = await import('@/lib/supabase-browser');
  _browser = supabaseBrowser;
  return _browser;
}

/**
 * Get the Supabase client for the current runtime:
 * - browser → cookie-backed session client (authenticated)
 * - server in request scope → cookie-backed SSR client (authenticated)
 * - anything else (tests / build / demo) → anon client (previous behavior)
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (typeof window !== 'undefined') {
    if (!hasRealSupabaseConfig()) return getAnonClient();
    return getBrowserClient();
  }

  // Server side. supabase-server.ts registers its cookie-backed SSR client
  // factory here at module load (it is imported by the route auth layer before
  // any service runs). Using the factory keeps next/headers out of shared and
  // client bundles. If no factory is registered (tests, build, code paths that
  // never loaded the SSR client), fall back to the shared anon client.
  if (hasRealSupabaseConfig()) {
    const factory = getRegisteredServerClientFactory();
    if (factory) {
      try {
        return await factory();
      } catch {
        // Not inside a request scope — fall back to the shared anon client.
        return getAnonClient();
      }
    }
  }

  return getAnonClient();
}

// ── Table Availability Cache ───────────────────────────────────────────────

const _cache: Record<string, boolean> = {};

/**
 * Error classification for Supabase/PostgREST responses.
 *
 * The old `isTableAvailable` treated every non-PGRST205 result as "table
 * available", which made RLS/permission/auth/type errors indistinguishable
 * from a healthy table. This classifier is narrower and intentional.
 */
export type SupabaseTableProbeKind =
  | { kind: 'missing' }
  | { kind: 'reachable' }
  | { kind: 'other' }

/**
 * Probe a table with a read-only `select id limit 1` and return a coarse
 * classification.
 *
 * - `missing`: relation does not exist (PGRST205) or table name invalid.
 * - `reachable`: probe returned a non-error response (the table exists AND the
 *   current client could reach/query it — for an auth client this also implies
 *   the caller had read permission at probe time).
 * - `other`: any other error or exception (RLS/permission/auth/type/network/
 *   unexpected). This is NOT treated as "table available".
 */
export async function probeTable(table: string): Promise<SupabaseTableProbeKind> {
  if (_cache[table] !== undefined) {
    const cached = _cache[table];
    if (cached === true) return { kind: 'reachable' };
    if (cached === false) {
      // Previously classified as a failure; without a fresh probe keep it as
      // a non-reachable result.
      return { kind: 'other' };
    }
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from(table).select('id').limit(1);

    if (!error) {
      _cache[table] = true;
      return { kind: 'reachable' };
    }

    // PGRST205 = "relation does not exist" — table is missing.
    // Everything else (RLS/permission/auth/type/network/unknown) is NOT treated
    // as a healthy, usable table.
    if (error.code === 'PGRST205') {
      _cache[table] = false;
      return { kind: 'missing' };
    }

    _cache[table] = false;
    return { kind: 'other' };
  } catch {
    _cache[table] = false;
    return { kind: 'other' };
  }
}

/**
 * Legacy predicate kept for call sites that only need a boolean.
 * It now delegates to the narrower classifier and only returns true when the
 * probe is explicitly `reachable` — non-PGRST205 errors no longer count as
 * "available".
 */
export async function isTableAvailable(table: string): Promise<boolean> {
  return (await probeTable(table)).kind === 'reachable';
}

/**
 * Clear the table availability cache.
 * Used in tests to reset state between test cases.
 */
export function resetTableCache(): void {
  _anon = null;
  _browser = null;
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
}
