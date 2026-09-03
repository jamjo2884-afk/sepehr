import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateChecklistItemSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const item = await prisma.flowChecklistItem.findUnique({
      where: { id },
      include: {
        checklist: {
          include: { card: { select: { boardId: true } } },
        },
      },
    });
    if (!item) return apiSuccess({ error: "Item not found" }, 404);

    await requireBoardAccess(item.checklist.card.boardId, user.id);

    const body = await request.json();
    const data = updateChecklistItemSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const updated = await prisma.flowChecklistItem.update({
      where: { id },
      data: updateData,
    });

    // Log if completed status changed
    if (data.isCompleted !== undefined) {
      const cardId = item.checklist.cardId;
      await prisma.flowActivity.create({
        data: {
          cardId,
          userId: user.id,
          type: "CHECKLIST_CHANGED",
          content: data.isCompleted
            ? `Checked off "${item.content}"`
            : `Unchecked "${item.content}"`,
        },
      });
    }

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
    const item = await prisma.flowChecklistItem.findUnique({
      where: { id },
      include: {
        checklist: {
          include: { card: { select: { boardId: true } } },
        },
      },
    });
    if (!item) return apiSuccess({ error: "Item not found" }, 404);

    await requireBoardAccess(item.checklist.card.boardId, user.id);

    await prisma.flowChecklistItem.delete({ where: { id } });

    return apiSuccess({ message: "Item deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
