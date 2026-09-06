import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getContents, createContent } from '@/services/content.service';
import { withAuth } from '@/lib/route-auth';
import type { ContentStatus } from '@/types/content';

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

const createContentSchema = z.object({
  title: z.string().min(1, 'عنوان محتوا نمی‌تواند خالی باشد').max(200),
  type: z.enum(CONTENT_TYPES).optional(),
  brandId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  body: z.string().max(20000).optional(),
  platform: z.string().max(50).nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

/**
 * GET /api/content?status=...&brandId=...
 *
 * Lists contents of the caller's workspace, newest first, with optional
 * status / brand filters.
 */
export const GET = withAuth(async (req, auth) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const brandId = searchParams.get('brandId') || undefined;
    const contents = await getContents(auth.workspace.workspaceId, {
      status: (status as ContentStatus | undefined),
      brandId,
    });
    return NextResponse.json({ ok: true, contents });
  } catch (err) {
    console.warn('[api/content] Could not list contents.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت محتواها.' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/content
 *
 * Creates a draft content row in the caller's workspace.
 */
export const POST = withAuth(async (req, auth) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = createContentSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const content = await createContent(
    parsed.data,
    auth.workspace.workspaceId,
    auth.workspace.userId,
  );
  if (!content) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد محتوا ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, content }, { status: 201 });
});