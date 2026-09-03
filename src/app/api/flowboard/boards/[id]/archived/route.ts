// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    // Fetch archived lists with their cards
    const archivedLists = await prisma.flowList.findMany({
      where: {
        boardId: id,
        isArchived: true,
      },
      include: {
        cards: {
          include: {
            _count: {
              select: { comments: true, checklists: true, attachments: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Fetch archived cards (not in archived lists)
    const archivedListIds = archivedLists.map((l) => l.id);
    const archivedCards = await prisma.flowCard.findMany({
      where: {
        boardId: id,
        isArchived: true,
        listId: { notIn: archivedListIds },
      },
      include: {
        list: { select: { id: true, title: true } },
        _count: {
          select: { comments: true, checklists: true, attachments: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess({
      lists: archivedLists.map((l) => ({
        id: l.id,
        title: l.title,
        cardCount: l.cards.length,
        updatedAt: l.updatedAt,
      })),
      cards: archivedCards.map((c) => ({
        id: c.id,
        title: c.title,
        listTitle: c.list.title,
        dueDate: c.dueDate,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
