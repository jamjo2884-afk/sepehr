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
 * Returns all brands for the current workspace (server-resolved via withAuth,
 * then enforced by brands RLS — defense in depth).
 */
export const GET = withAuth(async (_req, auth) => {
  try {
    const brands = await getBrands(auth.workspace.workspaceId);
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

  const parsed = createBrandSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Workspace-aware creation (PRD Dev Rule 4): the caller's server-resolved
  // workspace wins; the service's LIMIT-1 default-workspace fallback is only
  // reached in non-request contexts. createBrand dedupes by (workspace, name).
  const brand = await createBrand(parsed.data, auth.workspace.workspaceId);
  if (!brand) {
    return NextResponse.json(
      { ok: false, error: 'ایجاد برند ناموفق بود.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, brand }, { status: 201 });
});
