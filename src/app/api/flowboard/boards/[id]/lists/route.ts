import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createListSchema, reorderListsSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    const lists = await prisma.flowList.findMany({
      where: {
        boardId: id,
        isArchived: false,
      },
      include: {
        cards: {
          where: { isArchived: false },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
              },
            },
            labels: {
              include: { label: true },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
                checklists: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
        _count: {
          select: { cards: true },
        },
      },
      orderBy: { position: "asc" },
    });

    return apiSuccess(lists);
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
    await requireBoardAccess(id, user.id);

    const body = await request.json();
    const data = createListSchema.parse(body);

    // Get max position
    const maxPos = await prisma.flowList.aggregate({
      where: { boardId: id },
      _max: { position: true },
    });

    const list = await prisma.flowList.create({
      data: {
        title: data.title,
        boardId: id,
        position: data.position ?? ((maxPos._max.position ?? -1) + 1),
      },
    });

    return apiSuccess(list, 201);
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
    const data = reorderListsSchema.parse(body);

    // Batch update positions
    await prisma.$transaction(
      data.lists.map((item) =>
        prisma.flowList.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );

    return apiSuccess({ message: "Lists reordered" });
  } catch (error) {
    return handleApiError(error);
  }
}
