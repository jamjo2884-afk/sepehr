import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateCommentSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, apiForbidden, handleApiError } from "@/lib/flowboard/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const comment = await prisma.flowComment.findUnique({
      where: { id },
      include: { card: { select: { boardId: true } } },
    });

    if (!comment) return apiSuccess({ error: "Comment not found" }, 404);
    if (comment.authorId !== user.id) return apiForbidden();

    await requireBoardAccess(comment.card.boardId, user.id);

    const body = await request.json();
    const data = updateCommentSchema.parse(body);

    const updated = await prisma.flowComment.update({
      where: { id },
      data: { content: data.content, isEdited: true },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const comment = await prisma.flowComment.findUnique({
      where: { id },
      include: { card: { select: { boardId: true } } },
    });

    if (!comment) return apiSuccess({ error: "Comment not found" }, 404);
    if (comment.authorId !== user.id) return apiForbidden();

    await requireBoardAccess(comment.card.boardId, user.id);

    await prisma.flowComment.delete({ where: { id } });

    return apiSuccess({ message: "Comment deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
