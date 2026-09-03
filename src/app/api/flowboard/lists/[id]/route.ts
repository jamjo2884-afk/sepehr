import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateListSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const list = await prisma.flowList.findUnique({ where: { id } });
    if (!list) return apiSuccess({ error: "List not found" }, 404);

    await requireBoardAccess(list.boardId, user.id);

    const body = await request.json();
    const data = updateListSchema.parse(body);

    const updated = await prisma.flowList.update({
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
    const list = await prisma.flowList.findUnique({ where: { id } });
    if (!list) return apiSuccess({ error: "List not found" }, 404);

    await requireBoardAccess(list.boardId, user.id);

    // Archive instead of delete
    await prisma.flowList.update({
      where: { id },
      data: { isArchived: true },
    });

    return apiSuccess({ message: "List archived" });
  } catch (error) {
    return handleApiError(error);
  }
}
