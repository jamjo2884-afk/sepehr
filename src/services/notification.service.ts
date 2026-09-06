/**
 * Notification Service (Phase 23)
 *
 * In-app notifications, workspace-scoped. Reuses the existing
 * `notifications` table (id, user_id, title, description, read,
 * created_at) upgraded with workspace_id / type / link by
 * supabase/migrations/20260907_phase23_control_center.sql.
 *
 * Demo mode: falls back to an in-memory buffer when the table is
 * unavailable (matching the brand/finance service convention).
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import type { Notification } from '@/types/index';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface CreateNotificationInput {
  workspaceId: string;
  /** Recipient user id (null = workspace-wide). */
  userId: string | null;
  title: string;
  description?: string;
  type?: NotificationType;
  link?: string | null;
}

/* =========================================================================
 * In-memory fallback (demo mode)
 * ========================================================================= */

interface MemoryNotification extends Notification {
  userId: string | null;
  workspaceId: string;
  _seq: number;
}

const _memory: MemoryNotification[] = [];
let _seq = 0;

function memoryAdd(input: CreateNotificationInput): Notification {
  const row: MemoryNotification = {
    id: `notif-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: input.title,
    description: input.description ?? '',
    read: false,
    type: input.type ?? 'info',
    link: input.link ?? null,
    createdAt: new Date().toISOString(),
    _seq: ++_seq,
  };
  _memory.push(row);
  if (_memory.length > 200) _memory.splice(0, _memory.length - 200);
  return row;
}

function memoryList(workspaceId: string): MemoryNotification[] {
  return _memory
    .filter((n) => n.workspaceId === workspaceId)
    .sort((a, b) => b._seq - a._seq);
}

/** Clear the in-memory fallback store (test isolation only). */
export function resetNotificationMemoryForTests(): void {
  _memory.length = 0;
}

/* =========================================================================
 * Row mapper
 * ========================================================================= */

interface NotificationRow {
  id: string;
  workspace_id: string;
  user_id: string | null;
  title: string;
  description: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    read: row.read,
    createdAt: row.created_at,
    workspaceId: row.workspace_id,
    type: row.type,
    link: row.link,
  };
}

/* =========================================================================
 * API
 * ========================================================================= */

/**
 * Create a notification. Never throws — a failed notification must not
 * break the primary operation. Returns the new row id or null.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<string | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('notifications')) {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          workspace_id: input.workspaceId,
          user_id: input.userId ?? 'demo',
          title: input.title,
          description: input.description ?? '',
          type: input.type ?? 'info',
          link: input.link ?? null,
          read: false,
        })
        .select('id')
        .single();
      if (error) {
        console.warn('[notifications] Could not create:', error.message);
        return null;
      }
      return (data?.id as string | undefined) ?? null;
    }
  } catch (err) {
    console.warn('[notifications] Could not create:', err);
    return null;
  }

  return memoryAdd(input).id;
}

/** List notifications for a workspace, newest first. */
export async function getNotifications(
  workspaceId: string,
  limit = 50,
): Promise<Notification[]> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('notifications')) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 200));
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as NotificationRow[]).map(notificationFromRow);
      }
    }
  } catch {
    // Fall through to memory
  }
  return memoryList(workspaceId).slice(0, limit);
}

/** Number of unread notifications for a user in a workspace. */
export async function getUnreadCount(
  workspaceId: string,
  userId: string | null,
): Promise<number> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('notifications')) {
      const query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('read', false);
      const { count, error } =
        userId === null
          ? await query
          : await query.eq('user_id', userId);
      if (error) throw error;
      if (count !== null) return count;
    }
  } catch {
    // Fall through
  }
  const list = memoryList(workspaceId);
  return list.filter(
    (n) => !n.read && (userId === null || n.userId === userId),
  ).length;
}

/** Mark a single notification as read (own notifications only). */
export async function markNotificationRead(
  id: string,
  workspaceId: string,
  userId: string | null,
): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('notifications')) {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (userId !== null) query = query.eq('user_id', userId);
      const { error } = await query;
      if (error) {
        console.warn('[notifications] Could not mark read:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn('[notifications] Could not mark read:', err);
    return false;
  }

  const found = memoryList(workspaceId).find(
    (n) => n.id === id && (userId === null || n.userId === userId),
  );
  if (found) found.read = true;
  return Boolean(found);
}

/** Mark all notifications of a user in a workspace as read. */
export async function markAllNotificationsRead(
  workspaceId: string,
  userId: string | null,
): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('notifications')) {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('workspace_id', workspaceId)
        .eq('read', false);
      if (userId !== null) query = query.eq('user_id', userId);
      const { error } = await query;
      if (error) {
        console.warn('[notifications] Could not mark all read:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn('[notifications] Could not mark all read:', err);
    return false;
  }

  for (const n of memoryList(workspaceId)) {
    if (!n.read && (userId === null || n.userId === userId)) n.read = true;
  }
  return true;
}