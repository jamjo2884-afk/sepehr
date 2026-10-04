/*
# Harden workspace_members RLS — block self-role-escalation and self-removal

## Problem
The original foundation migration (20260719155903) shipped three
"own-row" write policies on `workspace_members`:

1. `insert_own_workspace_member`  — INSERT with `user_id = auth.uid()`
2. `update_own_workspace_member`  — UPDATE own row (INCLUDING `role`!)
3. `delete_own_workspace_member`  — DELETE own row

Consequences before this migration:
- Any authenticated user could UPDATE their own membership row and set
  `role = 'owner'` on themselves — a direct privilege escalation.
- Any authenticated user could INSERT themselves into ANY workspace id they
  knew/guessed (the policy only required `user_id = auth.uid()`; the
  `workspace_id` was unconstrained).
- Members could leave a workspace unilaterally (decision 2026-10-01: closes —
  leaving is now owner/admin-driven only, pending the members-management RPCs).

Role/permission management belongs to workspace owners/admins, enforced in the
service layer + dedicated SECURITY DEFINER RPCs (see the
workspace-members-permissions plan), NEVER through client-writable policies.

## Fix (additive, policy-replacement-only — no data is touched)
- `workspace_members` becomes SELECT-only for regular members:
  - `insert_own_workspace_member`  → DROPPED (no client INSERT path at all).
  - `update_own_workspace_member`  → DROPPED (no client UPDATE path at all;
    role + future per-module permissions can only change via RPC).
  - `delete_own_workspace_member`  → DROPPED (no client DELETE path; leaving a
    workspace is done by an owner/admin through the members UI).
- Membership creation (invites) and role changes will be performed exclusively
  by SECURITY DEFINER RPCs that verify owner/admin inside the function —
  the same proven pattern as `set_guest_mode()`.
- The workspace onboarding trigger (`handle_new_user` on auth.users) is
  SECURITY DEFINER and unaffected: new users still get their own workspace +
  owner membership automatically.

## Safety
- Non-destructive: only policy drops on this table. No table/column/enum is
  altered. Existing rows are untouched. Re-running is safe.
- SELECT policies from 20260719160459 remain in place (own rows + rows of
  workspaces you belong to), so member lists keep working.
- Demo mode has no Supabase backend and is unaffected.
*/

-- ===========================================================================
-- 1. Drop the client-writable write policies (privilege-escalation holes)
-- ===========================================================================

DROP POLICY IF EXISTS "insert_own_workspace_member" ON workspace_members;
DROP POLICY IF EXISTS "update_own_workspace_member" ON workspace_members;
DROP POLICY IF EXISTS "delete_own_workspace_member" ON workspace_members;

-- ===========================================================================
-- 2. Recreate explicit NO-OP guards (documentation in SQL form)
-- ===========================================================================
-- Intentionally NO INSERT/UPDATE/DELETE policy is created here. With RLS
-- enabled and no applicable policy, every client-side write to
-- `workspace_members` is denied by default (fail closed).
--
-- Writes go through SECURITY DEFINER RPCs only:
--   - signup trigger handle_new_user() (existing, untouched)
--   - future: invite_member() / accept_invitation() / update_member_role() /
--     remove_member() — see docs/workspace-members-permissions-plan.md
