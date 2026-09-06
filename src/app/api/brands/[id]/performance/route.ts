import { NextResponse } from 'next/server';
import { getBrandPerformance } from '@/services/brand-performance.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/brands/[id]/performance
 *
 * Brand performance (social + finance + content) for the caller's
 * workspace. The brand must belong to the workspace.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  try {
    const performance = await getBrandPerformance(params.id, ws.workspaceId);
    if (!performance) {
      return NextResponse.json(
        { ok: false, error: 'داده‌ای برای این برند یافت نشد.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, performance });
  } catch (err) {
    console.warn('[api/brands] Could not build brand performance.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت عملکرد برند.' },
      { status: 500 },
    );
  }
}