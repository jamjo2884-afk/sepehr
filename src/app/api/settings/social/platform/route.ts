import { NextResponse } from 'next/server';
import { updatePlatformSetting } from '@/services/settings/platform-settings.service';
import { requireRole } from '@/lib/route-auth';

/**
 * PATCH /api/settings/social/platform
 *
 * Update a single platform's enabled state.
 *
 * social_platform_settings is a GLOBAL (non-workspace) configuration table, so
 * writes are restricted to workspace owners/admins (server-side) and the RLS
 * update policy enforces the same owner/admin gate at the database level.
 *
 * Body: { platform: string, enabled: boolean }
 *
 * Validation is handled by the service (Zod).
 */
export const PATCH = requireRole('owner', 'admin')(async (req) => {
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

  const { platform, enabled } = (body ?? {}) as Record<string, unknown>;

  const result = await updatePlatformSetting(
    platform as string,
    enabled,
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
  });
});
