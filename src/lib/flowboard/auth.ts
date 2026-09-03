/**
 * FlowBoard Auth Adapter
 *
 * Bridges FlowBoard's auth expectations to Media Deck's auth system.
 * In demo mode (which is Media Deck's current mode), returns a synthetic user
 * and ensures the required workspace exists in the FlowBoard database.
 */
import { prisma as flowPrisma } from "./db";

const DEMO_USER_ID = "demo-user-000";
const DEMO_WORKSPACE_ID = "demo-workspace-000";
const DEMO_USER_EMAIL = "demo@mediadeck.local";
const DEMO_USER_NAME = "Developer";

export interface FlowBoardUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Get the current user for FlowBoard operations.
 * Uses Media Deck's auth system to determine the user identity,
 * then ensures the user exists in FlowBoard's Prisma database.
 */
export async function getCurrentUser(): Promise<FlowBoardUser | null> {
  try {
    // Import Media Deck's auth system
    const { getAuthUser, isDemoMode } = await import("@/lib/auth");
    const mdUser = await getAuthUser();
    
    if (!mdUser) return null;

    // In demo mode, use the demo user
    const userId = isDemoMode() ? DEMO_USER_ID : mdUser.id;
    const email = isDemoMode() ? DEMO_USER_EMAIL : mdUser.email;
    const name = isDemoMode() ? DEMO_USER_NAME : mdUser.email.split("@")[0];

    // Ensure user exists in FlowBoard database
    let user = await flowPrisma.flowUser.findUnique({ where: { id: userId } });
    if (!user) {
      user = await flowPrisma.flowUser.create({
        data: {
          id: userId,
          email,
          name,
          passwordHash: "",
        },
      });
    }

    // Ensure demo workspace exists
    if (isDemoMode()) {
      await devEnsureWorkspace(userId);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    // A missing Media Deck user is the only "unauthorized" case (handled above
    // via the `if (!mdUser) return null;` guard). Every other failure — an
    // unreachable database, a provisioning error — must surface as a server
    // error instead of being masked as 401.
    console.warn("[flowboard/auth] Error resolving current user:", err);
    throw err;
  }
}

/**
 * Require authentication — returns user or throws.
 */
export async function requireAuth(): Promise<FlowBoardUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Ensure the demo workspace exists in FlowBoard's database.
 */
async function devEnsureWorkspace(userId: string) {
  let ws = await flowPrisma.flowWorkspace.findUnique({
    where: { id: DEMO_WORKSPACE_ID },
  });
  if (!ws) {
    ws = await flowPrisma.flowWorkspace.create({
      data: {
        id: DEMO_WORKSPACE_ID,
        name: "Default Workspace",
        slug: "default",
        ownerId: userId,
      },
    });
  }

  const member = await flowPrisma.flowWorkspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: DEMO_WORKSPACE_ID,
        userId,
      },
    },
  });
  if (!member) {
    await flowPrisma.flowWorkspaceMember.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        userId,
        role: "OWNER",
      },
    });
  }
}

// ============================================================
// Workspace Authorization
// ============================================================

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  return flowPrisma.flowWorkspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const member = await getWorkspaceMember(workspaceId, userId);
  if (!member) {
    throw new Error("Not a member of this workspace");
  }
  return member;
}

export async function requireWorkspaceAdmin(workspaceId: string, userId: string) {
  const member = await requireWorkspaceMember(workspaceId, userId);
  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    throw new Error("Insufficient permissions");
  }
  return member;
}

export async function requireWorkspaceOwner(workspaceId: string, userId: string) {
  const member = await requireWorkspaceMember(workspaceId, userId);
  if (member.role !== "OWNER") {
    throw new Error("Only the workspace owner can perform this action");
  }
  return member;
}

// ============================================================
// Board Authorization
// ============================================================

export async function getBoardMember(boardId: string, userId: string) {
  const board = await flowPrisma.flowBoard.findUnique({
    where: { id: boardId },
    include: {
      workspace: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!board) return null;

  // Check board-level membership first
  const boardMember = await flowPrisma.flowBoardMember.findUnique({
    where: {
      boardId_userId: {
        boardId,
        userId,
      },
    },
  });

  if (boardMember) return boardMember;

  // Check workspace membership
  const wsMember = board.workspace.members[0];
  return wsMember || null;
}

export async function requireBoardAccess(boardId: string, userId: string) {
  const member = await getBoardMember(boardId, userId);
  if (!member) {
    throw new Error("No access to this board");
  }
  return member;
}
