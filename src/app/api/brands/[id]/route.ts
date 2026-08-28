import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBrandById, updateBrand, deleteBrand } from '@/services/brand.service';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  logoUrl: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

/**
 * GET /api/brands/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const brand = await getBrandById(params.id);
  if (!brand) {
    return NextResponse.json(
      { ok: false, error: 'برند یافت نشد.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, brand });
}

/**
 * PATCH /api/brands/[id]
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

  const parsed = updateBrandSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const brand = await updateBrand(params.id, parsed.data);
  if (!brand) {
    return NextResponse.json(
      { ok: false, error: 'برند یافت نشد یا به‌روزرسانی ناموفق بود.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, brand });
}

/**
 * DELETE /api/brands/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const success = await deleteBrand(params.id);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'حذف برند ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
