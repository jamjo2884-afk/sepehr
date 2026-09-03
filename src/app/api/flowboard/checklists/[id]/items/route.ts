import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createChecklistItemSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function POST(
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
    const data = createChecklistItemSchema.parse(body);

    const maxPos = await prisma.flowChecklistItem.aggregate({
      where: { checklistId: id },
      _max: { position: true },
    });

    const item = await prisma.flowChecklistItem.create({
      data: {
        content: data.content,
        checklistId: id,
        position: (maxPos._max.position ?? -1) + 1,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
