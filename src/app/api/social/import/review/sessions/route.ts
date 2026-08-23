import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listImportSessions,
  createImportSession,
} from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions
 * List all import sessions.
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const sessions = await listImportSessions({ limit, offset });
    return NextResponse.json({ sessions });
  } catch (err) {
    console.warn('[import-review] Could not list sessions.', err);
    return NextResponse.json({ error: 'خطا در خواندن جلسات.' }, { status: 500 });
  }
}

const createSchema = z.object({
  filename: z.string().min(1),
  file_type: z.string().default('xlsx'),
  total_rows: z.number().int().nonnegative(),
});

/**
 * POST /api/social/import/review/sessions
 * Create a new import session.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است.' }, { status: 400 });
  }
  try {
    const session = await createImportSession(
      parsed.data.filename,
      parsed.data.file_type,
      parsed.data.total_rows,
    );
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.warn('[import-review] Could not create session.', err);
    return NextResponse.json({ error: 'ایجاد جلسه انجام نشد.' }, { status: 500 });
  }
}
