import { NextResponse } from 'next/server';
import { updateCampaign, deleteCampaign, getCampaigns } from '@/services/finance/finance.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { createNotification } from '@/services/notification.service';

export const dynamic = 'force-dynamic';

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  active: 'فعال',
  paused: 'متوقف‌شده',
  completed: 'پایان‌یافته',
  cancelled: 'لغوشده',
};

/**
 * PATCH /api/finance/campaigns/[id]
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const previous = (await getCampaigns()).find((c) => c.id === params.id) ?? null;
  const campaign = await updateCampaign(params.id, body as Record<string, unknown>);
  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: 'به‌روزرسانی کمپین ناموفق بود.' },
      { status: 500 },
    );
  }

  // Phase 23E internal trigger: campaign status changed. Note getCampaigns
  // is workspace-scoped for the caller, so the found campaign belongs to the
  // caller's workspace (matching finance_campaigns RLS).
  if (previous && previous.status !== campaign.status) {
    const ws = await getCurrentWorkspace();
    if (ws) {
      void createNotification({
        workspaceId: ws.workspaceId,
        userId: ws.userId,
        title: 'تغییر وضعیت کمپین',
        description: `کمپین «${campaign.name}» به وضعیت «${
          CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status
        }» تغییر کرد.`,
        type: campaign.status === 'cancelled' ? 'warning' : 'info',
        link: '/campaigns',
      });
    }
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
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const success = await deleteCampaign(params.id);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'حذف کمپین ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
