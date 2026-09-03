import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateChecklistSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const checklist = await prisma.flowChecklist.findUnique({
      where: { id },
      include: { card: { select: { boardId: true } } },
    });
    if (!checklist) return apiSuccess({ error: "Checklist not found" }, 404);

    await requireBoardAccess(checklist.card.boardId, user.id);

    const body = await request.json();
    const data = updateChecklistSchema.parse(body);

    const updated = await prisma.flowChecklist.update({
      where: { id },
      data,
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
    const checklist = await prisma.flowChecklist.findUnique({
      where: { id },
      include: { card: { select: { boardId: true } } },
    });
    if (!checklist) return apiSuccess({ error: "Checklist not found" }, 404);

    await requireBoardAccess(checklist.card.boardId, user.id);

    await prisma.flowChecklist.delete({ where: { id } });

    return apiSuccess({ message: "Checklist deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
