import { requireAuth } from "@/lib/route-auth";
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncSocialAccount } from '@/services/social-sync.service';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/social/sync
 *
 * Body: { accountId }
 *
 * Runs the full sync flow server-side (credential resolution, connector,
 * fetch, normalize, validate, upsert, log). Never returns credentials or
 * raw API errors to the client — only a sanitized status result.
 */

const bodySchema = z.object({
  accountId: z.string().uuid(),
});

export const POST = requireAuth(async (req: Request): Promise<NextResponse> => {
  // Rate limit: 10 syncs per minute
  const ip = getClientIp(req);
  const limit = checkRateLimit(`sync:${ip}`, RATE_LIMITS.sync);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'درخواست بیش از حد مجاز است.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'bad_request',
        errorMessage: 'درخواست نامعتبر است.',
      },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'bad_request',
        errorMessage: 'شناسهٔ حساب نامعتبر است.',
      },
      { status: 400 },
    );
  }

  const result = await syncSocialAccount(parsed.data.accountId);

  // Only expose the sanitized fields; raw error messages from the
  // connector are never sent to the client (they may contain API detail).
  const safe = {
    ok: result.ok,
    accountId: result.accountId,
    recordsFetched: result.recordsFetched,
    recordsWritten: result.recordsWritten,
    errorCode: result.errorCode,
    errorMessage:
      result.errorCode === 'credential_not_configured'
        ? 'برای این پلتفرم اعتبارنامه‌ای پیکربندی نشده است.'
        : result.errorMessage,
  };
  return NextResponse.json(safe, { status: result.ok ? 200 : 400 });
});
