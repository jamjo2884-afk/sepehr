import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase-browser] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Using placeholder client; auth calls will fail until they are set.',
  );
}

/**
 * Browser Supabase client backed by the @supabase/ssr cookie storage.
 *
 * This is the ONLY client the auth UI may use. Sessions are persisted in the
 * `sb-<project-ref>-auth-token` cookie, which is what middleware.ts and the
 * server-side getAuthUser() rely on. The legacy plain client in
 * src/lib/supabase.ts (localStorage/memory) is kept for existing server-side
 * anon-key consumers and must not be used for authentication.
 */
export const supabaseBrowser = createBrowserClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // Next.js App Router patches global fetch and caches GET responses in
      // its Data Cache — Supabase reads must always be live.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  },
);
