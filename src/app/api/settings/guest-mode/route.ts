import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';
import {
  getGuestModeState,
  setGuestMode,
  GUEST_MODE_PROPAGATION_MS,
} from '@/services/settings/guest-mode.service';

/**
 * GET /api/settings/guest-mode
 *
 * Current guest-mode state (owner/admin only — the settings UI is not
 * reachable for guests, and the flag itself is not tenant data worth
 * exposing to lower roles).
 */
export const GET = requireRole(
  'owner',
  'admin',
)(async () => {
  const result = await getGuestModeState();
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    enabled: result.state.enabled,
    changedAt: result.state.changedAt,
    changedBy: result.state.changedBy,
    source: result.state.source,
    propagationMs: GUEST_MODE_PROPAGATION_MS,
  });
});

/**
 * PATCH /api/settings/guest-mode
 *
 * Toggle guest mode. Body: { enabled: boolean }
 *
 * Authorization is two-layered: requireRole('owner','admin') here, and the
 * SECURITY DEFINER set_guest_mode() RPC re-checks workspace membership
 * inside the database. The row itself has no client-writable policy.
 */
export const PATCH = requireRole(
  'owner',
  'admin',
)(async (req) => {
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

  const { enabled } = (body ?? {}) as Record<string, unknown>;

  const result = await setGuestMode(enabled);

  if (!result.ok) {
    const status =
      result.errorCode === 'invalid_value'
        ? 400
        : result.errorCode === 'forbidden'
          ? 403
          : result.errorCode === 'not_configured'
            ? 501
            : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    enabled: result.state.enabled,
    changedAt: result.state.changedAt,
    propagationMs: GUEST_MODE_PROPAGATION_MS,
  });
});
