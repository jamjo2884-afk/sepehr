
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser } from "@/lib/flowboard/auth";
import { apiSuccess, handleApiError } from "@/lib/flowboard/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiSuccess({ user: null, workspaces: [] });
    }

    // Get workspaces for this user
    const workspaces = await prisma.flowWorkspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { workspace: { createdAt: "asc" } },
    });

    return apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      workspaces: workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
