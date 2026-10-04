import { NextResponse } from 'next/server';
import { updateExpense, deleteExpense } from '@/services/finance/finance.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';
import { canEdit } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/finance/expenses/[id]
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
  if (!canEdit(ws, 'finance')) {
    return NextResponse.json(
      { ok: false, error: 'دسترسی شما برای این بخش کافی نیست.' },
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

  const expense = await updateExpense(params.id, body as Record<string, unknown>);
  if (!expense) {
    return NextResponse.json(
      { ok: false, error: 'به‌روزرسانی هزینه ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, expense });
}

/**
 * DELETE /api/finance/expenses/[id]
 */
export async function DELETE(
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
  if (!canEdit(ws, 'finance')) {
    return NextResponse.json(
      { ok: false, error: 'دسترسی شما برای این بخش کافی نیست.' },
      { status: 403 },
    );
  }

  const success = await deleteExpense(params.id);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'حذف هزینه ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
