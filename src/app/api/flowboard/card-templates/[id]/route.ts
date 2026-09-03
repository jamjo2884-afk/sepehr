import { NextRequest } from "next/server";
import { prisma } from "@/lib/flowboard/db";
import { getCurrentUser } from "@/lib/flowboard/auth";
import { apiSuccess, apiUnauthorized, apiNotFound, handleApiError } from "@/lib/flowboard/api-utils";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiUnauthorized();

    const { id } = await params;
    const template = await prisma.flowCardTemplate.findUnique({ where: { id } });

    if (!template) return apiNotFound("Template");
    if (template.ownerId !== user.id) {
      return apiSuccess({ error: "Not your template" }, 403);
    }

    await prisma.flowCardTemplate.delete({ where: { id } });

    return apiSuccess({ message: "Template deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
