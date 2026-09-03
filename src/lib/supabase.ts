import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Do not throw at module load when the env vars are missing: builds (e.g.
// Vercel) and the demo workspace run without them, and the social dashboard
// falls back to its bundled snapshot. Calls against the placeholder will
// fail at request time with a clear network error instead of breaking the
// whole build.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Using placeholder client; auth & DB calls will fail until they are set.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      // Isolated key: the auth UI uses the cookie-backed supabase-browser
      // client (sb-<ref>-auth-token). Sharing this client's storage key with
      // it would make auth-js treat them as conflicting instances.
      storageKey: 'md-anon-legacy',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // Next.js App Router patches global fetch and caches GET responses in
      // its Data Cache (revalidate ~1 year). Supabase reads must always be
      // live, so opt every request out of that cache. Without this, API
      // routes can serve stale rows (e.g. an empty review list) until the
      // cache expires or is cleared.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  },
);
