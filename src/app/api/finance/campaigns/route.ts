import { NextResponse } from 'next/server';
import { getCampaigns, createCampaign } from '@/services/finance/finance.service';
import { validateCampaign } from '@/services/finance/finance-validation';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/campaigns?brand=...
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand') || undefined;
    const campaigns = await getCampaigns(brand);
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    console.warn('[finance] Could not list campaigns.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت کمپین‌ها.' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/finance/campaigns
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = validateCampaign(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const campaign = await createCampaign(parsed.data);
  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد کمپین ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, campaign }, { status: 201 });
});
