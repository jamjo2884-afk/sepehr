/**
 * Supabase server-client factory registry.
 *
 * This module is deliberately CLIENT-SAFE: it never imports `next/headers` or
 * any server-only module, so it can be imported from shared service code that
 * also runs in the browser.
 *
 * `supabase-server.ts` registers its cookie-backed SSR client factory here as a
 * module-load side effect. Shared code (`lib/db.ts`) asks for the factory when
 * running server-side; if none is registered yet (e.g. tests, build, or code
 * paths that never imported the SSR client) it falls back to the anon client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ServerClientFactory = () => Promise<SupabaseClient>;

let _factory: ServerClientFactory | null = null;

/** Register the request-scoped SSR client factory (called by supabase-server). */
export function registerServerClientFactory(factory: ServerClientFactory): void {
  _factory = factory;
}

/** Get the registered SSR client factory, or null when none is registered. */
export function getRegisteredServerClientFactory(): ServerClientFactory | null {
  return _factory;
}

/** Clear the registration (tests only). */
export function resetServerClientFactoryForTests(): void {
  _factory = null;
}
