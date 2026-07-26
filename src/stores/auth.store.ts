'use client';

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthStatus, UserProfile, Workspace } from '@/types/auth';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  workspace: Workspace | null;
  setSession: (session: Session | null) => void;
  setContext: (payload: {
    profile: UserProfile | null;
    workspace: Workspace | null;
  }) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  session: null,
  profile: null,
  workspace: null,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    }),
  setContext: ({ profile, workspace }) => set({ profile, workspace }),
  setStatus: (status) => set({ status }),
  reset: () =>
    set({
      status: 'unauthenticated',
      user: null,
      session: null,
      profile: null,
      workspace: null,
    }),
}));
