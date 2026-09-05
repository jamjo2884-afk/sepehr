/**
 * Centralized Supabase client accessor and table availability checker.
 *
 * Provides:
 * - `getSupabase()` — returns the shared Supabase client via dynamic import
 * - `isTableAvailable(table)` — probes a table once, caches the result per table name
 * - `resetTableCache()` — clears the cache (for tests)
 *
 * Replaces the duplicated `getSupabase()` + `checkSupabaseTable()` + `_supabaseAvailable`
 * pattern that was copy-pasted into brand.service, finance.service, and team.service.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Supabase Client ────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  const { supabase } = await import('@/lib/supabase');
  _client = supabase;
  return _client;
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
  _client = null;
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
}
