import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { updateCardSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({
      where: { id },
      include: {
        list: { select: { id: true, title: true } },
        board: { select: { id: true, title: true, workspaceId: true } },
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        labels: {
          include: { label: true },
        },
        checklists: {
          include: {
            items: {
              include: {
                assignee: { select: { id: true, name: true, avatarUrl: true } },
              },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
        comments: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        watchers: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!card) return apiNotFound("Card");

    await requireBoardAccess(card.boardId, user.id);

    return apiSuccess(card);
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
    const existingCard = await prisma.flowCard.findUnique({ where: { id } });
    if (!existingCard) return apiNotFound("Card");

    await requireBoardAccess(existingCard.boardId, user.id);

    const body = await request.json();
    const data = updateCardSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    const card = await prisma.flowCard.update({
      where: { id },
      data: updateData,
    });

    // Log activity for key changes
    const changes: string[] = [];
    if (data.title && data.title !== existingCard.title) changes.push(`renamed to "${data.title}"`);
    if (data.listId && data.listId !== existingCard.listId) changes.push("moved to another list");
    if (data.priority && data.priority !== existingCard.priority) changes.push(`priority changed to ${data.priority}`);
    if (data.dueDate !== undefined) changes.push(`due date ${data.dueDate ? "set" : "removed"}`);
    if (data.isArchived !== undefined) changes.push(data.isArchived ? "archived" : "unarchived");
    if (data.isCompleted !== undefined) changes.push(data.isCompleted ? "completed" : "marked incomplete");

    if (changes.length > 0) {
      await prisma.flowActivity.create({
        data: {
          cardId: id,
          userId: user.id,
          type: "CARD_EDITED",
          content: changes.join("; "),
        },
      });
    }

    return apiSuccess(card);
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
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiNotFound("Card");

    await requireBoardAccess(card.boardId, user.id);

    await prisma.flowCard.delete({ where: { id } });

    return apiSuccess({ message: "Card deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
