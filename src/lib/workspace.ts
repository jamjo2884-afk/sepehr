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
  /** The active workspace ID. */
  workspaceId: string;
  /** The user's role in this workspace. */
  role: string;
  /**
   * The actual uuid row id when workspaceId is a canonical label rather than a
   * uuid (guest mode). Regular workspaces use the uuid as workspaceId itself.
   */
  workspaceUuid?: string;
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
  // the guest has no workspace_members row. Data scoping happens in the DB
  // via the anon-RLS policies on the seeded demo workspace uuid.
  const {
    isGuestUser,
    GUEST_ROLE,
    GUEST_USER_ID,
    GUEST_WORKSPACE_ID,
    GUEST_WORKSPACE_UUID,
  } = await import('@/lib/guest-mode');
  if (isGuestUser(user)) {
    return {
      userId: GUEST_USER_ID,
      workspaceId: GUEST_WORKSPACE_ID,
      role: GUEST_ROLE,
      workspaceUuid: GUEST_WORKSPACE_UUID,
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
