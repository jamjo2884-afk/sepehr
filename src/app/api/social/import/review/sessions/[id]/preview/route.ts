import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCommitPreview } from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/sessions/[id]/preview
 * Generate a preview of what the commit will do.
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
    const preview = await getCommitPreview(id);
    return NextResponse.json(preview);
  } catch (err) {
    console.warn('[import-review] Could not generate preview.', err);
    return NextResponse.json({ error: 'پیش‌نمایش تولید نشد.' }, { status: 500 });
  }
}
