
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember } from "@/lib/flowboard/auth";
import { createBoardSchema } from "@/lib/flowboard/validations";
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
        isArchived: false,
      },
      include: {
        _count: {
          select: { lists: true, members: true },
        },
        members: {
          where: { userId: user.id },
        },
      },
      orderBy: [{ isFavorited: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    });

    return apiSuccess(
      boards.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        backgroundColor: b.backgroundColor,
        backgroundImage: b.backgroundImage,
        position: b.position,
        isFavorited: b.isFavorited,
        listCount: b._count.lists,
        memberCount: b._count.members,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }))
    );
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
    await requireWorkspaceMember(id, user.id);

    const body = await request.json();
    const data = createBoardSchema.parse(body);

    // Get max position
    const maxPos = await prisma.flowBoard.aggregate({
      where: { workspaceId: id },
      _max: { position: true },
    });

    const board = await prisma.flowBoard.create({
      data: {
        title: data.title,
        description: data.description,
        backgroundColor: data.backgroundColor,
        backgroundImage: data.backgroundImage,
        workspaceId: id,
        ownerId: user.id,
        position: (maxPos._max.position ?? -1) + 1,
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
      },
    });

    return apiSuccess(board, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
