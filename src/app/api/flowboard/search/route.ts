import { NextRequest } from 'next/server';
import { prisma } from '@/lib/flowboard/db';
import { getCurrentUser } from '@/lib/flowboard/auth';
import { apiSuccess, apiUnauthorized, handleApiError } from '@/lib/flowboard/api-utils';

/**
 * Global search across the current user's workspaces.
 *
 * Authorization model (Media Deck):
 *  - An unauthenticated request is rejected (401).
 *  - Results are always scoped to the workspaces the authenticated user
 *    belongs to. A `workspaceId` query param is only honored when the user
 *    is a member of that workspace — otherwise no data from it is returned.
 *  - Boards/cards searched must live in one of those workspaces; members
 *    are users of those workspaces.
 *
 * Ported from the standalone FlowBoard `/api/search` route, adapted to
 * `flow_*` Prisma models, PostgreSQL case-insensitive matching, and the
 * Media Deck auth bridge. No SQLite references.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const workspaceId = searchParams.get("workspaceId");

    if (!query.trim()) {
      return apiSuccess({ boards: [], cards: [], labels: [], members: [] });
    }

    const searchQuery = query.trim();

    // Workspaces the authenticated user belongs to (authorization source).
    const memberships = await prisma.flowWorkspaceMember.findMany({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const memberWorkspaceIds = memberships.map((m) => m.workspaceId);

    // A requested workspace is searched only if the user is a member of it.
    // Requesting a workspace the user cannot access yields an empty scope
    // (no data leak, no error).
    const targetWorkspaces = workspaceId
      ? memberWorkspaceIds.includes(workspaceId)
        ? [workspaceId]
        : []
      : memberWorkspaceIds;

    // Boards
    const boards = await prisma.flowBoard.findMany({
      where: {
        workspaceId: { in: targetWorkspaces },
        isArchived: false,
        title: { contains: searchQuery, mode: "insensitive" },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });

    // Cards (title + description)
    const boardIds = (
      await prisma.flowBoard.findMany({
        where: { workspaceId: { in: targetWorkspaces } },
        select: { id: true },
      })
    ).map((b) => b.id);

    const cards = await prisma.flowCard.findMany({
      where: {
        boardId: { in: boardIds },
        isArchived: false,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      include: {
        list: { select: { title: true } },
        board: { select: { id: true, title: true } },
        labels: {
          include: { label: { select: { id: true, name: true, color: true } } },
        },
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    // Labels (workspace-level)
    const labels = await prisma.flowLabel.findMany({
      where: {
        workspaceId: { in: targetWorkspaces },
        name: { contains: searchQuery, mode: "insensitive" },
      },
      take: 10,
    });

    // Members: users belonging to the same workspaces
    const memberUserIds = (
      await prisma.flowWorkspaceMember.findMany({
        where: { workspaceId: { in: targetWorkspaces } },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    const members = await prisma.flowUser.findMany({
      where: {
        id: { in: memberUserIds },
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 10,
    });

    return apiSuccess({ boards, cards, labels, members });
  } catch (error) {
    return handleApiError(error);
  }
}