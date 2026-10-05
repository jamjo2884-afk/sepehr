/**
 * Workspace members service (Members phase 2).
 *
 * Every mutation in this file goes through a SECURITY DEFINER RPC rather than a
 * direct write. Migration 20261001130000 removed all client-writable policies
 * from `workspace_members` and added none to `workspace_invitations` or
 * `permission_audit`, so these RPCs are the ONLY way membership data can
 * change — the client physically cannot UPDATE a role or a permission matrix.
 * Each RPC re-checks owner/admin authority *inside* the database on top of the
 * route-level `requireRole('owner','admin')` gate, and writes its own
 * permission_audit / audit_logs rows, so history cannot be forged or skipped
 * from the client.
 *
 * Reads are plain SELECTs, narrowed by RLS to the caller's own workspace.
 *
 * Error mapping: the RPCs raise with SQLSTATE codes that this layer turns into
 * stable `errorCode` values so routes can pick an HTTP status without parsing
 * Postgres messages:
 *   42501 -> forbidden    (not owner/admin, immutable owner, self-target)
 *   P0002 -> not_found    (target not a member / invitation gone)
 *   23505 -> conflict     (already a member)
 *   22023 -> invalid      (bad email / matrix / role)
 */

import { getSupabase } from '@/lib/db';
import { sanitizeMatrix } from '@/lib/permissions';
import type { AppRole } from '@/types/auth';
import type {
  PermissionAuditRow,
  PermissionMatrix,
  WorkspaceInvitationRow,
} from '@/types/permissions';
import { ACCESS_LEVELS, MODULE_KEYS } from '@/types/permissions';

/* =========================================================================
 * Types
 * ========================================================================= */

/** A workspace member as the Members UI needs it. */
export interface WorkspaceMember {
  userId: string;
  role: AppRole;
  /** Sanitised per-module matrix. Empty for owner/admin (they ignore it). */
  permissions: PermissionMatrix;
  joinedAt: string;
}

/** An invitation as the Members UI needs it, including its accept link. */
export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: AppRole;
  permissions: PermissionMatrix;
  status: WorkspaceInvitationRow['status'];
  token: string;
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  /**
   * Absolute accept link, built by the server from NEXT_PUBLIC_APP_URL.
   * '' only when that variable is unset, which callers must treat as an error.
   *
   * The link lives on the record precisely so the browser never assembles one
   * from window.location.origin: an owner looking at a preview deployment would
   * otherwise copy a preview URL that Vercel's Deployment Protection intercepts.
   */
  acceptUrl: string;
}

export type ServiceErrorCode =
  | 'invalid_input'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'not_configured'
  | 'server_error';

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: ServiceErrorCode; errorMessage: string };

/** Narrow a union by its discriminant. */
function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(
  errorCode: ServiceErrorCode,
  errorMessage: string,
): ServiceResult<T> {
  return { ok: false, errorCode, errorMessage };
}

/* =========================================================================
 * Errors
 * ========================================================================= */

/**
 * Translate a Supabase/Postgres error into a service error.
 *
 * The RPCs raise `EXCEPTION ... USING ERRCODE = '42501'` for authority
 * failures, so `code` is the reliable signal; the message is only used to pick
 * a friendlier Persian string.
 */
function mapDbError(
  err: { code?: string; message?: string },
  ctx: { forbidden: string; notFound: string; conflict?: string },
): ServiceResult<never> {
  const message = err.message ?? '';

  if (err.code === '42501') {
    return fail('forbidden', ctx.forbidden);
  }
  if (err.code === 'P0002') {
    return fail('not_found', ctx.notFound);
  }
  if (err.code === '23505') {
    return fail(
      'conflict',
      ctx.conflict ?? 'این کاربر قبلاً عضو فضای کاری است.',
    );
  }
  if (err.code === '22023' || err.code === '23514') {
    return fail('invalid_input', 'مقدار ارسالی معتبر نیست.');
  }
  // PostgREST cannot find the function — the migration is not applied.
  if (err.code === 'PGRST202' || /Could not find the function/i.test(message)) {
    return fail(
      'not_configured',
      'توابع مدیریت اعضا در پایگاه‌داده یافت نشد — مایگریشن اعضا را اجرا کنید.',
    );
  }

  console.warn('[workspace-members] Unmapped DB error:', err.code, message);
  return fail('server_error', 'خطا در پایگاه‌داده.');
}

/* =========================================================================
 * Validation
 * ========================================================================= */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Roles an owner/admin may hand out or assign. Owner is never assignable. */
const ASSIGNABLE_ROLES: readonly AppRole[] = [
  'admin',
  'member',
  'editor',
  'writer',
  'viewer',
] as const;

