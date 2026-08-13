'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Manual brand edits on the social dashboard: brands the user added by hand
 * and brands they removed. Persisted to localStorage so edits survive
 * reloads; the base data (Supabase `social_followers` or the bundled
 * snapshot) is never modified.
 */
interface SocialBrandEditsState {
  /** Brand names added manually. */
  added: string[];
  /** Base brand names hidden by the user. */
  removed: string[];
  addBrand: (name: string) => void;
  removeBrand: (name: string) => void;
  restoreBrand: (name: string) => void;
  /** Replace the whole edit state (used when saving the manage dialog). */
  setEdits: (added: string[], removed: string[]) => void;
}

export const useSocialBrandEdits = create<SocialBrandEditsState>()(
  persist(
    (set) => ({
      added: [],
      removed: [],

      addBrand: (name) =>
        set((state) => ({
          added: state.added.includes(name) ? state.added : [...state.added, name],
          removed: state.removed.filter((r) => r !== name),
        })),

      removeBrand: (name) =>
        set((state) => ({
          removed: state.removed.includes(name) ? state.removed : [...state.removed, name],
          added: state.added.filter((a) => a !== name),
        })),

      restoreBrand: (name) =>
        set((state) => ({
          removed: state.removed.filter((r) => r !== name),
        })),

      setEdits: (added, removed) => set({ added, removed }),
    }),
    { name: 'mediaos-social-brand-edits' },
  ),
);
