
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser, requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/flowboard/auth";
import { inviteMemberSchema } from "@/lib/flowboard/validations";
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

    const members = await prisma.flowWorkspaceMember.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess(
      members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        joinedAt: m.createdAt,
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
    await requireWorkspaceAdmin(id, user.id);

    const body = await request.json();
    const data = inviteMemberSchema.parse(body);

    // Find user by email
    const invitee = await prisma.flowUser.findUnique({
      where: { email: data.email },
    });

    if (!invitee) {
      return apiNotFound("User with this email");
    }

    // Check if already a member
    const existing = await prisma.flowWorkspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId: invitee.id,
        },
      },
    });

    if (existing) {
      return apiSuccess({ message: "User is already a member" });
    }

    const member = await prisma.flowWorkspaceMember.create({
      data: {
        workspaceId: id,
        userId: invitee.id,
        role: data.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return apiSuccess(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
