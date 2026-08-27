import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserSettings,
  upsertUserSettings,
  timezoneSchema,
  dateFormatSchema,
  themeSchema,
  densitySchema,
} from '@/services/settings/settings.service';

/**
 * GET /api/settings
 *
 * Returns the authenticated user's settings, or defaults for demo mode.
 */
export async function GET(): Promise<NextResponse> {
  const result = await getUserSettings();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/**
 * PATCH /api/settings
 *
 * Partially update user settings. Only the provided fields are merged.
 */
const patchSchema = z.object({
  general: z
    .object({
      workspaceName: z
        .string()
        .min(1)
        .max(100)
        .trim()
        .optional(),
      timezone: timezoneSchema.optional(),
      dateFormat: dateFormatSchema.optional(),
    })
    .optional(),
  appearance: z
    .object({
      theme: themeSchema.optional(),
      density: densitySchema.optional(),
    })
    .optional(),
  notifications: z
    .object({
      systemAlerts: z.boolean().optional(),
      syncErrors: z.boolean().optional(),
      importantUpdates: z.boolean().optional(),
    })
    .optional(),
});

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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'validation_failed',
        errorMessage: 'داده‌های ارسالی نامعتبر هستند.',
      },
      { status: 400 },
    );
  }

  // Load current settings, merge with patch, then upsert
  const current = await getUserSettings();
  if (!current.ok) {
    return NextResponse.json(current, { status: 500 });
  }

  const merged = {
    general: { ...current.settings.general, ...parsed.data.general },
    appearance: { ...current.settings.appearance, ...parsed.data.appearance },
    notifications: {
      ...current.settings.notifications,
      ...parsed.data.notifications,
    },
  };

  const result = await upsertUserSettings(merged);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
