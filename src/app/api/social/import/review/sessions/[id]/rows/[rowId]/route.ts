import { NextResponse } from 'next/server';
import { getImportRow, editAndRevalidateRow } from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]/rows/[rowId]
 * Get a single row.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
): Promise<NextResponse> {
  const { rowId } = await params;
  try {
    const row = await getImportRow(rowId);
    if (!row) {
      return NextResponse.json({ error: 'ردیف یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    console.warn('[import-review] Could not get row.', err);
    return NextResponse.json({ error: 'خطا در خواندن ردیف.' }, { status: 500 });
  }
}

/**
 * PATCH /api/social/import/review/sessions/[id]/rows/[rowId]
 * Edit a row's data and re-validate.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
): Promise<NextResponse> {
  const { rowId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  try {
    await editAndRevalidateRow(rowId, body as any);
    const row = await getImportRow(rowId);
    return NextResponse.json(row);
  } catch (err) {
    console.warn('[import-review] Could not edit row.', err);
    return NextResponse.json({ error: 'ویرایش ردیف انجام نشد.' }, { status: 500 });
  }
}
