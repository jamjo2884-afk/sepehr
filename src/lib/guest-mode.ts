/**
 * Guest Mode — read-only demo access for unauthenticated visitors.
 *
 * Design (decided 2026-09-19, see guest demo migration header for the full
 * rationale; DB-backed toggle added 2026-09-21):
 * - Opt-in at runtime via the DB-backed singleton `app_settings` row
 *   (guest_mode_enabled), toggled ONLY through the SECURITY DEFINER
 *   set_guest_mode() RPC. GUEST_MODE_ENABLED=true remains a fallback when
 *   the row is missing/unreachable. Never derived from client input. Default
 *   is OFF everywhere.
 * - Guests resolve through the normal server client with NO session, so every
 *   Supabase query runs as `anon` under RLS. Tenant tables have no anon
 *   policies → unreachable. The seed migration grants anon SELECT only on the
 *   seeded demo workspace rows (fixed uuid, see GUEST_WORKSPACE_UUID).
 * - Deny-by-default API allowlist: guests may only GET a small set of
 *   workspace-uuid-scoped routes. Everything else is 403 — enforced in
 *   middleware AND again in route-auth (defense in depth).
 * - Guest writes are impossible: isWriteMethod is rejected at middleware,
 *   route-auth, and (optionally) legacy requireAuth(req) call sites.
 *
 * Server-only. Nothing in this module trusts request data for scoping.
 */

/** Guest identity — never a real auth.users row; purely an app-level marker. */
export const GUEST_USER_ID = 'guest-user-000';

/**
 * Canonical demo-workspace SLUG (the seeded workspace row's slug in the DB).
 * NOTE: this label is NOT a uuid and is never used for data scoping — every
 * `.eq('workspace_id', …)` filter for guests uses GUEST_WORKSPACE_UUID below.
 * It exists only as the human-readable canonical name of the demo workspace.
 */
export const GUEST_WORKSPACE_ID = 'demo-workspace-000';

/**
 * Fixed uuid of the seeded demo workspace row (see the guest seed migration).
 * This is THE guest scoping id: WorkspaceContext.workspaceId for the guest is
 * this uuid, so every service-level workspace filter targets exactly the
 * seeded demo rows — matching the anon RLS policies. No request parameter can
 * ever override it (it is a compile-time constant, not request-derived).
 */
export const GUEST_WORKSPACE_UUID = 'deb00d00-0000-4000-8000-deb00d000001';

/** Synthetic email for the guest identity (never used to log in). */
export const GUEST_EMAIL = 'guest@mediadeck.local';

/** Role label stored on the guest WorkspaceContext. */
export const GUEST_ROLE = 'guest';

/* ===========================================================================
 * Runtime flag — DB-backed with TTL cache + env fallback
 * ========================================================================= */

/**
 * Cache TTL for the DB-backed flag (milliseconds). Callers may show a
 * "تغییر تا ۱۰ ثانیه دیگر اعمال می‌شود" notice — this constant is the source
 * of that number.
 */
export const GUEST_MODE_TTL_MS = 10_000;

interface FlagCache {
  value: boolean;
  fetchedAt: number;
}

// In-process cache. Serverless: per-instance, hence the short TTL.
let _flagCache: FlagCache | null = null;
let _inflight: Promise<boolean> | null = null;

/**
 * Lightweight, session-less REST fetch of the singleton app_settings row.
 * Uses the anon key directly (NOT the cookie-backed SSR client): the flag
 * must be readable without a session — middleware runs before any auth.
 * The anon SELECT policy on app_settings exposes only this one row.
 */
