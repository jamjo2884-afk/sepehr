/**
 * Workspace Resolver
 *
 * Centralizes the logic for resolving the current user's workspace.
 * All API routes should use this instead of duplicating workspace lookup.
 *
 * Demo mode: returns a synthetic workspace ID (no real DB access).
 * Auth mode: queries workspace_members to find the user's workspaces.
 */

export interface WorkspaceContext {
  /** The current user's ID (auth.uid or demo user). */
  userId: string;
  /**
   * The active workspace ID. For the guest this is the fixed demo-workspace
   * UUID (GUEST_WORKSPACE_UUID) — the actual row id used by every
   * `.eq('workspace_id', …)` filter, matching the anon RLS policies. Regular
   * workspaces use their uuid membership row directly.
   */
  workspaceId: string;
  /** The user's role in this workspace. */
  role: string;
}

const DEMO_WORKSPACE_ID = 'demo-workspace-000';

/**
 * Get the current user's workspace context.
 *
 * Returns null if:
 * - Supabase is configured but user has no session
 * - User is not a member of any workspace
 */
export async function getCurrentWorkspace(): Promise<WorkspaceContext | null> {
  const { getAuthUser } = await import('@/lib/auth');
  const user = await getAuthUser();
  if (!user) return null;

  // Guest mode: return the dedicated demo workspace without any DB lookup —
  // the guest has no workspace_members row. workspaceId is the fixed demo
  // workspace UUID (GUEST_WORKSPACE_UUID), so every service-level
  // `.eq('workspace_id', …)` filter targets exactly the seeded demo rows and
  // matches the anon RLS policies. No request input can influence it.
  const {
    isGuestUser,
    GUEST_ROLE,
    GUEST_USER_ID,
    GUEST_WORKSPACE_UUID,
  } = await import('@/lib/guest-mode');
  if (isGuestUser(user)) {
    return {
      userId: GUEST_USER_ID,
      workspaceId: GUEST_WORKSPACE_UUID,
      role: GUEST_ROLE,
    };
  }

  // Demo mode: return synthetic workspace
  if (user.id === 'demo-user-000') {
    return {
      userId: user.id,
      workspaceId: DEMO_WORKSPACE_ID,
      role: 'owner',
    };
  }

  // Real mode: look up workspace membership
  try {
    const { createSupabaseServerClient } =
      await import('@/lib/supabase-server');
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (error || !data) {
      console.warn(
        '[workspace] No workspace membership found for user:',
        user.id,
      );
      return null;
    }

    return {
      userId: user.id,
      workspaceId: data.workspace_id,
      role: data.role,
    };
  } catch {
    return null;
  }
}

/**
 * Require workspace context — returns workspace or sends 401/403.
 *
 * Usage:
 *   const ws = await requireWorkspace();
 *   if ('error' in ws) return ws.error;
 *   // ws.workspaceId is the current workspace
 */
export async function requireWorkspace(): Promise<
  WorkspaceContext | { error: import('next/server').NextResponse }
> {
  const { NextResponse } = await import('next/server');
  const ctx = await getCurrentWorkspace();
  if (!ctx) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'فضای کاری یافت نشد.' },
        { status: 403 },
      ),
    };
  }
  return ctx;
}

/**
 * Check if a record belongs to the user's workspace.
 * Useful for IDOR prevention in API routes.
 */
export async function isOwnedByWorkspace(
  recordWorkspaceId: string,
): Promise<boolean> {
  const ctx = await getCurrentWorkspace();
  if (!ctx) return false;
  return ctx.workspaceId === recordWorkspaceId;
}