function parseRole(value: unknown): AppRole | null {
  if (typeof value !== 'string') return null;
  return ASSIGNABLE_ROLES.includes(value as AppRole) ? (value as AppRole) : null;
}

/** Minimal RFC-ish email check — the RPC re-validates with a LIKE pattern. */
function isEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

/**
 * Validate an incoming permission matrix.
 *
 * Returns null when invalid. Unknown module keys and unknown levels are
 * REJECTED here (not silently dropped like sanitizeMatrix does) so a typo in the
 * UI surfaces as an error instead of quietly becoming "no access".
 */
function parseMatrix(value: unknown): PermissionMatrix | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const out: PermissionMatrix = {};
  for (const [key, level] of Object.entries(value as Record<string, unknown>)) {
    if (!(MODULE_KEYS as string[]).includes(key)) return null;
    if (!(ACCESS_LEVELS as string[]).includes(level as string)) return null;
    out[key as keyof PermissionMatrix] = level as PermissionMatrix[keyof PermissionMatrix];
  }
  return out;
}

/* =========================================================================
 * Reads
 * ========================================================================= */

/**
 * List every member of a workspace with their role and permission matrix.
 *
 * Readable by ANY member of the workspace (not just owner/admin) — seeing who
 * else is on the team is normal, changing them is not. RLS already restricts
 * the query to the caller's own workspace.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<ServiceResult<WorkspaceMember[]>> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, permissions, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      return mapDbError(error, {
        forbidden: 'دسترسی به فهرست اعضا مجاز نیست.',
        notFound: 'فضای کاری یافت نشد.',
      });
    }

    const members = (data ?? []).map((row) => ({
      userId: String(row.user_id),
      role: row.role as AppRole,
      // Sanitise: the jsonb column is untrusted shape (fail closed).
      permissions: sanitizeMatrix(row.permissions),
      joinedAt: String(row.created_at),
    }));

    return ok(members);
  } catch (err) {
    console.warn('[workspace-members] Failed to list members:', err);
    return fail('server_error', 'خطا در خواندن فهرست اعضا.');
  }
}

/**
 * List invitations for a workspace.
 *
 * Callers gate this behind requireRole('owner','admin'); the storage policy
 * additionally allows any workspace member to read, but nothing in the API
 * exposes it to non-managers.
 */
export async function listWorkspaceInvitations(
  workspaceId: string,
): Promise<ServiceResult<WorkspaceInvitation[]>> {
  if (!appOrigin()) {
    return fail(
      'not_configured',
      'لینک‌های دعوت در دسترس نیست: تنظیم NEXT_PUBLIC_APP_URL روی محیط استقرار انجام نشده است.',
    );
  }
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select(
        'id, email, role, permissions, token, invited_by, status, expires_at, created_at, accepted_at',
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return mapDbError(error, {
        forbidden: 'دسترسی به فهرست دعوت‌ها مجاز نیست.',
        notFound: 'فضای کاری یافت نشد.',
      });
    }

    const invitations = (data ?? []).map((row) => ({
      id: String(row.id),
      email: String(row.email),
      role: row.role as AppRole,
      permissions: sanitizeMatrix(row.permissions),
      status: row.status as WorkspaceInvitationRow['status'],
      token: String(row.token),
      invitedBy: row.invited_by ? String(row.invited_by) : null,
      expiresAt: String(row.expires_at),
      createdAt: String(row.created_at),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
      acceptUrl: buildAcceptUrl(String(row.token)),
    }));

    return ok(invitations);
  } catch (err) {
    console.warn('[workspace-members] Failed to list invitations:', err);
    return fail('server_error', 'خطا در خواندن فهرست دعوت‌ها.');
  }
}

/**
 * Read the access-change history (newest first).
 *
 * `limit` is clamped so a client cannot ask for an unbounded scan.
 */
export async function listPermissionAudit(
  workspaceId: string,
  limit = 50,
): Promise<ServiceResult<PermissionAuditRow[]>> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('permission_audit')
      .select('id, workspace_id, actor_id, target_user_id, action, changes, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      return mapDbError(error, {
        forbidden: 'دسترسی به تاریخچه مجاز نیست.',
        notFound: 'فضای کاری یافت نشد.',
      });
    }

    return ok((data ?? []) as PermissionAuditRow[]);
  } catch (err) {
    console.warn('[workspace-members] Failed to read permission audit:', err);
    return fail('server_error', 'خطا در خواندن تاریخچه دسترسی.');
  }
}

/* =========================================================================
 * Mutations (all via SECURITY DEFINER RPCs)
 * ========================================================================= */

/**
 * Change a member's role and/or permission matrix.
 *
 * Either field may be omitted; passing both applies both. A no-op change is not
 * an error — the RPC reports `changed: false` and writes no audit row.
 *
 * The RPC refuses: targeting an owner, targeting yourself, admins promoting to
 * owner, and non-admin callers.
 */
