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
import { withAuth } from '@/lib/route-auth';

/**
 * GET /api/settings
 *
 * Returns the authenticated user's settings, or defaults for demo mode.
 */
export const GET = withAuth(async () => {
  const result = await getUserSettings();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
});

const patchSchema = z.object({
  workspaceName: z.string().min(1).max(100).optional(),
  timezone: timezoneSchema.optional(),
  dateFormat: dateFormatSchema.optional(),
  theme: themeSchema.optional(),
  density: densitySchema.optional(),
  notifications: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/settings
 *
 * Partially updates the authenticated user's settings.
 * Merges flat partial fields into the full AppSettings structure.
 */
export const PATCH = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Load current settings to merge with
  const current = await getUserSettings();
  if (!current.ok) {
    return NextResponse.json(current, { status: 500 });
  }

  const { settings } = current;
  const updates = parsed.data;

  // Build the merged AppSettings object
  const merged = {
    general: {
      workspaceName: updates.workspaceName ?? settings.general.workspaceName,
      timezone: updates.timezone ?? settings.general.timezone,
      dateFormat: updates.dateFormat ?? settings.general.dateFormat,
    },
    appearance: {
      theme: updates.theme ?? settings.appearance.theme,
      density: updates.density ?? settings.appearance.density,
    },
    notifications: updates.notifications
      ? { ...settings.notifications, ...updates.notifications }
      : settings.notifications,
  };

  const result = await upsertUserSettings(merged);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
});
