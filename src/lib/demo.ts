/**
 * Client-side demo-mode detection.
 *
 * Mirrors isDemoMode() in src/lib/auth.ts for the browser:
 * demo is active when Supabase is not configured (placeholder) or when
 * NEXT_PUBLIC_DEMO_MODE=true. The public mirror exists because DEMO_MODE
 * itself is a server-only env var and is never exposed to the client.
 *
 * Keep NEXT_PUBLIC_DEMO_MODE in sync with DEMO_MODE in .env.
 */
export function isDemoModeClient(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url === 'https://placeholder.supabase.co') return true;
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
