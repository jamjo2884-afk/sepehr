import type { ID, Timestamp } from '@/types/index';

/**
 * Application-level roles used across workspace membership.
 *
 * The DB enum `app_role` also carries `writer` (legacy) and `member` (added by
 * migration 20261001130000 for the Members UI); both are accepted here so a
 * stored role always round-trips without a cast error.
 */
export type AppRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'writer'
  | 'viewer'
  | 'member';

/** Roles that get implicit full access on every module (see lib/permissions). */
export const PRIVILEGED_ROLES: readonly AppRole[] = ['owner', 'admin'] as const;

/** Human-readable Persian labels for each role. */
export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'مالک',
  admin: 'مدیر',
  editor: 'ویراستار',
  writer: 'نویسنده',
  viewer: 'بیننده',
  member: 'عضو',
};

/** Lifecycle of an auth session. */
export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

/** A workspace (tenant) in the system. */
export interface Workspace {
  id: ID;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: Timestamp;
}

/** The authenticated user's profile, separate from the Supabase auth User. */
export interface UserProfile {
  id: ID;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: AppRole;
  workspaceId: ID;
}

/** Raw Supabase row shape for the `workspaces` table. */
export interface WorkspaceRow {
  id: ID;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: Timestamp;
}

/** Raw Supabase row shape for the `profiles` table. */
export interface ProfileRow {
  id: ID;
  full_name: string;
  avatar_url: string | null;
  role: AppRole;
  workspace_id: ID;
}

/** Raw Supabase row shape for the `workspace_members` table. */
export interface WorkspaceMemberRow {
  id: ID;
  workspace_id: ID;
  user_id: ID;
  role: AppRole;
  created_at: Timestamp;
  /**
   * Per-module access matrix (Members phase 2). Raw unknown shape from the
   * jsonb column — resolve through sanitizeMatrix()/moduleAccess() in
   * lib/permissions rather than reading the keys directly.
   */
  permissions?: unknown;
}
