import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import {
  resolveRowMatchExisting,
  getImportRow,
} from '@/services/import-review/import-review.service';

const resolveSchema = z.object({
  matched_account_id: z.string().uuid(),
});

/**
 * POST /api/social/import/review/sessions/[id]/rows/[rowId]/resolve
 * Resolve a row by matching it to an existing account.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { rowId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'account_id نامعتبر است.' }, { status: 400 });
  }
  try {
    await resolveRowMatchExisting(rowId, parsed.data.matched_account_id);
    const row = await getImportRow(rowId);
    return NextResponse.json(row);
  } catch (err) {
    console.warn('[import-review] Could not resolve row.', err);
    return NextResponse.json({ error: 'حل ردیف انجام نشد.' }, { status: 500 });
  }
}
