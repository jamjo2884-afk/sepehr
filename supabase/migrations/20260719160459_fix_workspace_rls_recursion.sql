/*
# Fix infinite recursion in workspace RLS policies

## Problem
The SELECT policies on `workspaces` and `workspace_members` both checked
membership by querying `workspace_members` from within that table's own RLS
policy, causing infinite recursion ("infinite recursion detected in policy
for relation workspace_members").

## Fix
1. Add a SECURITY DEFINER helper function `is_workspace_member(workspace_uuid)`
   that checks membership while bypassing RLS (SECURITY DEFINER runs with the
   function owner's privileges, not the caller's, so RLS is not re-evaluated).
   The function is read-only and only returns a boolean, so it is safe.
2. Rewrite the SELECT policies on `workspaces` and `workspace_members` to call
   this helper instead of sub-querying `workspace_members` directly.
3. Keep the INSERT/UPDATE/DELETE policies unchanged (they check `user_id =
   auth.uid()` directly and do not recurse).

## Security
- `is_workspace_member` is SECURITY DEFINER, owned by the postgres role, and
  only performs a SELECT ... INTO check. It cannot be used to escalate
  privileges — it only answers "is the current auth.uid() a member of this
  workspace?".
- All other policies remain ownership/membership scoped to `authenticated`.

## Notes
- Re-running is safe: function is CREATE OR REPLACE, policies dropped first.
*/

-- ===========================================================================
-- 1. Membership helper (SECURITY DEFINER — bypasses RLS, no recursion)
-- ===========================================================================
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspace_uuid AND m.user_id = auth.uid()
  );
$$;

-- ===========================================================================
-- 2. Rewrite recursing SELECT policies
-- ===========================================================================

-- workspaces SELECT
DROP POLICY IF EXISTS "members_select_workspaces" ON workspaces;
CREATE POLICY "members_select_workspaces"
ON workspaces FOR SELECT
TO authenticated
USING (is_workspace_member(workspaces.id));

-- workspace_members SELECT: own rows OR rows of a workspace you belong to
DROP POLICY IF EXISTS "members_select_workspace_members" ON workspace_members;
CREATE POLICY "members_select_workspace_members"
ON workspace_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_workspace_member(workspace_id)
);

-- profiles SELECT: own profile OR profile of someone in a workspace you belong to
DROP POLICY IF EXISTS "select_own_or_workspace_profiles" ON profiles;
CREATE POLICY "select_own_or_workspace_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    workspace_id IS NOT NULL
    AND is_workspace_member(workspace_id)
  )
);
