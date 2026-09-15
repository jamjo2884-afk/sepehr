/**
 * FlowBoard Workspace Resolution
 *
 * Deterministic active-workspace selection for the Tasks/FlowBoard UI.
 *
 * History: every Tasks page used `session.workspaces[0]`, and the session
 * lists memberships oldest-first. Once a user had more than one workspace
 * (e.g. the historical `demo-workspace-000` next to their real workspace),
 * the UI silently showed the OLDEST one — the user's real boards/cards
 * appeared to "disappear". No data was lost; the selection was wrong.
 *
 * Rule (deterministic, no hardcoding):
 * 1. The Media Deck current workspace (workspace_members) wins when the user
 *    is a member of the matching FlowBoard workspace — Media Deck is the
 *    product's source of truth for "where am I".
 * 2. Otherwise the user's NEWEST FlowBoard workspace membership wins
 *    (latest workspace.createdAt), which matches how workspaces are created:
 *    the one you just created is the one you want to see.
 * 3. Never "whatever happens to sort first".
 */

import { prisma } from '@/lib/flowboard/db';

export interface FlowWorkspaceSummary {
  id: string;
  name?: string;
  slug?: string;
  role?: string;
  createdAt?: string | Date;
}

/**
 * Resolve the active FlowBoard workspace for a user.
 *
 * @param mdWorkspaceId Media Deck's current workspace id (from
 *        `getCurrentWorkspace()`), or null in demo/unauthenticated mode.
 * @param userId FlowBoard user id.
 * @param workspaces The session's workspace list (any order).
 * @returns The active workspace id, or null when the user has no workspace.
 */
export async function resolveActiveWorkspaceId(
  mdWorkspaceId: string | null | undefined,
  userId: string,
  workspaces: FlowWorkspaceSummary[],
): Promise<string | null> {
  if (workspaces.length === 0) return null;

  // 1. Media Deck's current workspace, if the user belongs to it here too.
  if (mdWorkspaceId) {
    const match = workspaces.find((w) => w.id === mdWorkspaceId);
    if (match) return match.id;
    // Double-check membership (covers callers that pass a partial list).
    const member = await prisma.flowWorkspaceMember.findFirst({
      where: { workspaceId: mdWorkspaceId, userId },
      select: { workspaceId: true },
    });
    if (member) return mdWorkspaceId;
  }

  // 2. Newest workspace membership.
  const newest = [...workspaces].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  })[0];
  return newest.id;
}

/**
 * Client-side companion: pick the active workspace from a session response.
 * Prefers the server-provided `activeWorkspaceId`, falls back to the newest
 * workspace (session responses are ordered oldest-first).
 */
export function pickActiveWorkspace<
  T extends { id: string; createdAt?: string },
>(workspaces: T[], activeWorkspaceId?: string | null): T | null {
  if (workspaces.length === 0) return null;
  if (activeWorkspaceId) {
    const match = workspaces.find((w) => w.id === activeWorkspaceId);
    if (match) return match;
  }
  return [...workspaces].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  })[0];
}
