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
 * Check whether a Supabase table is available (exists and is queryable).
 *
 * Result is cached per table name after the first probe.
 * Returns `true` when the table exists (even if the query returned an error
 * for a reason other than "relation does not exist").
 * Returns `false` when the table doesn't exist (PGRST205) or on network error.
 */
export async function isTableAvailable(table: string): Promise<boolean> {
  if (_cache[table] !== undefined) return _cache[table];

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from(table).select('id').limit(1);
    // PGRST205 = "relation does not exist" — table is missing
    _cache[table] = !error || error.code !== 'PGRST205';
  } catch {
    _cache[table] = false;
  }

  return _cache[table];
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
