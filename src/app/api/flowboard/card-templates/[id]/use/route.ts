import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";
import { z } from "zod";

const useTemplateSchema = z.object({
  listId: z.string(),
  boardId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const template = await prisma.flowCardTemplate.findUnique({ where: { id } });

    if (!template) return apiNotFound("Template");

    // Workspace isolation: verify template belongs to user and target board is in same workspace
    if (template.ownerId !== user.id) {
      return apiSuccess({ error: "Not your template" }, 403);
    }

    const body = await request.json();
    const data = useTemplateSchema.parse(body);

    const boardMember = await requireBoardAccess(data.boardId, user.id);

    // If template has a workspace, verify the board is in the same workspace
    if (template.workspaceId && boardMember) {
      const board = await prisma.flowBoard.findUnique({ where: { id: data.boardId }, select: { workspaceId: true } });
      if (board && board.workspaceId !== template.workspaceId) {
        return apiSuccess({ error: "Template and board are in different workspaces" }, 400);
      }
    }

    // Verify list belongs to board
    const list = await prisma.flowList.findFirst({
      where: { id: data.listId, boardId: data.boardId },
    });
    if (!list) return apiNotFound("List");

    // Get position
    const maxPos = await prisma.flowCard.aggregate({
      where: { listId: data.listId },
      _max: { position: true },
    });

    // Create card from template
    const card = await prisma.flowCard.create({
      data: {
        title: template.title,
        description: template.cardDesc,
        listId: data.listId,
        boardId: data.boardId,
        position: (maxPos._max.position ?? -1) + 1,
        priority: template.priority,
        coverColor: template.coverColor,
        createdBy: user.id,
      },
    });

    // Add creator as member
    await prisma.flowCardMember.create({
      data: { cardId: card.id, userId: user.id },
    });

    // Copy labels from template
    try {
      const templateLabels = JSON.parse(template.labels) as Array<{ name: string; color: string }>;
      for (const tl of templateLabels) {
        // Find matching label in workspace
        const label = await prisma.flowLabel.findFirst({
          where: {
            name: tl.name,
            color: tl.color,
            workspaceId: template.workspaceId || undefined,
          },
        });
        if (label) {
          await prisma.flowCardLabel.create({
            data: { cardId: card.id, labelId: label.id },
          });
        }
      }
    } catch {
      // Ignore label parsing errors
    }

    // Copy checklists from template
    try {
      const templateChecklists = JSON.parse(template.checklists) as Array<{
        title: string;
        items: Array<{ content: string }>;
      }>;
      for (let ci = 0; ci < templateChecklists.length; ci++) {
        const cl = templateChecklists[ci];
        const checklist = await prisma.flowChecklist.create({
          data: {
            title: cl.title,
            cardId: card.id,
            position: ci,
          },
        });
        if (cl.items && cl.items.length > 0) {
          await prisma.flowChecklistItem.createMany({
            data: cl.items.map((item, idx) => ({
              content: item.content,
              checklistId: checklist.id,
              position: idx,
              isCompleted: false,
            })),
          });
        }
      }
    } catch {
      // Ignore checklist parsing errors
    }

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: card.id,
        userId: user.id,
        type: "CARD_CREATED",
        content: `Created from template "${template.name}"`,
      },
    });

    return apiSuccess(card, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
