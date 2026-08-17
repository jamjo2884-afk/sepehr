import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteSocialMetric } from '@/services/social.service';

/**
 * DELETE /api/social/metrics/[id]
 *
 * Body (optional): { expectedUpdatedAt? } — optimistic concurrency lock.
 * Deletes one existing `social_metrics` row. Related rows (data-quality
 * reviews, edit logs) are removed by the schema's ON DELETE CASCADE.
 * Returns { ok } — ok=false means the row was missing or its `updated_at`
 * no longer matched (changed/deleted by another process).
 *
 * Future authorization hooks in here (auth is bypassed in the demo).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const bodySchema = z
  .object({
    expectedUpdatedAt: z.string().min(1).optional(),
  })
  .strict()
  .optional();

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'شناسهٔ متریک نامعتبر است.' },
      { status: 400 },
    );
  }

  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    // No body is fine — expectedUpdatedAt is optional.
  }
  const bodyParsed = bodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: 'دادهٔ ارسالی نامعتبر است.' },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteSocialMetric(parsed.data.id, {
      expectedUpdatedAt: bodyParsed.data?.expectedUpdatedAt ?? null,
    });
    if (!deleted) {
      return NextResponse.json(
        {
          ok: false,
          error: 'این رکورد پیدا نشد یا توسط فرایند دیگری تغییر کرده است.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[social] Could not delete metric.', err);
    return NextResponse.json(
      { error: 'حذف متریک انجام نشد.' },
      { status: 500 },
    );
  }
}
