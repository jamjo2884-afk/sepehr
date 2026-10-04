import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { canEdit } from '@/lib/permissions';
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
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json({ error: 'فضای کاری یافت نشد.' }, { status: 403 });
  }
  // Commit writes real social accounts + metrics — edit level.
  if (!canEdit(ws, 'social')) {
    return NextResponse.json(
      { error: 'دسترسی شما برای این بخش کافی نیست.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  try {
    const result = await commitImport(id);
    return NextResponse.json(result);
  } catch (err) {
    console.warn('[import-review] Could not commit import.', err);
    return NextResponse.json({ error: 'ثبت اطلاعات انجام نشد.' }, { status: 500 });
  }
}
