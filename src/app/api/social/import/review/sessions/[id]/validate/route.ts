import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { canCreate } from '@/lib/permissions';
import { validateSession } from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/sessions/[id]/validate
 * Run matching + validation on all pending rows.
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
  if (!canCreate(ws, 'social')) {
    return NextResponse.json(
      { error: 'دسترسی شما برای این بخش کافی نیست.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  try {
    const summary = await validateSession(id);
    return NextResponse.json(summary);
  } catch (err) {
    console.warn('[import-review] Could not validate session.', err);
    return NextResponse.json({ error: 'اعتبارسنجی انجام نشد.' }, { status: 500 });
  }
}
