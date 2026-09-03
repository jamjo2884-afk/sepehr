import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiNotFound("Card");

    await requireBoardAccess(card.boardId, user.id);

    const { archive } = await request.json();
    const isArchived = typeof archive === "boolean" ? archive : !card.isArchived;

    const updated = await prisma.flowCard.update({
      where: { id },
      data: { isArchived },
    });

    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "CARD_EDITED",
        content: isArchived ? "Archived card" : "Restored card from archive",
      },
    });

    return apiSuccess({ isArchived: updated.isArchived });
  } catch (error) {
    return handleApiError(error);
  }
}
