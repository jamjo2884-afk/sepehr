'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppSettings,
  GeneralSettings,
  AppearanceSettings,
  NotificationSettings,
} from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState extends AppSettings {
  /** Update general settings (partial merge). */
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  /** Update appearance settings (partial merge). */
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  /** Update notification settings (partial merge). */
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  /** Reset all settings to defaults. */
  resetAll: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateGeneral: (patch) =>
        set((state) => ({
          general: { ...state.general, ...patch },
        })),

      updateAppearance: (patch) =>
        set((state) => ({
          appearance: { ...state.appearance, ...patch },
        })),

      updateNotifications: (patch) =>
        set((state) => ({
          notifications: { ...state.notifications, ...patch },
        })),

      resetAll: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'media-deck-settings',
    },
  ),
);
