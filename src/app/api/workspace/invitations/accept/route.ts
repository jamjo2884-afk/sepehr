import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/route-auth';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspace/invitations/accept
 *
 * Body: { token } — the invitee calls this while SIGNED IN.
 *
 * Uses requireAuth (not withAuth): a brand-new invitee has no workspace of
 * their own membership in yet, so there is no workspace context to resolve.
 * Authority comes from the SECURITY DEFINER accept_workspace_invitation() RPC,
 * which verifies the invitation is pending and unexpired AND that the signed-in
 * user's email matches the invited address.
 *
 * Deliberately mounted at /accept (a static segment) rather than
 * /[token] so it is not shadowed by the dynamic token route.
 */
export const POST = requireAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: 'bad_request', errorMessage: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const { token } = (body ?? {}) as Record<string, unknown>;
  if (typeof token !== 'string' || token.length < 8 || token.length > 128) {
    return NextResponse.json(
      { ok: false, errorCode: 'invalid_input', errorMessage: 'توکن دعوت معتبر نیست.' },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('accept_workspace_invitation', {
      p_token: token,
    });

    if (error) {
      const code = error.code;
      if (code === '42501') {
        return NextResponse.json(
          {
            ok: false,
            errorCode: 'forbidden',
            errorMessage:
              'این دعوت برای ایمیل دیگری ساخته شده است — با همان ایمیل وارد شوید.',
          },
          { status: 403 },
        );
      }
      if (code === 'P0002') {
        return NextResponse.json(
          {
            ok: false,
            errorCode: 'not_found',
            errorMessage: 'این دعوت نامعتبر، منقضی یا لغو شده است.',
          },
          { status: 404 },
        );
      }
      if (code === 'PGRST202') {
        return NextResponse.json(
          {
            ok: false,
            errorCode: 'not_configured',
            errorMessage: 'توابع مدیریت اعضا در پایگاه‌داده یافت نشد.',
          },
          { status: 501 },
        );
      }
      console.warn('[invitations] accept failed:', code, error.message);
      return NextResponse.json(
        { ok: false, errorCode: 'server_error', errorMessage: 'خطا در پذیرش دعوت.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, workspaceId: String(data) });
  } catch (err) {
    console.warn('[invitations] accept threw:', err);
    return NextResponse.json(
      { ok: false, errorCode: 'server_error', errorMessage: 'خطا در پذیرش دعوت.' },
      { status: 500 },
    );
  }
});
