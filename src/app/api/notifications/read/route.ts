import { NextResponse } from 'next/server';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notification.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/read
 *
 * Body: { id } marks one notification read, or { all: true } marks all of
 * the caller's notifications read. Users can only mark their own
 * notifications (the workspace + user scoping happens in the service).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  let body: { id?: string; all?: boolean };
  try {
    body = (await req.json()) as { id?: string; all?: boolean };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  try {
    if (body.all) {
      const ok = await markAllNotificationsRead(ws.workspaceId, ws.userId);
      return NextResponse.json({ ok });
    }
    if (body.id) {
      const ok = await markNotificationRead(body.id, ws.workspaceId, ws.userId);
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: 'اعلان یافت نشد یا به شما تعلق ندارد.' },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: 'شناسه اعلان الزامی است.' },
      { status: 400 },
    );
  } catch (err) {
    console.warn('[api/notifications] Could not mark read.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در ثبت خواندن اعلان.' },
      { status: 500 },
    );
  }
}
