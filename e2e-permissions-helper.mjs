/**
 * Resolves a caller's effective access level for a module through the exact
 * chain the application uses:
 *
 *   getCurrentWorkspace()  -> workspace_members row for (user_id = auth.uid())
 *   -> moduleAccess()      -> owner/admin bypass, settings locked, else stored
 *
 * This mirrors src/lib/permissions.ts so the E2E can assert the value a gated
 * route WOULD compute, using a real authenticated client (so RLS applies).
 */

const LEVEL_RANK = { none: 0, view: 1, create: 2, edit: 3 };

/** Fail-closed copy of sanitizeMatrix(). */
function sanitizeMatrix(input) {
  const MODULES = ['brands', 'social', 'finance', 'tasks', 'content', 'settings'];
  const LEVELS = ['none', 'view', 'create', 'edit'];
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    if (MODULES.includes(key) && LEVELS.includes(value)) out[key] = value;
  }
  return out;
}

/** Copy of moduleAccess() from src/lib/permissions.ts. */
function resolveAccess(ws, moduleName) {
  if (ws.role === 'owner' || ws.role === 'admin') return 'edit';
  if (moduleName === 'settings') return 'none';
  const matrix = sanitizeMatrix(ws.permissions);
  return matrix[moduleName] ?? 'none';
}

/**
 * Fetch the CALLER'S OWN membership row (exactly as getCurrentWorkspace does)
 * and resolve `moduleName`.
 *
 * Filter by user_id, NOT workspace_id: a workspace_id filter returns every
 * member of the workspace, and `limit(1)` would then pick the owner's row and
 * report 'edit' for everyone. Returns { level, role, permissions }.
 */
export async function moduleAccess(client, moduleName, userId) {
  let query = client
    .from('workspace_members')
    .select('workspace_id, user_id, role, permissions')
    .eq('user_id', userId);

  const { data, error } = await query.limit(1).single();
  if (error || !data) throw new Error(`membership lookup failed: ${error?.message}`);

  const level = resolveAccess(
    { role: data.role, permissions: data.permissions },
    moduleName,
  );
  return { level, role: data.role, permissions: sanitizeMatrix(data.permissions) };
}

export { resolveAccess, LEVEL_RANK };
