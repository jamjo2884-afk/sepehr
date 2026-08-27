import { NextResponse } from 'next/server';
import { updatePlatformSetting } from '@/services/settings/platform-settings.service';

/**
 * PATCH /api/settings/social/platform
 *
 * Update a single platform's enabled state.
 *
 * Body: { platform: string, enabled: boolean }
 *
 * Validation is handled by the service (Zod).
 */
export async function PATCH(req: Request): Promise<NextResponse> {
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
}
