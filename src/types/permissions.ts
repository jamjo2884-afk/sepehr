/**
 * Workspace member permission types (Members phase 2).
 *
 * Per-module access matrix stored on `workspace_members.permissions` (jsonb).
 * Levels form an ordered scale: none < view < create < edit (higher includes
 * lower). owner/admin always have full access regardless of the stored matrix;
 * members get exactly their stored matrix. The `settings` module is
 * owner/admin-only and ignored for members (enforced in permissions.ts).
 */

/** Business modules a member's access can be tuned on. */
export type ModuleKey =
  | 'brands'
  | 'social'
  | 'finance'
  | 'tasks'
  | 'content'
  | 'settings';

export const MODULE_KEYS: ModuleKey[] = [
  'brands',
  'social',
  'finance',
  'tasks',
  'content',
  'settings',
];

/** Persian labels for the module keys (settings UI). */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  brands: 'برندها',
  social: 'شبکه‌های اجتماعی',
  finance: 'مالی',
  tasks: 'کارها',
  content: 'محتوا',
  settings: 'تنظیمات',
};

/** Ordered access levels — higher includes lower. */
export type AccessLevel = 'none' | 'view' | 'create' | 'edit';

export const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'create', 'edit'];

/** Persian labels for the access levels. */
export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'هیچ',
  view: 'مشاهده',
  create: 'افزودن',
  edit: 'ویرایش',
};

/**
 * The per-member matrix as stored in `workspace_members.permissions`.
 * Missing keys mean 'none'. For owner/admin the matrix is ignored.
 */
export type PermissionMatrix = Partial<Record<ModuleKey, AccessLevel>>;

/** Raw row shape of `permission_audit`. */
export interface PermissionAuditRow {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  changes: Record<string, { before: string | null; after: string | null }>;
  created_at: string;
}

/** Raw row shape of `workspace_invitations`. */
export interface WorkspaceInvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  permissions: PermissionMatrix;
  token: string;
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}
