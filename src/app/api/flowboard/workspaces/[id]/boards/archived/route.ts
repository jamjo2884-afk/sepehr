
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireWorkspaceMember(id, user.id);

    const boards = await prisma.flowBoard.findMany({
      where: {
        workspaceId: id,
        isArchived: true,
      },
      include: {
        _count: {
          select: { lists: true, members: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess(
      boards.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        backgroundColor: b.backgroundColor,
        listCount: b._count.lists,
        memberCount: b._count.members,
        updatedAt: b.updatedAt,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
