import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { getSupabase, isTableAvailable } from '@/lib/db';
import { prisma } from '@/lib/flowboard/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brands/summary
 *
 * Returns per-brand summary stats: content count, task count, campaign count,
 * total expenses. Used by the /brands page to show a quick overview.
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

  const summary: Record<
    string,
    { contentCount: number; taskCount: number; campaignCount: number; totalExpenses: number }
  > = {};

  try {
    const supabase = await getSupabase();

    // Content counts per brand
    if (await isTableAvailable('contents')) {
      const { data: contentRows } = await supabase
        .from('contents')
        .select('brand_id')
        .eq('workspace_id', ws.workspaceId);
      if (contentRows) {
        for (const row of contentRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = { contentCount: 0, taskCount: 0, campaignCount: 0, totalExpenses: 0 };
          }
          summary[bid].contentCount++;
        }
      }
    }

    // Campaign counts per brand
    if (await isTableAvailable('finance_campaigns')) {
      const { data: campaignRows } = await supabase
        .from('finance_campaigns')
        .select('brand_id')
        .eq('workspace_id', ws.workspaceId);
      if (campaignRows) {
        for (const row of campaignRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = { contentCount: 0, taskCount: 0, campaignCount: 0, totalExpenses: 0 };
          }
          summary[bid].campaignCount++;
        }
      }
    }

    // Expense totals per brand
    if (await isTableAvailable('finance_expenses')) {
      const { data: expenseRows } = await supabase
        .from('finance_expenses')
        .select('brand_id, amount')
        .eq('workspace_id', ws.workspaceId);
      if (expenseRows) {
        for (const row of expenseRows) {
          const bid = (row as { brand_id: string | null }).brand_id;
          const amt = (row as { amount: number }).amount;
          if (!bid) continue;
          if (!summary[bid]) {
            summary[bid] = { contentCount: 0, taskCount: 0, campaignCount: 0, totalExpenses: 0 };
          }
          summary[bid].totalExpenses += Number(amt);
        }
      }
    }

    // Task counts per brand (from flow_cards)
    const taskCards = await prisma.flowCard.findMany({
      where: { brandId: { not: null } },
      select: { brandId: true },
    });
    for (const card of taskCards) {
      if (!card.brandId) continue;
      if (!summary[card.brandId]) {
        summary[card.brandId] = { contentCount: 0, taskCount: 0, campaignCount: 0, totalExpenses: 0 };
      }
      summary[card.brandId].taskCount++;
    }

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.warn('[api/brands/summary] Error:', err);
    return NextResponse.json({ ok: true, summary: {} });
  }
}
