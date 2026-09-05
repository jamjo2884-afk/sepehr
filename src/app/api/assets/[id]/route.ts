import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAssetById, getProjectById } from '@/services/data.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets/[id]
 *
 * Returns a single media asset and its parent project.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const id = decodeURIComponent(params.id);
    const asset = await getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { ok: false, error: 'دارایی یافت نشد.' },
        { status: 404 },
      );
    }
    const project = await getProjectById(asset.projectId);
    return NextResponse.json({ ok: true, asset, project });
  } catch (err) {
    console.warn('[api/assets/[id]] Could not fetch asset.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت دارایی.' },
      { status: 500 },
    );
  }
}
