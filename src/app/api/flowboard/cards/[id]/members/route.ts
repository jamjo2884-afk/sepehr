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

    const { userId } = await request.json();

    await prisma.flowCardMember.upsert({
      where: { cardId_userId: { cardId: id, userId } },
      create: { cardId: id, userId },
      update: {},
    });

    // Log activity
    const member = await prisma.flowUser.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "MEMBER_ASSIGNED",
        content: `Assigned ${member?.name ?? "member"}`,
      },
    });

    return apiSuccess({ message: "Member added" });
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

    const { userId } = await request.json();

    await prisma.flowCardMember.deleteMany({
      where: { cardId: id, userId },
    });

    return apiSuccess({ message: "Member removed" });
  } catch (error) {
    return handleApiError(error);
  }
}
