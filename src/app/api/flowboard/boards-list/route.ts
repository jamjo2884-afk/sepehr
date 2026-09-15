import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { prisma } from '@/lib/flowboard/db';
import { resolveActiveWorkspaceId } from '@/lib/flowboard/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flowboard/boards-list
 *
 * Returns boards and their lists for task creation dialogs.
 * Used by the Content page to let users pick a board/list.
 *
 * Boards are scoped to the caller's active FlowBoard workspace — without
 * this filter the endpoint leaked every workspace's boards.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  try {
    const memberships = await prisma.flowWorkspaceMember.findMany({
      where: { userId: auth.id },
      include: { workspace: { select: { id: true, createdAt: true } } },
    });
    const activeWorkspaceId = await resolveActiveWorkspaceId(
      ws.workspaceId,
      auth.id,
      memberships.map((m) => ({
        id: m.workspace.id,
        createdAt: m.workspace.createdAt,
      })),
    );
    if (!activeWorkspaceId) {
      return NextResponse.json({ ok: true, boards: [] });
    }

    const boards = await prisma.flowBoard.findMany({
      where: { workspaceId: activeWorkspaceId },
      select: {
        id: true,
        title: true,
        lists: {
          select: { id: true, title: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ ok: true, boards });
  } catch (err) {
    console.warn('[api/flowboard/boards-list] Error:', err);
    return NextResponse.json({ ok: true, boards: [] });
  }
}
