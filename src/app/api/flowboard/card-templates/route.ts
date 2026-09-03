import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/flowboard/api-utils";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  workspaceId: z.string().optional(),
  title: z.string().min(1).max(300),
  cardDesc: z.string().max(10000).optional(),
  priority: z.string().optional(),
  coverColor: z.string().optional(),
  labels: z.string().optional(), // JSON array of {name, color}
  checklists: z.string().optional(), // JSON array of {title, items: [{content}]}
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    const where: Record<string, unknown> = { ownerId: user.id };
    if (workspaceId) {
      // Verify user is a member of this workspace
      const member = await prisma.flowWorkspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
      });
      if (!member) {
        return apiSuccess([]);
      }
      where.workspaceId = workspaceId;
    }

    const templates = await prisma.flowCardTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.flowCardTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: user.id,
        workspaceId: data.workspaceId || null,
        title: data.title,
        cardDesc: data.cardDesc || null,
        priority: data.priority || "NONE",
        coverColor: data.coverColor || null,
        labels: data.labels || "[]",
        checklists: data.checklists || "[]",
      },
    });

    return apiSuccess(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
