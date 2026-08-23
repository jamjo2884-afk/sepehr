import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  rejectRow,
  getImportRow,
} from '@/services/import-review/import-review.service';

const rejectSchema = z.object({
  reason: z.string().min(1, 'دلیل رد الزامی است.'),
});

/**
 * POST /api/social/import/review/sessions/[id]/rows/[rowId]/reject
 * Reject a row with a reason.
 */
export async function POST(
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
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'دلیل رد الزامی است.' }, { status: 400 });
  }
  try {
    await rejectRow(rowId, parsed.data.reason);
    const row = await getImportRow(rowId);
    return NextResponse.json(row);
  } catch (err) {
    console.warn('[import-review] Could not reject row.', err);
    return NextResponse.json({ error: 'رد کردن ردیف انجام نشد.' }, { status: 500 });
  }
}
