import { NextResponse } from 'next/server';
import { updateExpense, deleteExpense } from '@/services/finance/finance.service';
import { requireAuth } from '@/lib/auth';

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

  const success = await deleteExpense(params.id);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'حذف هزینه ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
