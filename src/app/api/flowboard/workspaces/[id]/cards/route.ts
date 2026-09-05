
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

/**
 * GET /api/workspaces/[id]/cards
 * Returns all non-archived cards across all boards in a workspace.
 * Used by Calendar, Table, and Dashboard views.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireWorkspaceMember(id, user.id);

    const cards = await prisma.flowCard.findMany({
      where: {
        board: {
          workspaceId: id,
          isArchived: false,
        },
        isArchived: false,
      },
      include: {
        list: { select: { id: true, title: true } },
        board: { select: { id: true, title: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        labels: {
          include: { label: true },
        },
        _count: {
          select: { comments: true, checklists: true, attachments: true },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    // Also get aggregate stats for dashboard
    const boardIds = (
      await prisma.flowBoard.findMany({
        where: { workspaceId: id, isArchived: false },
        select: { id: true },
      })
    ).map((b) => b.id);

    const [totalCards, completedCards, overdueCards, cardsByList, cardsByPriority] = await Promise.all([
      prisma.flowCard.count({
        where: { boardId: { in: boardIds }, isArchived: false },
      }),
      prisma.flowCard.count({
        where: { boardId: { in: boardIds }, isArchived: false, isCompleted: true },
      }),
      prisma.flowCard.count({
        where: {
          boardId: { in: boardIds },
          isArchived: false,
          isCompleted: false,
          dueDate: { lt: new Date() },
        },
      }),
      prisma.flowList.findMany({
        where: { boardId: { in: boardIds }, isArchived: false },
        select: {
          id: true,
          title: true,
          _count: { select: { cards: { where: { isArchived: false } } } },
        },
        orderBy: { position: "asc" },
      }),
      prisma.flowCard.groupBy({
        by: ["priority"],
        where: { boardId: { in: boardIds }, isArchived: false },
        _count: true,
      }),
    ]);

    return apiSuccess({
      cards,
      stats: {
        totalCards,
        completedCards,
        overdueCards,
        completionRate: totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0,
        cardsByList: cardsByList.map((l) => ({
          listId: l.id,
          title: l.title,
          count: l._count.cards,
        })),
        cardsByPriority: cardsByPriority.map((p) => ({
          priority: p.priority,
          count: p._count,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
