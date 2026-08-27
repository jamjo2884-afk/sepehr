/**
 * Settings type definitions.
 *
 * All settings are stored in a Zustand store with localStorage persistence.
 * When auth is complete, these can be migrated to a server-side settings table.
 */

export type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'social'
  | 'notifications'
  | 'system';

export interface SettingsCategoryInfo {
  id: SettingsCategory;
  label: string;
  description: string;
  enabled: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategoryInfo[] = [
  {
    id: 'general',
    label: 'عمومی',
    description: 'تنظیمات پایه سیستم و فضای کاری',
    enabled: true,
  },
  {
    id: 'appearance',
    label: 'ظاهر',
    description: 'تنظیمات نمایش و تم سیستم',
    enabled: true,
  },
  {
    id: 'social',
    label: 'شبکه‌های اجتماعی',
    description: 'وضعیت پلتفرم‌ها و تنظیمات همگام‌سازی',
    enabled: true,
  },
  {
    id: 'notifications',
    label: 'اعلان‌ها',
    description: 'مدیریت اعلان‌های سیستم',
    enabled: false,
  },
  {
    id: 'system',
    label: 'سیستم',
    description: 'اطلاعات نسخه و وضعیت سیستم',
    enabled: true,
  },
];

/** General settings persisted client-side. */
export interface GeneralSettings {
  /** Display name of the workspace. */
  workspaceName: string;
  /** Timezone identifier (IANA). */
  timezone: string;
  /** Date format pattern. */
  dateFormat: 'jalali' | 'gregorian' | 'auto';
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  workspaceName: 'Media Deck',
  timezone: 'Asia/Tehran',
  dateFormat: 'jalali',
};

/** Appearance settings persisted client-side. */
export interface AppearanceSettings {
  /** Color theme. */
  theme: 'dark' | 'light' | 'system';
  /** UI density. */
  density: 'comfortable' | 'compact';
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  density: 'comfortable',
};

/** Social platform settings info (read-only, derived from existing data). */
export interface SocialPlatformSetting {
  platformKey: string;
  label: string;
  color: string;
  enabled: boolean;
  accountCount: number;
  hasCredentials: boolean;
  metricFields: string[];
}

/** Notification settings (placeholder for future). */
export interface NotificationSettings {
  systemAlerts: boolean;
  syncErrors: boolean;
  importantUpdates: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  systemAlerts: true,
  syncErrors: true,
  importantUpdates: true,
};

/** System info (read-only). */
export interface SystemInfo {
  version: string;
  environment: string;
  database: string;
  lastMigration: string;
}

export const SYSTEM_INFO: SystemInfo = {
  version: '۰.۱ — آزمایشی',
  environment: 'توسعه',
  database: 'Supabase PostgreSQL',
  lastMigration: '۱۴۰۵-۰۵-۳۱',
};

/** All settings combined. */
export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: DEFAULT_GENERAL_SETTINGS,
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
};
