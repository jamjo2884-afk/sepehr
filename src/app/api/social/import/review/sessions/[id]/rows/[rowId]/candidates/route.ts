import { NextResponse } from 'next/server';
import { getCandidates } from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]/rows/[rowId]/candidates
 * Get candidate accounts for an ambiguous row.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
): Promise<NextResponse> {
  const { rowId } = await params;
  try {
    const candidates = await getCandidates(rowId);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.warn('[import-review] Could not get candidates.', err);
    return NextResponse.json({ error: 'خواندن کاندیداها انجام نشد.' }, { status: 500 });
  }
}
