import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createCardSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    const body = await request.json();
    const data = createCardSchema.parse(body);

    // Verify list belongs to this board
    const list = await prisma.flowList.findFirst({
      where: { id: data.listId, boardId: id },
    });

    if (!list) {
      return apiSuccess({ error: "List not found on this board" }, 400);
    }

    // Get max position in list
    const maxPos = await prisma.flowCard.aggregate({
      where: { listId: data.listId },
      _max: { position: true },
    });

    const card = await prisma.flowCard.create({
      data: {
        title: data.title,
        description: data.description,
        listId: data.listId,
        boardId: id,
        position: data.position ?? ((maxPos._max.position ?? -1) + 1),
        priority: data.priority ?? "NONE",
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        coverColor: data.coverColor,
        coverImage: data.coverImage,
        createdBy: user.id,
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        labels: { include: { label: true } },
        _count: {
          select: { comments: true, attachments: true, checklists: true },
        },
      },
    });

    // Auto-add creator as member
    await prisma.flowCardMember.create({
      data: { cardId: card.id, userId: user.id },
    });

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: card.id,
        userId: user.id,
        type: "CARD_CREATED",
        content: `Created card "${card.title}"`,
      },
    });

    return apiSuccess(card, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
