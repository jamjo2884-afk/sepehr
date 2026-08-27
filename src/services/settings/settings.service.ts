import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type {
  AppSettings,
  GeneralSettings,
  AppearanceSettings,
} from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

// ─── Validation Schemas ──────────────────────────────────────────────────────

export const timezoneSchema = z.enum([
  'Asia/Tehran',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
]);

export const dateFormatSchema = z.enum(['jalali', 'gregorian', 'auto']);

export const themeSchema = z.enum(['dark', 'light', 'system']);

export const densitySchema = z.enum(['comfortable', 'compact']);

const generalSettingsSchema = z.object({
  workspaceName: z
    .string()
    .min(1, 'نام فضای کاری نمی‌تواند خالی باشد')
    .max(100, 'نام فضای کاری بیش از حد طولانی است')
    .trim(),
  timezone: timezoneSchema,
  dateFormat: dateFormatSchema,
});

const appearanceSettingsSchema = z.object({
  theme: themeSchema,
  density: densitySchema,
});

const notificationSettingsSchema = z.object({
  systemAlerts: z.boolean(),
  syncErrors: z.boolean(),
  importantUpdates: z.boolean(),
});

const appSettingsSchema = z.object({
  general: generalSettingsSchema,
  appearance: appearanceSettingsSchema,
  notifications: notificationSettingsSchema,
});

export type ValidatedAppSettings = z.infer<typeof appSettingsSchema>;

// ─── Database Row Type ───────────────────────────────────────────────────────

interface UserSettingsRow {
  id: string;
  user_id: string;
  workspace_name: string;
  timezone: string;
  date_format: string;
  theme: string;
  density: string;
  notifications: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

// ─── Conversion Helpers ──────────────────────────────────────────────────────

function rowToSettings(row: UserSettingsRow): AppSettings {
  return {
    general: {
      workspaceName: row.workspace_name,
      timezone: row.timezone,
      dateFormat: row.date_format as GeneralSettings['dateFormat'],
    },
    appearance: {
      theme: row.theme as AppearanceSettings['theme'],
      density: row.density as AppearanceSettings['density'],
    },
    notifications: {
      systemAlerts: (row.notifications as any)?.systemAlerts ?? true,
      syncErrors: (row.notifications as any)?.syncErrors ?? true,
      importantUpdates: (row.notifications as any)?.importantUpdates ?? true,
    },
  };
}

function settingsToRow(
  settings: ValidatedAppSettings,
  userId: string,
): Omit<UserSettingsRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    workspace_name: settings.general.workspaceName,
    timezone: settings.general.timezone,
    date_format: settings.general.dateFormat,
    theme: settings.appearance.theme,
    density: settings.appearance.density,
    notifications: settings.notifications,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type SettingsResult =
  | { ok: true; settings: AppSettings }
  | { ok: false; errorCode: string; errorMessage: string };

/**
 * Load user settings from Supabase.
 * Returns defaults when no row exists (first-time user).
 */
export async function getUserSettings(): Promise<SettingsResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Demo mode or unauthenticated — return defaults
    return { ok: true, settings: DEFAULT_SETTINGS };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found — first-time user, return defaults
      return { ok: true, settings: DEFAULT_SETTINGS };
    }
    return {
      ok: false,
      errorCode: 'load_failed',
      errorMessage: 'خطا در بارگذاری تنظیمات.',
    };
  }

  return { ok: true, settings: rowToSettings(data as UserSettingsRow) };
}

/**
 * Save (upsert) user settings to Supabase.
 * Validates input before writing.
 */
export async function upsertUserSettings(
  settings: AppSettings,
): Promise<SettingsResult> {
  // Validate
  const parsed = appSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return {
      ok: false,
      errorCode: 'validation_failed',
      errorMessage: 'تنظیمات نامعتبر است.',
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Demo mode — cannot persist, but don't fail
    return { ok: true, settings: parsed.data };
  }

  const row = settingsToRow(parsed.data, user.id);

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      errorCode: 'save_failed',
      errorMessage: 'خطا در ذخیره تنظیمات.',
    };
  }

  return { ok: true, settings: rowToSettings(data as UserSettingsRow) };
}