export async function updateMemberAccess(
  targetUserId: unknown,
  input: { role?: unknown; permissions?: unknown },
): Promise<ServiceResult<{ changed: boolean }>> {
  if (!isUuid(targetUserId)) {
    return fail('invalid_input', 'شناسهٔ کاربر نامعتبر است.');
  }

  // At least one field must be supplied.
  const hasRole = input.role !== undefined && input.role !== null;
  const hasMatrix =
    input.permissions !== undefined && input.permissions !== null;
  if (!hasRole && !hasMatrix) {
    return fail('invalid_input', 'نقش یا ماتریس دسترسی را وارد کنید.');
  }

  let roleParam: string | null = null;
  if (hasRole) {
    const parsed = parseRole(input.role);
    if (!parsed) {
      return fail('invalid_input', 'نقش انتخابی معتبر نیست.');
    }
    roleParam = parsed;
  }

  let matrixParam: PermissionMatrix | null = null;
  if (hasMatrix) {
    const parsed = parseMatrix(input.permissions);
    if (!parsed) {
      return fail('invalid_input', 'ماتریس دسترسی معتبر نیست.');
    }
    matrixParam = parsed;
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('update_member_access', {
      p_target_user_id: targetUserId,
      // NULL = "leave this field alone" — the RPC only writes non-null fields.
      p_role: roleParam,
      p_permissions: matrixParam,
    });

    if (error) {
      return mapDbError(error, {
        forbidden:
          'تغییر دسترسی فقط برای مالک یا مدیر مجاز است و روی مالک یا خودتان اعمال نمی‌شود.',
        notFound: 'این کاربر عضو فضای کاری نیست.',
      });
    }

    const result = (data ?? {}) as { ok?: boolean; changed?: boolean };
    if (result.ok === false) {
      return fail('server_error', 'تغییر دسترسی انجام نشد.');
    }
    return ok({ changed: result.changed === true });
  } catch (err) {
    console.warn('[workspace-members] Failed to update member access:', err);
    return fail('server_error', 'خطا در تغییر دسترسی عضو.');
  }
}

/** Remove a member from the workspace (owner/admin only, via RPC). */
export async function removeWorkspaceMember(
  targetUserId: unknown,
): Promise<ServiceResult<{ removed: boolean }>> {
  if (!isUuid(targetUserId)) {
    return fail('invalid_input', 'شناسهٔ کاربر نامعتبر است.');
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('remove_workspace_member', {
      p_target_user_id: targetUserId,
    });

    if (error) {
      return mapDbError(error, {
        forbidden:
          'حذف عضو فقط برای مالک یا مدیر مجاز است؛ مالک و خودتان قابل حذف نیستید.',
        notFound: 'این کاربر عضو فضای کاری نیست.',
      });
    }

    return ok({ removed: data === true });
  } catch (err) {
    console.warn('[workspace-members] Failed to remove member:', err);
    return fail('server_error', 'خطا در حذف عضو.');
  }
}

/**
 * Create an invitation and return it WITH its accept link.
 *
 * There is no mail transport in this project (no SMTP provider, no mail SDK,
 * no mail env vars — verified), so this returns the token and the caller
 * surfaces the link for the owner to copy and send manually. `create_workspace_invitation`
 * returns only the invitation id, so the row is read back to obtain the token;
 * the SELECT policy permits that for workspace members.
 *
 * Refuses up front when no public origin is configured. Creating the row first
 * and failing afterwards would leave a pending invitation nobody can redeem,
 * so the misconfiguration is reported before anything is written.
 */
