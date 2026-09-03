// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";
import { z } from "zod";

const bulkSchema = z.object({
  cardIds: z.array(z.string()).min(1).max(50),
  operation: z.enum(["archive", "move", "priority", "complete", "addLabel", "removeLabel"]),
  // Move
  targetListId: z.string().optional(),
  // Priority
  priority: z.string().optional(),
  // Label
  labelId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const body = await request.json();
    const data = bulkSchema.parse(body);

    // Verify all cards exist and user has access
    const cards = await prisma.flowCard.findMany({
      where: { id: { in: data.cardIds } },
      select: { id: true, boardId: true },
    });

    if (cards.length !== data.cardIds.length) {
      return apiSuccess({ error: "Some cards not found" }, 400);
    }

    // Check access to all boards
    const boardIds = [...new Set(cards.map((c) => c.boardId))];
    for (const boardId of boardIds) {
      await requireBoardAccess(boardId, user.id);
    }

    let affected = 0;

    switch (data.operation) {
      case "archive": {
        const result = await prisma.flowCard.updateMany({
          where: { id: { in: data.cardIds } },
          data: { isArchived: true },
        });
        affected = result.count;
        // Log activity for each
        for (const cardId of data.cardIds) {
          await prisma.flowActivity.create({
            data: {
              cardId,
              userId: user.id,
              type: "CARD_EDITED",
              content: "Archived card (bulk)",
            },
          });
        }
        break;
      }

      case "move": {
        if (!data.targetListId) {
          return apiSuccess({ error: "targetListId required for move" }, 400);
        }
        // Verify target list exists
        const targetList = await prisma.flowList.findUnique({
          where: { id: data.targetListId },
        });
        if (!targetList) {
          return apiSuccess({ error: "Target list not found" }, 400);
        }
        const result = await prisma.flowCard.updateMany({
          where: { id: { in: data.cardIds } },
          data: { listId: data.targetListId },
        });
        affected = result.count;
        break;
      }

      case "priority": {
        if (!data.priority) {
          return apiSuccess({ error: "priority required" }, 400);
        }
        const result = await prisma.flowCard.updateMany({
          where: { id: { in: data.cardIds } },
          data: { priority: data.priority },
        });
        affected = result.count;
        break;
      }

      case "complete": {
        const result = await prisma.flowCard.updateMany({
          where: { id: { in: data.cardIds } },
          data: { isCompleted: true },
        });
        affected = result.count;
        break;
      }

      case "addLabel": {
        if (!data.labelId) {
          return apiSuccess({ error: "labelId required" }, 400);
        }
        // Add label to all cards (skip duplicates)
        for (const cardId of data.cardIds) {
          await prisma.flowCardLabel.upsert({
            where: { cardId_labelId: { cardId, labelId: data.labelId } },
            create: { cardId, labelId: data.labelId },
            update: {},
          });
        }
        affected = data.cardIds.length;
        break;
      }

      case "removeLabel": {
        if (!data.labelId) {
          return apiSuccess({ error: "labelId required" }, 400);
        }
        const result = await prisma.flowCardLabel.deleteMany({
          where: {
            cardId: { in: data.cardIds },
            labelId: data.labelId,
          },
        });
        affected = result.count;
        break;
      }
    }

    return apiSuccess({ affected, operation: data.operation });
  } catch (error) {
    return handleApiError(error);
  }
}
