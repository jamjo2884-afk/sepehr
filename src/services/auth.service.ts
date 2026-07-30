import { supabase } from '@/lib/supabase';
import type {
  ProfileRow,
  Workspace,
  WorkspaceRow,
  UserProfile,
  WorkspaceMemberRow,
  AppRole,
} from '@/types/auth';

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

function mapProfile(row: ProfileRow, email: string): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email,
    avatarUrl: row.avatar_url ?? undefined,
    role: row.role,
    workspaceId: row.workspace_id,
  };
}

/** Fetch the current user's profile + primary workspace in a single round-trip. */
export async function fetchAuthContext(userId: string, email: string) {
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (profileErr) throw profileErr;
  if (!profileRow) return { profile: null, workspace: null };

  const profile = mapProfile(profileRow, email);

  let workspace: Workspace | null = null;
  if (profileRow.workspace_id) {
    const { data: workspaceRow, error: workspaceErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', profileRow.workspace_id)
      .maybeSingle<WorkspaceRow>();
    if (workspaceErr) throw workspaceErr;
    if (workspaceRow) workspace = mapWorkspace(workspaceRow);
  }

  return { profile, workspace };
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
}

export async function signUp({ email, password, fullName }: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export interface SignInInput {
  email: string;
  password: string;
}

export async function signIn({ email, password }: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPasswordForEmail(email: string) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateProfileFullName(fullName: string) {
  const { data: authUser } = await supabase.auth.getUser();
  const userId = authUser.user?.id;
  if (!userId) throw new Error('کاربر وارد نشده است.');

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId);
  if (error) throw error;
}

/** List members of the current user's primary workspace. */
export async function listWorkspaceMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .returns<WorkspaceMemberRow[]>();
  if (error) throw error;
  return data ?? [];
}

export type { AppRole };
