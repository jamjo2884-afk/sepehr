import { NextResponse } from 'next/server';
import { getExpenses, createExpense } from '@/services/finance/finance.service';
import { validateExpense } from '@/services/finance/finance-validation';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/expenses?brand=...
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || undefined;
    const expenses = await getExpenses(brandId);
    return NextResponse.json({ ok: true, expenses });
  } catch (err) {
    console.warn('[finance] Could not list expenses.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت هزینه‌ها.' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/finance/expenses
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = validateExpense(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const expense = await createExpense(parsed.data as import('@/types/finance').FinanceExpenseInput);
  if (!expense) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد هزینه ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, expense }, { status: 201 });
});
