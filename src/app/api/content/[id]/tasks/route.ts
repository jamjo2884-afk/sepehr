import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { getContentById } from '@/services/content.service';
import { prisma } from '@/lib/flowboard/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/content/[id]/tasks
 *
 * Returns FlowBoard tasks linked to a content item.
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

  const content = await getContentById(params.id, ws.workspaceId);
  if (!content) {
    return NextResponse.json(
      { ok: false, error: 'محتوا یافت نشد.' },
      { status: 404 },
    );
  }

  try {
    const tasks = await prisma.flowCard.findMany({
      where: { contentId: content.id },
      include: {
        list: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, tasks });
  } catch (err) {
    console.warn('[api/content/tasks] Could not fetch tasks:', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت تسک‌ها.' },
      { status: 500 },
    );
  }
}

const createTaskSchema = z.object({
  title: z.string().min(1, 'عنوان تسک الزامی است').max(300),
  boardId: z.string().min(1, 'بورد انتخاب کنید'),
  listId: z.string().min(1, 'لیست انتخاب کنید'),
  priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().nullable().optional(),
  description: z.string().max(10000).optional(),
});

/**
 * POST /api/content/[id]/tasks
 *
 * Creates a FlowBoard task linked to a content item.
 * The task inherits the content's brandId and is linked via contentId.
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

  // Verify content exists in this workspace (uses Supabase-backed service)
  const content = await getContentById(params.id, ws.workspaceId);
  if (!content) {
    return NextResponse.json(
      { ok: false, error: 'محتوا یافت نشد.' },
      { status: 404 },
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

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Verify list belongs to the board
  const list = await prisma.flowList.findFirst({
    where: { id: parsed.data.listId, boardId: parsed.data.boardId },
  });
  if (!list) {
    return NextResponse.json(
      { ok: false, error: 'لیست در بورد مورد نظر یافت نشد.' },
      { status: 400 },
    );
  }

  try {
    // Get max position
    const maxPos = await prisma.flowCard.aggregate({
      where: { listId: parsed.data.listId },
      _max: { position: true },
    });

    // Map Supabase user id → FlowBoard user id
    const flowUser = await prisma.flowUser.findFirst({
      where: { email: { not: '' } },
      orderBy: { createdAt: 'asc' },
    });
    const creatorId = flowUser?.id ?? 'demo-user-000';

    const card = await prisma.flowCard.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        listId: parsed.data.listId,
        boardId: parsed.data.boardId,
        position: (maxPos._max.position ?? -1) + 1,
        priority: parsed.data.priority ?? 'NONE',
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        brandId: content.brandId ?? undefined,
        contentId: content.id,
        createdBy: creatorId,
      },
      include: {
        list: { select: { id: true, title: true } },
        _count: { select: { comments: true, checklists: true } },
      },
    });

    // Auto-add creator as member
    await prisma.flowCardMember.create({
      data: { cardId: card.id, userId: creatorId },
    });

    // Log activity
    await prisma.flowActivity.create({
      data: {
        cardId: card.id,
        userId: creatorId,
        type: 'CARD_CREATED',
        content: `ایجاد تسک از محتوا: «${content.title}»`,
      },
    });

    return NextResponse.json({ ok: true, task: card }, { status: 201 });
  } catch (err) {
    console.warn('[api/content/tasks] Could not create task:', err);
    return NextResponse.json(
      { ok: false, error: 'ایجاد تسک ناموفق بود.' },
      { status: 500 },
    );
  }
}