export async function createWorkspaceInvitation(
  input: { email?: unknown; role?: unknown; permissions?: unknown },
): Promise<ServiceResult<{ invitation: WorkspaceInvitation }>> {
  if (!isEmail(input.email)) {
    return fail('invalid_input', 'ایمیل معتبر وارد کنید.');
  }
  const email = String(input.email).trim().toLowerCase();

  if (!appOrigin()) {
    return fail(
      'not_configured',
      'لینک دعوت ساخته نشد: تنظیم NEXT_PUBLIC_APP_URL روی محیط استقرار انجام نشده است.',
    );
  }

  // Default to the most restricted role — the owner opts into more.
  const role = parseRole(input.role ?? 'member') ?? 'member';
  if (!parseRole(input.role ?? 'member')) {
    return fail('invalid_input', 'نقش انتخابی معتبر نیست.');
  }

  const matrix = parseMatrix(input.permissions ?? {}) ?? {};

  try {
    const supabase = await getSupabase();
    const { data: invitationId, error } = await supabase.rpc(
      'create_workspace_invitation',
      {
        p_email: email,
        p_role: role,
        p_permissions: matrix,
      },
    );

    if (error) {
      return mapDbError(error, {
        forbidden: 'دعوت عضو فقط برای مالک یا مدیر مجاز است.',
        notFound: 'فضای کاری یافت نشد.',
        conflict: 'این ایمیل قبلاً عضو فضای کاری است.',
      });
    }

    const id = String(invitationId);

    // Read the row back — the RPC returns the id, not the token.
    const { data: rows, error: readError } = await supabase
      .from('workspace_invitations')
      .select(
        'id, email, role, permissions, token, invited_by, status, expires_at, created_at, accepted_at',
      )
      .eq('id', id)
      .limit(1);

    if (readError) {
      console.warn('[workspace-members] Invite created but read-back failed:', readError);
      return fail('server_error', 'دعوت ایجاد شد اما لینک آن خوانده نشد.');
    }

    const row = rows?.[0];
    if (!row) {
      return fail('server_error', 'دعوت ایجاد شد اما لینک آن خوانده نشد.');
    }

    return ok({
      invitation: {
        id: String(row.id),
        email: String(row.email),
        role: row.role as AppRole,
        permissions: sanitizeMatrix(row.permissions),
        status: row.status as WorkspaceInvitationRow['status'],
        token: String(row.token),
        invitedBy: row.invited_by ? String(row.invited_by) : null,
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
        acceptUrl: buildAcceptUrl(String(row.token)),
      },
    });
  } catch (err) {
    console.warn('[workspace-members] Failed to create invitation:', err);
    return fail('server_error', 'خطا در ایجاد دعوت.');
  }
}

/**
 * Revoke a pending invitation.
 *
 * The RPC keys on the invitation ID; the route addresses it by token, so the
 * token is resolved to an id first.
 */
export async function revokeWorkspaceInvitation(
  token: unknown,
): Promise<ServiceResult<{ revoked: boolean }>> {
  if (typeof token !== 'string' || token.length < 8 || token.length > 128) {
    return fail('invalid_input', 'توکن دعوت معتبر نیست.');
  }

  try {
    const supabase = await getSupabase();

    // Resolve token -> invitation id (same workspace is enforced by RLS).
    const { data: rows, error: lookupError } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('token', token)
      .limit(1);

    if (lookupError) {
      return mapDbError(lookupError, {
        forbidden: 'لغو دعوت فقط برای مالک یا مدیر مجاز است.',
        notFound: 'دعوت یافت نشد.',
      });
    }

    const row = rows?.[0];
    if (!row) {
      return fail('not_found', 'دعوت یافت نشد.');
    }

    const { data, error } = await supabase.rpc('revoke_workspace_invitation', {
      p_invitation_id: String(row.id),
    });

    if (error) {
      return mapDbError(error, {
        forbidden: 'لغو دعوت فقط برای مالک یا مدیر مجاز است.',
        notFound: 'دعوت یافت نشد.',
      });
    }

    return ok({ revoked: data === true });
  } catch (err) {
    console.warn('[workspace-members] Failed to revoke invitation:', err);
    return fail('server_error', 'خطا در لغو دعوت.');
  }
}

/* =========================================================================
 * Invitation link
 * ========================================================================= */

/**
 * Public origin used to build invite links.
 *
 * ONLY NEXT_PUBLIC_APP_URL is trusted, deliberately. VERCEL_URL is NOT a
 * fallback: Vercel sets it to the URL of the deployment currently serving the
 * request, which for a branch build is an ephemeral preview host. Those preview
 * hosts sit behind Deployment Protection, so a link built from one bounces the
 * recipient through a Vercel login screen before they ever reach the app. A
 * single configured origin also means an owner working from a preview build and
 * an owner working from production produce byte-identical links.
 *
 * Returns '' when unset; callers treat that as a hard error rather than
 * emitting a link that cannot work.
 */
function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  console.error(
    `[workspace-members] NEXT_PUBLIC_APP_URL is not set, so invitation links cannot be built. ` +
      `Set it to the app's public origin (for example https://your-app.vercel.app) ` +
      `in the deployment environment. VERCEL_URL is intentionally not used as a fallback ` +
      `because it points at the current deployment, and preview deployments are behind ` +
      `Vercel Deployment Protection.`,
  );
  return '';
}

/**
 * Build the accept-invitation link shown to the owner for manual sharing.
 *
 * Returns '' when no public origin is configured. An empty result is a
 * misconfiguration, not a usable link — callers must surface it instead of
 * handing the owner a URL that goes nowhere.
 */
export function buildAcceptUrl(token: string): string {
  const origin = appOrigin();
  return origin ? `${origin}/invite/${token}` : '';
}
