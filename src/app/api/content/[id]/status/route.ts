import { NextResponse } from 'next/server';
import { z } from 'zod';
import { transitionContentStatus } from '@/services/content.service';
import { createNotification } from '@/services/notification.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import type { ContentStatus } from '@/types/content';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'cancelled',
  'failed',
] as const;

const bodySchema = z.object({
  status: z.enum(STATUSES, { message: 'وضعیت نامعتبر است.' }),
});

/**
 * POST /api/content/[id]/status
 *
 * Validated workflow transition (draft → review → approved → scheduled →
 * published, plus rejected / cancelled / failed paths). Restricted to
 * owner / admin / editor roles — writers and viewers cannot move statuses.
 */
export async function POST(
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
  if (!['owner', 'admin', 'editor'].includes(ws.role)) {
    return NextResponse.json(
      { ok: false, error: 'دسترسی شما برای تغییر وضعیت محتوا کافی نیست.' },
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'وضعیت نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const result = await transitionContentStatus(
    params.id,
    parsed.data.status as ContentStatus,
    ws.workspaceId,
    ws.userId,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Internal notification for the acting user (surface appears in 23E).
  void createNotification({
    workspaceId: ws.workspaceId,
    userId: ws.userId,
    title: 'تغییر وضعیت محتوا',
    description: `«${result.content.title}» به وضعیت «${result.content.status}» تغییر کرد.`,
    type: result.content.status === 'failed' ? 'error' : 'info',
    link: '/content',
  });

  return NextResponse.json({ ok: true, content: result.content });
}