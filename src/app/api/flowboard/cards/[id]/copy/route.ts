
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const original = await prisma.flowCard.findUnique({
      where: { id },
      include: {
        labels: true,
        checklists: {
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!original) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(original.boardId, user.id);

    // Get position: place copy right after original in the same list
    const maxPos = await prisma.flowCard.aggregate({
      where: { listId: original.listId },
      _max: { position: true },
    });
    const newPosition = (maxPos._max.position ?? original.position) + 1;

    // Create the copied card
    const copiedCard = await prisma.flowCard.create({
      data: {
        title: `${original.title} (copy)`,
        description: original.description,
        listId: original.listId,
        boardId: original.boardId,
        position: newPosition,
        priority: original.priority,
        startDate: original.startDate,
        dueDate: original.dueDate,
        coverColor: original.coverColor,
        coverImage: original.coverImage,
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

    // Add creator as member
    await prisma.flowCardMember.create({
      data: { cardId: copiedCard.id, userId: user.id },
    });

    // Copy labels
    if (original.labels.length > 0) {
      await prisma.flowCardLabel.createMany({
        data: original.labels.map((cl) => ({
          cardId: copiedCard.id,
          labelId: cl.labelId,
        })),
      });
    }

    // Copy checklists and their items
    for (const checklist of original.checklists) {
      const newChecklist = await prisma.flowChecklist.create({
        data: {
          title: checklist.title,
          cardId: copiedCard.id,
          position: checklist.position,
        },
      });

      if (checklist.items.length > 0) {
        await prisma.flowChecklistItem.createMany({
          data: checklist.items.map((item) => ({
            content: item.content,
            checklistId: newChecklist.id,
            position: item.position,
            isCompleted: false, // Reset completion for copy
          })),
        });
      }
    }

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: copiedCard.id,
        userId: user.id,
        type: "CARD_CREATED",
        content: `Copied from "${original.title}"`,
      },
    });

    return apiSuccess(copiedCard, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
