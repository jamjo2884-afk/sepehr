import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { prisma } from '@/lib/flowboard/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/content/tasks-count
 *
 * Returns a map of contentId → task count for all flow_cards
 * that have a contentId set.
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
    const cards = await prisma.flowCard.findMany({
      where: { contentId: { not: null } },
      select: { contentId: true },
    });

    const counts = new Map<string, number>();
    for (const card of cards) {
      if (card.contentId) {
        counts.set(card.contentId, (counts.get(card.contentId) ?? 0) + 1);
      }
    }

    return NextResponse.json({ ok: true, counts: Object.fromEntries(counts) });
  } catch (err) {
    console.warn('[api/content/tasks-count] Error:', err);
    return NextResponse.json({ ok: true, counts: {} });
  }
}
