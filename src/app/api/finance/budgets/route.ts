import { NextResponse } from 'next/server';
import { getBudgets, createBudget } from '@/services/finance/finance.service';
import { validateBudget } from '@/services/finance/finance-validation';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/budgets?brand=...
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand') || undefined;
    const budgets = await getBudgets(brand);
    return NextResponse.json({ ok: true, budgets });
  } catch (err) {
    console.warn('[finance] Could not list budgets.', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت بودجه‌ها.' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/finance/budgets
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

  const parsed = validateBudget(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const budget = await createBudget(parsed.data);
  if (!budget) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد بودجه ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, budget }, { status: 201 });
});
