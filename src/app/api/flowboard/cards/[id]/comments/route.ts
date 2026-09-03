import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createCommentSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const comments = await prisma.flowComment.findMany({
      where: { cardId: id },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(comments);
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const data = createCommentSchema.parse(body);

    const comment = await prisma.flowComment.create({
      data: {
        content: data.content,
        cardId: id,
        authorId: user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: id,
        userId: user.id,
        type: "COMMENT_ADDED",
        content: "Added a comment",
      },
    });

    return apiSuccess(comment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
