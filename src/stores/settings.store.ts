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
  /** Whether settings are currently being loaded from Supabase. */
  isLoading: boolean;
  /** Whether settings are currently being saved to Supabase. */
  isSaving: boolean;
  /** Last error message, if any. */
  error: string | null;

  /** Update general settings (partial merge) and persist to Supabase. */
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  /** Update appearance settings (partial merge) and persist to Supabase. */
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  /** Update notification settings (partial merge) and persist to Supabase. */
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  /** Reset all settings to defaults and persist to Supabase. */
  resetAll: () => void;

  /** Hydrate settings from Supabase (called on mount). */
  hydrateFromServer: () => Promise<void>;
  /** Replace all settings (used during hydration). */
  setAll: (settings: AppSettings) => void;
  /** Set loading state. */
  setLoading: (loading: boolean) => void;
  /** Set saving state. */
  setSaving: (saving: boolean) => void;
  /** Set error state. */
  setError: (error: string | null) => void;
}

/**
 * Persist settings to Supabase in the background.
 * On failure, the local state is preserved (optimistic update).
 */
async function persistToServer(settings: AppSettings): Promise<void> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!res.ok) {
      console.warn('[settings] Failed to persist to server:', res.status);
    }
  } catch (err) {
    console.warn('[settings] Network error persisting settings:', err);
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      isLoading: false,
      isSaving: false,
      error: null,

      updateGeneral: (patch) => {
        const next = {
          general: { ...get().general, ...patch },
        };
        set(next);
        persistToServer({ ...get(), ...next });
      },

      updateAppearance: (patch) => {
        const next = {
          appearance: { ...get().appearance, ...patch },
        };
        set(next);
        persistToServer({ ...get(), ...next });
      },

      updateNotifications: (patch) => {
        const next = {
          notifications: { ...get().notifications, ...patch },
        };
        set(next);
        persistToServer({ ...get(), ...next });
      },

      resetAll: () => {
        set(DEFAULT_SETTINGS);
        persistToServer(DEFAULT_SETTINGS);
      },

      hydrateFromServer: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/settings');
          if (!res.ok) {
            set({ isLoading: false });
            return;
          }
          const data = await res.json();
          if (data.ok && data.settings) {
            set({ ...data.settings, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch (err) {
          console.warn('[settings] Failed to hydrate from server:', err);
          set({ isLoading: false, error: 'خطا در بارگذاری تنظیمات از سرور.' });
        }
      },

      setAll: (settings) => set(settings),
      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'media-deck-settings',
      // Only persist settings data, not UI state like isLoading/isSaving
      partialize: (state) => ({
        general: state.general,
        appearance: state.appearance,
        notifications: state.notifications,
      }),
    },
  ),
);
