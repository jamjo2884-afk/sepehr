import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getContentById,
  updateContent,
  deleteContent,
} from '@/services/content.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = [
  'post',
  'reel',
  'story',
  'video',
  'carousel',
  'document',
  'other',
] as const;

const updateContentSchema = z.object({
  title: z.string().min(1, 'عنوان محتوا نمی‌تواند خالی باشد').max(200).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  brandId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  body: z.string().max(20000).optional(),
  platform: z.string().max(50).nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

/** Require owner/admin — delete and destructive actions. */
async function requireOwnerOrAdmin(): Promise<
  { userId: string; workspaceId: string } | NextResponse
> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }
  if (ws.role !== 'owner' && ws.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'دسترسی شما برای این عملیات کافی نیست.' },
      { status: 403 },
    );
  }
  return { userId: ws.userId, workspaceId: ws.workspaceId };
}

/**
 * GET /api/content/[id] — one content row (workspace-scoped).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  try {
    const content = await getContentById(params.id, ws.workspaceId);
    if (!content) {
      return NextResponse.json(
        { ok: false, error: 'محتوا یافت نشد.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.warn('[api/content] Could not read content.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت محتوا.' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/content/[id] — update mutable fields (status changes go
 * through /status). Workspace membership is required.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const content = await updateContent(
      params.id,
      parsed.data,
      ws.workspaceId,
      ws.userId,
    );
    if (!content) {
      return NextResponse.json(
        { ok: false, error: 'محتوا یافت نشد.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.warn('[api/content] Could not update content.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در به‌روزرسانی محتوا.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/content/[id] — only workspace owners/admins.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const guard = await requireOwnerOrAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const deleted = await deleteContent(params.id, guard.workspaceId, guard.userId);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: 'محتوا یافت نشد.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[api/content] Could not delete content.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در حذف محتوا.' },
      { status: 500 },
    );
  }
}