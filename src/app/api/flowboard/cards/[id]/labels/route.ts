import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
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

    const { labelId } = await request.json();

    // Check if label already exists on this card
    const existing = await prisma.flowCardLabel.findUnique({
      where: { cardId_labelId: { cardId: id, labelId } },
    });

    if (existing) {
      return apiSuccess({ message: "Label already on card" });
    }

    await prisma.flowCardLabel.create({
      data: { cardId: id, labelId },
    });

    const label = await prisma.flowLabel.findUnique({ where: { id: labelId } });
    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "LABEL_ADDED",
        content: `Added label "${label?.name}"`,
      },
    });

    return apiSuccess({ message: "Label added" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
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

    const { labelId } = await request.json();

    await prisma.flowCardLabel.deleteMany({
      where: { cardId: id, labelId },
    });

    return apiSuccess({ message: "Label removed" });
  } catch (error) {
    return handleApiError(error);
  }
}
