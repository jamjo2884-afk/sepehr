import { NextResponse } from 'next/server';
import { validateSession } from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/sessions/[id]/validate
 * Run matching + validation on all pending rows.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const summary = await validateSession(id);
    return NextResponse.json(summary);
  } catch (err) {
    console.warn('[import-review] Could not validate session.', err);
    return NextResponse.json({ error: 'اعتبارسنجی انجام نشد.' }, { status: 500 });
  }
}
