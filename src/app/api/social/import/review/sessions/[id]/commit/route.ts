import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { commitImport } from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/sessions/[id]/commit
 * Final commit: create accounts + upsert metrics.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  try {
    const result = await commitImport(id);
    return NextResponse.json(result);
  } catch (err) {
    console.warn('[import-review] Could not commit import.', err);
    return NextResponse.json({ error: 'ثبت اطلاعات انجام نشد.' }, { status: 500 });
  }
}