async function fetchGuestFlagFromDb(): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url === 'https://placeholder.supabase.co') {
    return null; // No backend → env fallback path.
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?id=eq.1&select=guest_mode_enabled`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(2_000),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { guest_mode_enabled?: boolean }[];
    if (!Array.isArray(rows) || rows.length === 0) return null; // row absent
    return rows[0].guest_mode_enabled === true;
  } catch {
    return null; // Network/timeout → env fallback path.
  }
}

/**
 * Resolve the runtime guest-mode flag:
 * 1. fresh in-process cache (< GUEST_MODE_TTL_MS old) → cached value;
 * 2. DB singleton row (lightweight anon REST fetch, coalesced in-flight);
 * 3. fallback: legacy GUEST_MODE_ENABLED env var;
 * 4. default OFF.
 *
 * Failure semantics: any DB problem degrades to the env var / OFF — the flag
 * can never be flipped ON by an error.
 */
export async function isGuestModeEnabled(): Promise<boolean> {
  const now = Date.now();

  if (_flagCache && now - _flagCache.fetchedAt < GUEST_MODE_TTL_MS) {
    return _flagCache.value;
  }

  // Coalesce concurrent misses into a single fetch.
  if (!_inflight) {
    _inflight = (async () => {
      const fromDb = await fetchGuestFlagFromDb();
      const value = fromDb ?? process.env.GUEST_MODE_ENABLED === 'true';
      _flagCache = { value, fetchedAt: Date.now() };
      return value;
    })().finally(() => {
      _inflight = null;
    });
  }

  return _inflight;
}

/** Clear the flag cache (tests only). */
export function resetGuestModeCacheForTests(): void {
  _flagCache = null;
  _inflight = null;
}

/** True for HTTP methods that mutate state. GET/HEAD/OPTIONS are reads. */
export function isWriteMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/** Structural AuthUser shape (mirrors src/lib/auth.ts AuthUser). */
export interface GuestAuthUser {
  id: string;
  email: string;
}

/** The guest AuthUser used by getAuthUser() when the flag is on. */
export function getGuestContext(): GuestAuthUser {
  return { id: GUEST_USER_ID, email: GUEST_EMAIL };
}

/** Identify the guest identity resolved server-side (never spoofable by clients). */
export function isGuestUser(user: { id: string } | null | undefined): boolean {
  return !!user && user.id === GUEST_USER_ID;
}

/* ===========================================================================
 * Deny-by-default API allowlist (reads only)
 *
 * Only routes whose full data path is either RLS-scoped to the guest
 * workspace uuid or provably empty for anon are allowed. Explicitly excluded
 * despite matching a shape below:
 * - /api/brands/summary      → its handler contains an UNSCOPED FlowBoard
 *   Prisma block (prisma.flowCard.findMany with no workspace filter; FlowBoard
 *   tables have no RLS) — excluded inside the [id] pattern via lookahead.
 * - /api/content/tasks-count  → reads FlowBoard cards via Prisma (no RLS)
 * - /api/brands/[id]/performance|related|status → social/finance/Prisma paths
 *   (also unreachable: the [id] pattern matches exactly ONE extra segment,
 *   never deeper paths — enforced at middleware too, defense in depth)
 * - everything under /api/social/*, /api/intelligence — they read legacy
 *   anon-readable tenant tables and must stay blocked (command-center has an
 *   explicit guest branch that returns zeros without touching those tables).
 * ========================================================================= */

const GUEST_API_READ_DENYLIST: RegExp[] = [/^\/api\/content\/tasks-count\/?$/];

const GUEST_API_READ_ALLOWLIST: RegExp[] = [
  /^\/api\/brands\/?$/,
  // Exactly ONE extra segment (a brand-id lookup). `summary` is excluded here
  // — not via the denylist — so the allowlist itself stays the single source
  // of truth for which routes are guest-safe: its handler contains an
  // UNSCOPED FlowBoard Prisma block (no workspace filter, no RLS).
  /^\/api\/brands\/(?!summary\/?$)[^/]+\/?$/,
  /^\/api\/content\/?$/,
  /^\/api\/content\/[^/]+\/?$/,
  /^\/api\/command-center\/?$/,
];

/**
 * May a guest perform a read on this API path? Deny-by-default: a path is
 * allowed only when it matches the allowlist AND not the denylist.
 */
export function isGuestApiReadAllowed(pathname: string): boolean {
  if (GUEST_API_READ_DENYLIST.some((re) => re.test(pathname))) return false;
  return GUEST_API_READ_ALLOWLIST.some((re) => re.test(pathname));
}

/* ===========================================================================
 * Page deny-list for guests
 *
 * These page groups render data server-side through services that read legacy
 * anon-readable tables (social_*) or FlowBoard's Prisma database (no RLS), so
 * guests are redirected away from them instead of serving tenant data.
 * ========================================================================= */

const GUEST_BLOCKED_PAGE_PREFIXES = [
  '/social',
  '/audience',
  '/analytics',
  '/intelligence',
  '/settings',
  '/tasks',
];

/** Is this page route blocked for guests? (exact '/' and unknown paths are not) */
export function isGuestPageBlocked(pathname: string): boolean {
  return GUEST_BLOCKED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
