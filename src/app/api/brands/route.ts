import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBrands, createBrand } from '@/services/brand.service';
import { withAuth } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

const createBrandSchema = z.object({
  name: z.string().min(1, 'نام برند نمی‌تواند خالی باشد').max(100),
  slug: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  logoUrl: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

/**
 * GET /api/brands
 *
 * Returns all brands for the current workspace.
 */
export const GET = withAuth(async () => {
  try {
    const brands = await getBrands();
    return NextResponse.json({ ok: true, brands });
  } catch (err) {
    console.warn('[api/brands] GET error:', err);
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت برندها.' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/brands
 *
 * Create a new brand.
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

  const parsed = createBrandSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const brand = await createBrand(parsed.data);
  if (!brand) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد برند ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, brand }, { status: 201 });
});
