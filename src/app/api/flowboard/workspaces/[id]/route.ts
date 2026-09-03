import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/flowboard/auth";
import { updateWorkspaceSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    await requireWorkspaceMember(id, user.id);

    const workspace = await prisma.flowWorkspace.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { boards: true } },
      },
    });

    if (!workspace) return apiNotFound("Workspace");

    return apiSuccess(workspace);
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
    await requireWorkspaceAdmin(id, user.id);

    const body = await request.json();
    const data = updateWorkspaceSchema.parse(body);

    const workspace = await prisma.flowWorkspace.update({
      where: { id },
      data,
    });

    return apiSuccess(workspace);
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
    // Only owner can delete workspace
    const member = await prisma.flowWorkspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId: user.id } },
    });

    if (!member || member.role !== "OWNER") {
      return apiNotFound("Workspace");
    }

    await prisma.flowWorkspace.delete({ where: { id } });

    return apiSuccess({ message: "Workspace deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
