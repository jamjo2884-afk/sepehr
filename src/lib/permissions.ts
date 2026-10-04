/**
 * Module permission engine (Members phase 2).
 *
 * Resolves a caller's per-module access from their WorkspaceContext and
 * provides requireModule* route wrappers layered on withAuth. The UI is never
 * trusted: every API route enforces these checks server-side, and mutating
 * membership data additionally flows through SECURITY DEFINER RPCs that
 * re-check owner/admin inside the database (see migration
 * 20261001130000_workspace_member_permissions.sql).
 *
 * Model (docs/workspace-members-permissions-plan.md, approved 2026-10-01):
 * - Modules: brands, social, finance, tasks, content, settings.
 * - Levels: none < view < create < edit (higher includes lower).
 * - owner: full, immutable. admin: full + member management.
 * - member: exactly the stored matrix; 'settings' is owner/admin-only.
 * - guest: read-only via the existing guest allowlist — module wrappers deny
 *   guests outright (guests must never reach member-gated data).
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-auth';
import { isGuestUser } from '@/lib/guest-mode';
import type { WorkspaceContext } from '@/lib/workspace';
import type {
  AccessLevel,
  ModuleKey,
  PermissionMatrix,
} from '@/types/permissions';
import { ACCESS_LEVELS, MODULE_KEYS } from '@/types/permissions';

/* =========================================================================
 * Matrix resolution
 * ========================================================================= */

const LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  create: 2,
  edit: 3,
};

/** owner/admin bypass the matrix entirely. */
export function isPrivilegedRole(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Coerce an unknown value (DB jsonb) into a safe PermissionMatrix — unknown
 * module keys and unknown levels are dropped (fail closed).
 */
export function sanitizeMatrix(input: unknown): PermissionMatrix {
  const out: PermissionMatrix = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (
      (MODULE_KEYS as string[]).includes(key) &&
      typeof value === 'string' &&
      (ACCESS_LEVELS as string[]).includes(value)
    ) {
      out[key as ModuleKey] = value as AccessLevel;
    }
  }
  return out;
}

/**
 * Resolve the caller's effective access level for a module.
 * - owner/admin → 'edit' (full).
 * - guest → 'none' (guests only reach the dedicated guest allowlist).
 * - member → stored level; missing key = 'none'. The 'settings' module is
 *   always 'none' for members regardless of the stored matrix.
 */
export function moduleAccess(
  ws: Pick<WorkspaceContext, 'role' | 'permissions'>,
  module: ModuleKey,
): AccessLevel {
  if (isPrivilegedRole(ws.role)) return 'edit';
  if (module === 'settings') return 'none';
  const matrix = sanitizeMatrix(ws.permissions);
  return matrix[module] ?? 'none';
}

export function canView(
  ws: Pick<WorkspaceContext, 'role' | 'permissions'>,
  module: ModuleKey,
): boolean {
  return LEVEL_RANK[moduleAccess(ws, module)] >= LEVEL_RANK.view;
}

export function canCreate(
  ws: Pick<WorkspaceContext, 'role' | 'permissions'>,
  module: ModuleKey,
): boolean {
  return LEVEL_RANK[moduleAccess(ws, module)] >= LEVEL_RANK.create;
}

export function canEdit(
  ws: Pick<WorkspaceContext, 'role' | 'permissions'>,
  module: ModuleKey,
): boolean {
  return LEVEL_RANK[moduleAccess(ws, module)] >= LEVEL_RANK.edit;
}

/* =========================================================================
 * Route wrappers
 * ========================================================================= */

type RouteHandler = Parameters<typeof withAuth>[0];

function moduleGate(
  module: ModuleKey,
  minimum: AccessLevel,
  handler: RouteHandler,
) {
  return withAuth(async (req, auth, ctx) => {
    const { workspace } = auth;

    // Guests never pass a module gate (their reads flow through the dedicated
    // guest allowlist routes, which do NOT use these wrappers).
    if (isGuestUser(auth.user)) {
      return NextResponse.json(
        { ok: false, error: 'کاربر مهمان به این بخش دسترسی ندارد.' },
        { status: 403 },
      );
    }

    // Membership is already proven by withAuth; now the module level.
    if (LEVEL_RANK[moduleAccess(workspace, module)] < LEVEL_RANK[minimum]) {
      return NextResponse.json(
        { ok: false, error: 'دسترسی شما برای این بخش کافی نیست.' },
        { status: 403 },
      );
    }

    return handler(req, auth, ctx);
  });
}

/** Require at least view access on a module (reads). */
export function requireModuleView(module: ModuleKey) {
  return (handler: RouteHandler) => moduleGate(module, 'view', handler);
}

/** Require at least create access on a module (adding rows). */
export function requireModuleCreate(module: ModuleKey) {
  return (handler: RouteHandler) => moduleGate(module, 'create', handler);
}

/** Require edit access on a module (changing/deleting rows). */
export function requireModuleEdit(module: ModuleKey) {
  return (handler: RouteHandler) => moduleGate(module, 'edit', handler);
}
