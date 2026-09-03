// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser } from "@/lib/flowboard/auth";
import { createWorkspaceSchema } from "@/lib/flowboard/validations";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";
import { slugify } from "@/lib/utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const workspaces = await prisma.flowWorkspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true, boards: true },
            },
          },
        },
      },
      orderBy: { workspace: { createdAt: "asc" } },
    });

    return apiSuccess(
      workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        description: m.workspace.description,
        role: m.role,
        memberCount: m.workspace._count.members,
        boardCount: m.workspace._count.boards,
        createdAt: m.workspace.createdAt,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const body = await request.json();
    const data = createWorkspaceSchema.parse(body);

    // Generate unique slug
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.flowWorkspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const workspace = await prisma.flowWorkspace.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    return apiSuccess(workspace, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
