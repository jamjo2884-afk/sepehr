import type { Session, User } from '@supabase/supabase-js';

export type AppRole = 'owner' | 'admin' | 'editor' | 'writer' | 'viewer';

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'مالک',
  admin: 'مدیر',
  editor: 'ویراستار',
  writer: 'نویسنده',
  viewer: 'بیننده',
};

export const ROLE_ORDER: AppRole[] = [
  'owner',
  'admin',
  'editor',
  'writer',
  'viewer',
];

/** Raw row in the `workspaces` table. */
export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
}

/** Raw row in the `profiles` table. */
export interface ProfileRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: AppRole;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw row in the `workspace_members` table. */
export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

/** Normalized workspace used across the app. */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
}

/** Normalized user profile used across the app. */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: AppRole;
  workspaceId: string | null;
}

export interface AuthSession {
  user: User;
  session: Session;
  profile: UserProfile | null;
  workspace: Workspace | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
