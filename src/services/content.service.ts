/**
 * Content Workflow Service (Phase 23)
 *
 * Workspace-scoped CRUD for the `contents` table plus validated status
 * transitions (draft → review → approved → scheduled → published, with
 * rejected / cancelled / failed paths). Every mutation records an audit
 * event via audit.service (operational metadata only — never secrets).
 *
 * Demo mode: falls back to an in-memory store when the table is
 * unavailable (matching the brand/finance service convention).
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import { recordAudit } from '@/services/audit.service';
import {
  canTransitionContent,
  type Content,
  type ContentInput,
  type ContentRow,
  type ContentStatus,
} from '@/types/content';

/* =========================================================================
 * In-memory fallback (demo mode)
 * ========================================================================= */

interface MemoryContent extends Content {
  _seq: number;
}

const _memory: MemoryContent[] = [];
let _seq = 0;

function memoryAdd(
  input: ContentInput,
  workspaceId: string,
  createdBy: string | null,
): Content {
  const now = new Date().toISOString();
  const row: MemoryContent = {
    id: `content-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    workspaceId,
    brandId: input.brandId ?? null,
    campaignId: input.campaignId ?? null,
    title: input.title.trim(),
    type: input.type ?? 'post',
    status: 'draft',
    body: input.body ?? '',
    platform: input.platform ?? null,
    scheduledAt: input.scheduledAt ?? null,
    publishedAt: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
    _seq: ++_seq,
  };
  _memory.push(row);
  return row;
}

function memoryPatch(id: string, patch: Partial<Content>): Content | null {
  const idx = _memory.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated: MemoryContent = {
    ..._memory[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  _memory[idx] = updated;
  return updated;
}

/* =========================================================================
 * Row mapper
 * ========================================================================= */

export function contentFromRow(row: ContentRow): Content {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id,
    campaignId: row.campaign_id,
    title: row.title,
    type: row.type,
    status: row.status,
    body: row.body,
    platform: row.platform,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
 * Queries
 * ========================================================================= */

export interface ContentFilter {
  status?: ContentStatus;
  brandId?: string;
}

/** List contents for a workspace, newest first, with optional filters. */
export async function getContents(
  workspaceId: string,
  filter: ContentFilter = {},
): Promise<Content[]> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      let query = supabase
        .from('contents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (filter.status) query = query.eq('status', filter.status);
      if (filter.brandId) query = query.eq('brand_id', filter.brandId);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as ContentRow[]).map(contentFromRow);
      }
    }
  } catch {
    // Fall through to memory
  }
  let rows = _memory
    .filter((c) => c.workspaceId === workspaceId)
    .sort((a, b) => b._seq - a._seq);
  if (filter.status) rows = rows.filter((c) => c.status === filter.status);
  if (filter.brandId) rows = rows.filter((c) => c.brandId === filter.brandId);
  return rows;
}

/** A single content row scoped to a workspace. */
export async function getContentById(
  id: string,
  workspaceId: string,
): Promise<Content | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single();
      if (error) throw error;
      return contentFromRow(data as unknown as ContentRow);
    }
  } catch {
    // Fall through
  }
  return (
    _memory.find((c) => c.id === id && c.workspaceId === workspaceId) ?? null
  );
}

/* =========================================================================
 * Mutations
 * ========================================================================= */

/** Create a content row (always starts as `draft`). */
export async function createContent(
  input: ContentInput,
  workspaceId: string,
  createdBy: string | null,
): Promise<Content | null> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      const { data, error } = await supabase
        .from('contents')
        .insert({
          workspace_id: workspaceId,
          brand_id: input.brandId ?? null,
          campaign_id: input.campaignId ?? null,
          title: input.title.trim(),
          type: input.type ?? 'post',
          status: 'draft',
          body: input.body ?? '',
          platform: input.platform ?? null,
          scheduled_at: input.scheduledAt ?? null,
          created_by: createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      const content = contentFromRow(data as unknown as ContentRow);
      void recordAudit(
        { workspaceId, userId: createdBy },
        'create',
        'content',
        content.id,
        { summary: `ایجاد محتوا: ${content.title}` },
      );
      return content;
    }
  } catch (err) {
    console.warn('[content] Could not create content:', err);
    return null;
  }

  const content = memoryAdd(input, workspaceId, createdBy);
  void recordAudit(
    { workspaceId, userId: createdBy },
    'create',
    'content',
    content.id,
    { summary: `ایجاد محتوا: ${content.title}` },
  );
  return content;
}

/** Update mutable fields of a content row (status changes go through
 * `transitionContentStatus`). */
export async function updateContent(
  id: string,
  patch: Partial<Pick<ContentInput, 'title' | 'type' | 'brandId' | 'campaignId' | 'body' | 'platform' | 'scheduledAt'>>,
  workspaceId: string,
  userId: string | null,
): Promise<Content | null> {
  const existing = await getContentById(id, workspaceId);
  if (!existing) return null;

  const row: Record<string, unknown> = {};
  const changes: { field: string; before?: unknown; after?: unknown }[] = [];

  if (patch.title !== undefined) {
    changes.push({ field: 'title', before: existing.title, after: patch.title.trim() });
    row.title = patch.title.trim();
  }
  if (patch.type !== undefined) {
    changes.push({ field: 'type', before: existing.type, after: patch.type });
    row.type = patch.type;
  }
  if (patch.body !== undefined) {
    changes.push({ field: 'body', before: existing.body, after: patch.body });
    row.body = patch.body;
  }
  if (patch.platform !== undefined) {
    changes.push({ field: 'platform', before: existing.platform ?? null, after: patch.platform ?? null });
    row.platform = patch.platform ?? null;
  }
  if (patch.brandId !== undefined) {
    changes.push({ field: 'brand_id', before: existing.brandId, after: patch.brandId ?? null });
    row.brand_id = patch.brandId ?? null;
  }
  if (patch.campaignId !== undefined) {
    changes.push({ field: 'campaign_id', before: existing.campaignId, after: patch.campaignId ?? null });
    row.campaign_id = patch.campaignId ?? null;
  }
  if (patch.scheduledAt !== undefined) {
    changes.push({ field: 'scheduled_at', before: existing.scheduledAt, after: patch.scheduledAt ?? null });
    row.scheduled_at = patch.scheduledAt ?? null;
  }

  if (Object.keys(row).length === 0) return existing;

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      const { data, error } = await supabase
        .from('contents')
        .update(row)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
        .single();
      if (error) throw error;
      const content = contentFromRow(data as unknown as ContentRow);
      void recordAudit(
        { workspaceId, userId },
        'update',
        'content',
        content.id,
        { summary: `به‌روزرسانی محتوا: ${content.title}`, changes },
      );
      return content;
    }
  } catch (err) {
    console.warn('[content] Could not update content:', err);
    return null;
  }

  // Demo fallback
  const merged: Partial<Content> = {};
  if (patch.title !== undefined) merged.title = patch.title.trim();
  if (patch.type !== undefined) merged.type = patch.type;
  if (patch.body !== undefined) merged.body = patch.body;
  if (patch.platform !== undefined) merged.platform = patch.platform ?? null;
  if (patch.brandId !== undefined) merged.brandId = patch.brandId ?? null;
  if (patch.campaignId !== undefined) merged.campaignId = patch.campaignId ?? null;
  if (patch.scheduledAt !== undefined) merged.scheduledAt = patch.scheduledAt ?? null;
  const content = memoryPatch(id, merged);
  if (content) {
    void recordAudit(
      { workspaceId, userId },
      'update',
      'content',
      content.id,
      { summary: `به‌روزرسانی محتوا: ${content.title}`, changes },
    );
  }
  return content;
}

/** Soft-safety: contents are removed only via API-level owner/admin guard;
 * the service still scopes the delete to the workspace. */
export async function deleteContent(
  id: string,
  workspaceId: string,
  userId: string | null,
): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      const existing = await getContentById(id, workspaceId);
      if (!existing) return false;
      const { error } = await supabase
        .from('contents')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      void recordAudit(
        { workspaceId, userId },
        'delete',
        'content',
        id,
        { summary: `حذف محتوا: ${existing.title}` },
      );
      return true;
    }
  } catch (err) {
    console.warn('[content] Could not delete content:', err);
    return false;
  }

  const idx = _memory.findIndex(
    (c) => c.id === id && c.workspaceId === workspaceId,
  );
  if (idx === -1) return false;
  const [removed] = _memory.splice(idx, 1);
  void recordAudit(
    { workspaceId, userId },
    'delete',
    'content',
    id,
    { summary: `حذف محتوا: ${removed.title}` },
  );
  return true;
}

/** Result of a status transition attempt. */
export type TransitionResult =
  | { ok: true; content: Content }
  | { ok: false; error: string };

/**
 * Validate and apply a status transition.
 *
 * - Rejects transitions outside the allowed map (canTransitionContent).
 * - Sets published_at when moving to `published`.
 * - Records an audit event with the before/after status.
 * - Content → Brand / Content → Campaign links are untouched.
 */
export async function transitionContentStatus(
  id: string,
  to: ContentStatus,
  workspaceId: string,
  userId: string | null,
): Promise<TransitionResult> {
  const existing = await getContentById(id, workspaceId);
  if (!existing) {
    return { ok: false, error: 'محتوا یافت نشد.' };
  }
  if (existing.status === to) {
    return { ok: false, error: `محتوا در وضعیت «${to}» است.` };
  }
  if (!canTransitionContent(existing.status, to)) {
    return {
      ok: false,
      error: `انتقال از «${existing.status}» به «${to}» مجاز نیست.`,
    };
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === 'published') patch.published_at = new Date().toISOString();

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('contents')) {
      const { data, error } = await supabase
        .from('contents')
        .update(patch)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
        .single();
      if (error) throw error;
      const content = contentFromRow(data as unknown as ContentRow);
      void recordAudit(
        { workspaceId, userId },
        to === 'published' ? 'publish' : 'status_change',
        'content',
        content.id,
        {
          summary: `تغییر وضعیت محتوا: ${content.title}`,
          changes: [{ field: 'status', before: existing.status, after: to }],
        },
      );
      return { ok: true, content };
    }
  } catch (err) {
    console.warn('[content] Could not transition content status:', err);
    return { ok: false, error: 'خطا در تغییر وضعیت محتوا.' };
  }

  const updated = memoryPatch(id, {
    status: to,
    publishedAt: to === 'published' ? new Date().toISOString() : existing.publishedAt,
  });
  if (!updated) return { ok: false, error: 'محتوا یافت نشد.' };
  void recordAudit(
    { workspaceId, userId },
    to === 'published' ? 'publish' : 'status_change',
    'content',
    updated.id,
    {
      summary: `تغییر وضعیت محتوا: ${updated.title}`,
      changes: [{ field: 'status', before: existing.status, after: to }],
    },
  );
  return { ok: true, content: updated };
}