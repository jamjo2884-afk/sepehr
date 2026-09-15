import { NextRequest } from 'next/server';
import { prisma } from '@/lib/flowboard/db';
import { getCurrentUser } from '@/lib/flowboard/auth';
import { apiSuccess, handleApiError } from '@/lib/flowboard/api-utils';
import { getCurrentWorkspace } from '@/lib/workspace';
import { resolveActiveWorkspaceId } from '@/lib/flowboard/workspace';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiSuccess({
        user: null,
        workspaces: [],
        activeWorkspaceId: null,
      });
    }

    // Get workspaces for this user
    const workspaces = await prisma.flowWorkspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { workspace: { createdAt: 'asc' } },
    });

    // Media Deck's current workspace is the source of truth for the active
    // FlowBoard workspace (falls back to the newest FlowBoard membership).
    const md = await getCurrentWorkspace();
    const activeWorkspaceId = await resolveActiveWorkspaceId(
      md?.workspaceId ?? null,
      user.id,
      workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        createdAt: m.workspace.createdAt,
      })),
    );

    return apiSuccess(
      {
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
          createdAt: m.workspace.createdAt,
        })),
        activeWorkspaceId,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
