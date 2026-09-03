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
    const list = await prisma.flowList.findUnique({ where: { id } });
    if (!list) return apiNotFound("List");

    await requireBoardAccess(list.boardId, user.id);

    const { archive } = await request.json();
    const isArchived = typeof archive === "boolean" ? archive : !list.isArchived;

    const updated = await prisma.flowList.update({
      where: { id },
      data: { isArchived },
    });

    return apiSuccess({ isArchived: updated.isArchived });
  } catch (error) {
    return handleApiError(error);
  }
}
