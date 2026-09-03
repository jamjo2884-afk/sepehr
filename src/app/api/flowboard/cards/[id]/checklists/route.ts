import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createChecklistSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const checklists = await prisma.flowChecklist.findMany({
      where: { cardId: id },
      include: {
        items: {
          orderBy: { position: "asc" },
        },
      },
      orderBy: { position: "asc" },
    });

    return apiSuccess(checklists);
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
    const card = await prisma.flowCard.findUnique({ where: { id } });
    if (!card) return apiSuccess({ error: "Card not found" }, 404);

    await requireBoardAccess(card.boardId, user.id);

    const body = await request.json();
    const data = createChecklistSchema.parse(body);

    const maxPos = await prisma.flowChecklist.aggregate({
      where: { cardId: id },
      _max: { position: true },
    });

    const checklist = await prisma.flowChecklist.create({
      data: {
        title: data.title,
        cardId: id,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    return apiSuccess(checklist, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
