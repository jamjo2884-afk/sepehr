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
  // ورود آزمایشی بدون لاگین
  status: 'authenticated',

  user: null,
  session: null,
  profile: null,
  workspace: {
    id: 'demo',
    name: 'MediaOS Demo Workspace',
    slug: 'mediaos-demo',
    logoUrl: null,
    createdAt: new Date().toISOString(),
  },
  role: 'owner',

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

  setStatus: () =>
    set({
      status: 'authenticated',
    }),

  reset: () =>
    set({
      status: 'authenticated',
      user: null,
      session: null,
      profile: null,
      workspace: {
        id: 'demo',
        name: 'MediaOS Demo Workspace',
        slug: 'mediaos-demo',
        logoUrl: null,
        createdAt: new Date().toISOString(),
      },
      role: 'owner',
    }),
}));