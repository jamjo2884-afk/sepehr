
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";
import { z } from "zod";

const saveTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({
      where: { id },
      include: {
        labels: { include: { label: true } },
        checklists: {
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
        board: { select: { workspaceId: true } },
      },
    });

    if (!card) return apiNotFound("Card");
    await requireBoardAccess(card.boardId, user.id);

    const body = await request.json();
    const data = saveTemplateSchema.parse(body);

    // Build labels JSON
    const labelsJson = JSON.stringify(
      card.labels.map((cl) => ({ name: cl.label.name, color: cl.label.color }))
    );

    // Build checklists JSON
    const checklistsJson = JSON.stringify(
      card.checklists.map((cl) => ({
        title: cl.title,
        items: cl.items.map((item) => ({ content: item.content })),
      }))
    );

    const template = await prisma.flowCardTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: user.id,
        workspaceId: card.board.workspaceId,
        title: card.title,
        cardDesc: card.description,
        priority: card.priority,
        coverColor: card.coverColor,
        labels: labelsJson,
        checklists: checklistsJson,
      },
    });

    return apiSuccess(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
