import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Notification Service tests (in-memory fallback path).
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  resetNotificationMemoryForTests,
} from '@/services/notification.service';

const WS = 'ws-1';
const USER_A = 'user-a';
const USER_B = 'user-b';

describe('Notification Service (in-memory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Module-scope in-memory store persists across tests in this file —
    // clear it so counts never accumulate between cases.
    resetNotificationMemoryForTests();
  });

  it('1. createNotification returns an id and lists newest first', async () => {
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'اولی', type: 'info' });
    await new Promise((r) => setTimeout(r, 5));
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'دومی', type: 'warning' });

    const list = await getNotifications(WS);
    expect(list.length).toBe(2);
    expect(list[0].title).toBe('دومی');
    expect(list[1].title).toBe('اولی');
    expect(list[0].type).toBe('warning');
    expect(list[0].read).toBe(false);
  });

  it('2. notifications are workspace-isolated', async () => {
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'فضای من' });
    await createNotification({ workspaceId: 'ws-2', userId: USER_A, title: 'فضای دیگر' });

    const list = await getNotifications(WS);
    expect(list.every((n) => n.workspaceId === WS)).toBe(true);
    expect(list.some((n) => n.title === 'فضای دیگر')).toBe(false);
  });

  it('3. getUnreadCount counts only unread for the given user', async () => {
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'برای A - 1' });
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'برای A - 2' });
    await createNotification({ workspaceId: WS, userId: USER_B, title: 'برای B' });

    expect(await getUnreadCount(WS, USER_A)).toBe(2);
    expect(await getUnreadCount(WS, USER_B)).toBe(1);
  });

  it('4. markNotificationRead marks only the target notification (own)', async () => {
    const id = await createNotification({ workspaceId: WS, userId: USER_A, title: 'خواندنی' });

    const ok = await markNotificationRead(id!, WS, USER_A);
    expect(ok).toBe(true);
    expect(await getUnreadCount(WS, USER_A)).toBe(0);

    const list = await getNotifications(WS);
    expect(list.find((n) => n.id === id)!.read).toBe(true);
  });

  it('5. a user cannot mark another user\'s notification as read', async () => {
    const id = await createNotification({ workspaceId: WS, userId: USER_B, title: 'مال B' });

    const ok = await markNotificationRead(id!, WS, USER_A);
    expect(ok).toBe(false);
    expect(await getUnreadCount(WS, USER_B)).toBe(1);
  });

  it('6. markAllNotificationsRead clears unread for the user only', async () => {
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'A-1' });
    await createNotification({ workspaceId: WS, userId: USER_A, title: 'A-2' });
    await createNotification({ workspaceId: WS, userId: USER_B, title: 'B-1' });

    const ok = await markAllNotificationsRead(WS, USER_A);
    expect(ok).toBe(true);
    expect(await getUnreadCount(WS, USER_A)).toBe(0);
    expect(await getUnreadCount(WS, USER_B)).toBe(1);
  });

  it('7. unknown notification id returns false', async () => {
    const ok = await markNotificationRead('no-such-id', WS, USER_A);
    expect(ok).toBe(false);
  });
});