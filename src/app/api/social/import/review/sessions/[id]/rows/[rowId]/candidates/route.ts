import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { canView } from '@/lib/permissions';
import { getCandidates } from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]/rows/[rowId]/candidates
 * Get candidate accounts for an ambiguous row.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json({ error: 'فضای کاری یافت نشد.' }, { status: 403 });
  }
  if (!canView(ws, 'social')) {
    return NextResponse.json(
      { error: 'دسترسی شما برای این بخش کافی نیست.' },
      { status: 403 },
    );
  }

  const { rowId } = await params;
  try {
    const candidates = await getCandidates(rowId);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.warn('[import-review] Could not get candidates.', err);
    return NextResponse.json({ error: 'خواندن کاندیداها انجام نشد.' }, { status: 500 });
  }
}
