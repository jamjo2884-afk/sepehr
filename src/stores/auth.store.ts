import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type {
  AuthStatus,
  UserProfile,
  Workspace,
  AppRole,
} from '@/types/auth';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  workspace: Workspace | null;
  role: AppRole | null;

  setSession: (session: Session | null) => void;

  setContext: (payload: {
    profile: UserProfile | null;
    workspace: Workspace | null;
    role: AppRole | null;
  }) => void;

  setStatus: (status: AuthStatus) => void;

  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Neutral initial state. AuthProvider hydrates it: demo mode applies the
  // demo session, real auth mode applies the Supabase session (or resets).
  status: 'loading',

  user: null,
  session: null,
  profile: null,
  workspace: null,
  role: null,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: 'authenticated',
    }),

  setContext: ({ profile, workspace, role }) =>
    set({
      profile,
      workspace,
      role,
      status: 'authenticated',
    }),

  setStatus: (status) =>
    set({
      status,
    }),

  reset: () =>
    set({
      status: 'unauthenticated',
      user: null,
      session: null,
      profile: null,
      workspace: null,
      role: null,
    }),
}));