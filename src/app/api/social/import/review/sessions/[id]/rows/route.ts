import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getImportRows } from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]/rows
 * List all rows for a session, with optional status filter.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as any;
    const rows = await getImportRows(id, status ? { status } : undefined);
    return NextResponse.json({ rows });
  } catch (err) {
    console.warn('[import-review] Could not list rows.', err);
    return NextResponse.json({ error: 'خطا در خواندن ردیف‌ها.' }, { status: 500 });
  }
}
