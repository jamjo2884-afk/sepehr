import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { SocialPlatform } from '@/types/domain';

// ─── Validation ──────────────────────────────────────────────────────────────

const ALL_PLATFORMS: SocialPlatform[] = [
  'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
  'rubika', 'rubino', 'soroushplus', 'aparat', 'threads', 'clubhouse',
  'shad', 'igap', 'site', 'gap', 'virasty', 'facebook',
];

export const platformKeySchema = z.enum(ALL_PLATFORMS as [string, ...string[]]);
export const enabledSchema = z.boolean();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlatformSetting {
  platform: SocialPlatform;
  enabled: boolean;
}

export type PlatformSettingsResult =
  | { ok: true; settings: PlatformSetting[] }
  | { ok: false; errorCode: string; errorMessage: string };

export type PlatformUpdateResult =
  | { ok: true; setting: PlatformSetting }
  | { ok: false; errorCode: string; errorMessage: string };

// ─── Default settings (all enabled) ──────────────────────────────────────────

const DEFAULT_SETTINGS: PlatformSetting[] = ALL_PLATFORMS.map((p) => ({
  platform: p,
  enabled: true,
}));

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Get all platform settings.
 * Returns defaults when in demo mode or when no rows exist.
 */
export async function getPlatformSettings(): Promise<PlatformSettingsResult> {
  try {
    const { data, error } = await supabase
      .from('social_platform_settings')
      .select('platform, enabled')
      .order('platform', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: true, settings: DEFAULT_SETTINGS };
    }

    return {
      ok: true,
      settings: (data as { platform: SocialPlatform; enabled: boolean }[]).map(
        (row) => ({
          platform: row.platform,
          enabled: row.enabled,
        }),
      ),
    };
  } catch (err) {
    console.warn('[platform-settings] Failed to read from Supabase:', err);
    return { ok: true, settings: DEFAULT_SETTINGS };
  }
}

/**
 * Update a single platform's enabled state.
 * Validates input before writing.
 */
export async function updatePlatformSetting(
  platform: string,
  enabled: unknown,
): Promise<PlatformUpdateResult> {
  // Validate platform key
  const platformParsed = platformKeySchema.safeParse(platform);
  if (!platformParsed.success) {
    return {
      ok: false,
      errorCode: 'invalid_platform',
      errorMessage: 'شناسه پلتفرم نامعتبر است.',
    };
  }

  // Validate enabled value
  const enabledParsed = enabledSchema.safeParse(enabled);
  if (!enabledParsed.success) {
    return {
      ok: false,
      errorCode: 'invalid_value',
      errorMessage: 'مقدار فعال/غیرفعال نامعتبر است.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('social_platform_settings')
      .upsert(
        { platform: platformParsed.data, enabled: enabledParsed.data },
        { onConflict: 'platform' },
      )
      .select('platform, enabled')
      .single();

    if (error) throw error;

    return {
      ok: true,
      setting: {
        platform: (data as { platform: SocialPlatform; enabled: boolean })
          .platform,
        enabled: (data as { platform: SocialPlatform; enabled: boolean })
          .enabled,
      },
    };
  } catch (err) {
    console.warn('[platform-settings] Failed to update:', err);
    return {
      ok: false,
      errorCode: 'update_failed',
      errorMessage: 'خطا در ذخیره تغییرات.',
    };
  }
}
