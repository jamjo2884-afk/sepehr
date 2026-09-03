import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a server-side Supabase client that reads the auth session from the
 * request cookies (`sb-<project-ref>-auth-token`), so RLS and getUser()
 * operate as the real authenticated user.
 *
 * Only use inside Route Handlers / Server Components where the request cookie
 * store is available — never in middleware (middleware builds its own client
 * from the request/response cookies, see middleware.ts).
 */
export async function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    supabaseUrl ?? 'https://placeholder.supabase.co',
    supabaseAnonKey ?? 'placeholder-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookie mutations are not
            // allowed there. Ignore (the session is still readable).
          }
        },
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    },
  );
}
