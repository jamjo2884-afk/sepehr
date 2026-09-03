import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { moveCardSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const body = await request.json();
    const data = moveCardSchema.parse(body);

    const oldListId = card.listId;
    const oldPosition = card.position;

    // Move card within same list
    if (oldListId === data.listId) {
      if (data.position > oldPosition) {
        // Moving down: shift cards up
        await prisma.flowCard.updateMany({
          where: {
            listId: data.listId,
            position: { gt: oldPosition, lte: data.position },
            id: { not: id },
          },
          data: {
            position: { decrement: 1 },
          },
        });
      } else if (data.position < oldPosition) {
        // Moving up: shift cards down
        await prisma.flowCard.updateMany({
          where: {
            listId: data.listId,
            position: { gte: data.position, lt: oldPosition },
            id: { not: id },
          },
          data: {
            position: { increment: 1 },
          },
        });
      }
    } else {
      // Moving to different list
      // Close gap in source list
      await prisma.flowCard.updateMany({
        where: {
          listId: oldListId,
          position: { gt: oldPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // Make space in target list
      await prisma.flowCard.updateMany({
        where: {
          listId: data.listId,
          position: { gte: data.position },
        },
        data: {
          position: { increment: 1 },
        },
      });
    }

    // Update the card
    const updated = await prisma.flowCard.update({
      where: { id },
      data: {
        listId: data.listId,
        position: data.position,
      },
    });

    // Log activity
    if (oldListId !== data.listId) {
      const targetList = await prisma.flowList.findUnique({
        where: { id: data.listId },
        select: { title: true },
      });

      await prisma.flowActivity.create({
        data: {
          cardId: id,
          userId: user.id,
          type: "CARD_MOVED",
          content: `Moved card to "${targetList?.title ?? "unknown list"}"`,
          metadata: JSON.stringify({ fromListId: oldListId, toListId: data.listId }),
        },
      });
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
