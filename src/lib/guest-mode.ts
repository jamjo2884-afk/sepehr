/**
 * Guest Mode — read-only demo access for unauthenticated visitors.
 *
 * Design (decided 2026-09-19, see guest demo migration header for the full
 * rationale):
 * - Opt-in at runtime ONLY via GUEST_MODE_ENABLED=true. Never derived from
 *   client input. Default is OFF everywhere.
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
 * Canonical guest workspace id as exposed by the API/workspace resolver.
 * NOTE: `workspaces.id` / `brands.workspace_id` / `contents.workspace_id` are
 * `uuid` columns, so the canonical string above cannot be a row id. The seeded
 * demo workspace row uses the fixed uuid below; the guest WorkspaceContext
 * carries both (workspaceId = canonical, workspaceUuid = DB value).
 */
export const GUEST_WORKSPACE_ID = 'demo-workspace-000';

/** Fixed uuid of the seeded demo workspace row (see the guest seed migration). */
export const GUEST_WORKSPACE_UUID = 'deb00d00-0000-4000-8000-deb00d000001';

/** Synthetic email for the guest identity (never used to log in). */
export const GUEST_EMAIL = 'guest@mediadeck.local';

/** Role label stored on the guest WorkspaceContext. */
export const GUEST_ROLE = 'guest';

/** Runtime opt-in flag. Default OFF; requires explicit GUEST_MODE_ENABLED=true. */
export function isGuestModeEnabled(): boolean {
  return process.env.GUEST_MODE_ENABLED === 'true';
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
 * - /api/content/tasks-count  → reads FlowBoard cards via Prisma (no RLS)
 * - /api/brands/[id]/performance|related|status → social/finance/Prisma paths
 * - everything under /api/social/*, /api/intelligence, /api/command-center is
 *   handled separately (command-center has a guest branch; social/intelligence
 *   read legacy anon-readable tenant tables and must stay blocked).
 * ========================================================================= */

const GUEST_API_READ_DENYLIST: RegExp[] = [/^\/api\/content\/tasks-count\/?$/];

const GUEST_API_READ_ALLOWLIST: RegExp[] = [
  /^\/api\/brands\/?$/,
  /^\/api\/brands\/summary\/?$/,
  /^\/api\/brands\/[^/]+\/?$/,
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
