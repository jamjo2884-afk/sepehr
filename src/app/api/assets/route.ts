import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/route-auth';
import { getMediaAssets } from '@/services/data.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets
 *
 * Returns all media assets for the assets page.
 */
export const GET = requireAuth(async (): Promise<NextResponse> => {
  try {
    const assets = await getMediaAssets();
    return NextResponse.json({ ok: true, assets });
  } catch (err) {
    console.warn('[api/assets] Could not fetch assets.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت دارایی‌ها.' },
      { status: 500 },
    );
  }
});
