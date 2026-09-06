import { NextResponse } from 'next/server';
import {
  getNotifications,
  getUnreadCount,
} from '@/services/notification.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 *
 * Notifications of the caller's workspace (newest first) plus the unread
 * count for the requesting user.
 */
export const GET = withAuth(async (_req, auth) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(auth.workspace.workspaceId, 50),
      getUnreadCount(auth.workspace.workspaceId, auth.workspace.userId),
    ]);
    return NextResponse.json({ ok: true, notifications, unreadCount });
  } catch (err) {
    console.warn('[api/notifications] Could not list notifications.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت اعلان‌ها.' },
      { status: 500 },
    );
  }
});
