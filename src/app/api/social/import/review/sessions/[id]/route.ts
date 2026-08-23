import { NextResponse } from 'next/server';
import {
  getImportSession,
  updateImportSession,
  deleteImportSession,
  getImportRows,
} from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]
 * Get a single session with its rows + summary.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const session = await getImportSession(id);
    if (!session) {
      return NextResponse.json({ error: 'جلسه یافت نشد.' }, { status: 404 });
    }
    const rows = await getImportRows(id);
    return NextResponse.json({ session, rows });
  } catch (err) {
    console.warn('[import-review] Could not get session.', err);
    return NextResponse.json({ error: 'خطا در خواندن جلسه.' }, { status: 500 });
  }
}

/**
 * PATCH /api/social/import/review/sessions/[id]
 * Update session status (cancel, etc).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  try {
    const patch = body as Record<string, unknown>;
    await updateImportSession(id, patch as any);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[import-review] Could not update session.', err);
    return NextResponse.json({ error: 'بروزرسانی جلسه انجام نشد.' }, { status: 500 });
  }
}

/**
 * DELETE /api/social/import/review/sessions/[id]
 * Delete a session and all its rows.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    await deleteImportSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[import-review] Could not delete session.', err);
    return NextResponse.json({ error: 'حذف جلسه انجام نشد.' }, { status: 500 });
  }
}
