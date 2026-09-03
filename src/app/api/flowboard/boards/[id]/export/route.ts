// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
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

    const board = await prisma.flowBoard.findUnique({
      where: { id },
      include: {
        lists: {
          where: { isArchived: false },
          include: {
            cards: {
              where: { isArchived: false },
              include: {
                members: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
                labels: {
                  include: { label: true },
                },
                checklists: {
                  include: { items: true },
                },
                comments: {
                  include: {
                    author: { select: { id: true, name: true } },
                  },
                },
              },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
        labels: {
          include: { label: true },
        },
      },
    });

    if (!board) return apiSuccess({ error: "Board not found" }, 404);

    return apiSuccess({
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      board: {
        title: board.title,
        description: board.description,
        backgroundColor: board.backgroundColor,
        backgroundImage: board.backgroundImage,
        lists: board.lists.map((list) => ({
          title: list.title,
          position: list.position,
          cards: list.cards.map((card) => ({
            title: card.title,
            description: card.description,
            position: card.position,
            priority: card.priority,
            dueDate: card.dueDate,
            startDate: card.startDate,
            coverColor: card.coverColor,
            labels: card.labels.map((cl) => ({
              name: cl.label.name,
              color: cl.label.color,
            })),
            members: card.members.map((cm) => ({
              name: cm.user.name,
              email: cm.user.email,
            })),
            checklists: card.checklists.map((cl) => ({
              title: cl.title,
              items: cl.items.map((item) => ({
                content: item.content,
                isCompleted: item.isCompleted,
              })),
            })),
            comments: card.comments.map((c) => ({
              author: c.author.name,
              content: c.content,
              createdAt: c.createdAt,
            })),
          })),
        })),
        labels: board.labels.map((bl) => ({
          name: bl.label.name,
          color: bl.label.color,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
