import { NextResponse } from 'next/server';
import { commitImport } from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/sessions/[id]/commit
 * Final commit: create accounts + upsert metrics.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const result = await commitImport(id);
    return NextResponse.json(result);
  } catch (err) {
    console.warn('[import-review] Could not commit import.', err);
    return NextResponse.json({ error: 'ثبت اطلاعات انجام نشد.' }, { status: 500 });
  }
}
