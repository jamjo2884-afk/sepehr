
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireBoardAccess } from "@/lib/flowboard/auth";
import { createLabelSchema, updateLabelSchema } from "@/lib/flowboard/validations";
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

    const labels = await prisma.flowBoardLabel.findMany({
      where: { boardId: id },
      include: { label: true },
    });

    return apiSuccess(labels.map((bl) => bl.label));
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
    const data = createLabelSchema.parse(body);

    // Get board's workspace
    const board = await prisma.flowBoard.findUnique({
      where: { id },
      select: { workspaceId: true },
    });

    // Create label
    const label = await prisma.flowLabel.create({
      data: {
        name: data.name,
        color: data.color,
        workspaceId: board?.workspaceId,
      },
    });

    // Link to board
    await prisma.flowBoardLabel.create({
      data: {
        boardId: id,
        labelId: label.id,
      },
    });

    return apiSuccess(label, 201);
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
    const { labelId, ...data } = body;
    const validatedData = updateLabelSchema.parse(data);

    const label = await prisma.flowLabel.update({
      where: { id: labelId },
      data: validatedData,
    });

    return apiSuccess(label);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireBoardAccess(id, user.id);

    const { labelId } = await request.json();

    // Remove from board
    await prisma.flowBoardLabel.deleteMany({
      where: { boardId: id, labelId },
    });

    // Delete label if not used elsewhere
    const usageCount = await prisma.flowCardLabel.count({
      where: { labelId },
    });

    if (usageCount === 0) {
      await prisma.flowLabel.delete({ where: { id: labelId } });
    }

    return apiSuccess({ message: "Label removed" });
  } catch (error) {
    return handleApiError(error);
  }
}
