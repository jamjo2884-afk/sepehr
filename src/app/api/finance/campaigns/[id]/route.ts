import { NextResponse } from 'next/server';
import { updateCampaign, deleteCampaign } from '@/services/finance/finance.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/finance/campaigns/[id]
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const campaign = await updateCampaign(params.id, body as Record<string, unknown>);
  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: 'به‌روزرسانی کمپین ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, campaign });
}

/**
 * DELETE /api/finance/campaigns/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const success = await deleteCampaign(params.id);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'حذف کمپین ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
