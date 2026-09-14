import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { getBrandById } from '@/services/brand.service';
import { getContents } from '@/services/content.service';
import { getExpenses, getCampaigns } from '@/services/finance/finance.service';
import { prisma } from '@/lib/flowboard/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brands/[id]/related
 *
 * Brand-scoped data from the three existing module stacks, in one call:
 * - Content:  `contents` rows via content.service (workspace-scoped)
 * - Finance:  finance_expenses + finance_campaigns via finance.service
 * - Tasks:    FlowBoard cards where flow_cards.brand_id = this brand
 *             (same Postgres database; plain scalar link per Phase 23 ADR)
 *
 * All queries are brand-filtered. Authorization: caller must be
 * authenticated and the brand must belong to the caller's workspace —
 * same IDOR check as /api/brands/[id]/status. Supabase RLS is the second
 * layer for the Supabase-managed tables; FlowBoard workspace membership is
 * enforced by matching the board's workspaceId against the Media Deck
 * workspace id (FlowBoard shares the Media Deck workspace id by design —
 * see src/lib/flowboard/auth.ts).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  const brand = await getBrandById(params.id);
  if (!brand || brand.workspaceId !== ws.workspaceId) {
    return NextResponse.json(
      { ok: false, error: 'برند یافت نشد.' },
      { status: 404 },
    );
  }

  const brandId = brand.id;

  // Each section degrades independently: a failure in one module must not
  // break the others (the page shows a per-tab error/empty state).
  const [contents, expenses, campaigns, tasks] = await Promise.all([
    getContents(ws.workspaceId, { brandId }).catch((err) => {
      console.warn('[api/brands/related] contents failed:', err);
      return null;
    }),
    getExpenses(brandId).catch((err) => {
      console.warn('[api/brands/related] expenses failed:', err);
      return null;
    }),
    getCampaigns(brandId).catch((err) => {
      console.warn('[api/brands/related] campaigns failed:', err);
      return null;
    }),
    prisma.flowCard
      .findMany({
        where: {
          brandId,
          isArchived: false,
          board: { workspaceId: ws.workspaceId, isArchived: false },
        },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          dueDate: true,
          isCompleted: true,
          createdAt: true,
          updatedAt: true,
          board: { select: { id: true, title: true } },
          list: { select: { id: true, title: true } },
        },
        orderBy: [{ isCompleted: 'asc' }, { updatedAt: 'desc' }],
        take: 100,
      })
      .catch((err) => {
        console.warn('[api/brands/related] tasks failed:', err);
        return null;
      }),
  ]);

  return NextResponse.json({
    ok: true,
    contents: contents ?? null,
    expenses: expenses ?? null,
    campaigns: campaigns ?? null,
    tasks: tasks ?? null,
  });
}
