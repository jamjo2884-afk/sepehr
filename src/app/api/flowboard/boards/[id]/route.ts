import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateBoardSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    const board = await prisma.flowBoard.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        _count: {
          select: { lists: true },
        },
      },
    });

    if (!board) return apiNotFound("Board");

    return apiSuccess(board);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    const body = await request.json();
    const data = updateBoardSchema.parse(body);

    const board = await prisma.flowBoard.update({
      where: { id },
      data,
    });

    return apiSuccess(board);
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
    const member = await requireBoardAccess(id, user.id);

    // Only board admin or workspace owner can delete
    if (member.role !== "ADMIN" && member.role !== "OWNER") {
      return apiNotFound("Board");
    }

    await prisma.flowBoard.delete({ where: { id } });

    return apiSuccess({ message: "Board deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
