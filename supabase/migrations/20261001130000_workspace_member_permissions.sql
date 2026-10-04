/*
# Workspace member permissions — per-module access matrix (Members phase 2)

## Purpose
Implements docs/workspace-members-permissions-plan.md:
- Per-member, per-module access levels on `workspace_members` (jsonb column).
- `permission_audit` table (who changed what, before/after).
- `workspace_invitations` table (manual-link invites, 7-day expiry).
- SECURITY DEFINER RPCs — the ONLY client-writable paths for membership
  rows (the 20261001 hardening migration removed every client write policy):
    * update_member_access(p_target_user_id, p_role?, p_permissions?)
    * remove_workspace_member(p_target_user_id)
    * create_workspace_invitation(p_email, p_role, p_permissions)
    * accept_workspace_invitation(p_token)
    * revoke_workspace_invitation(p_invitation_id)

## Module/level model (approved by owner 2026-10-01)
- Modules: brands, social, finance, tasks, content, settings.
- Levels:  none < view < create < edit   (higher includes lower).
- New members default to ALL 'none' (owner decides per member afterwards).
- owner = full access, immutable matrix. admin = full access + member mgmt
  (cannot touch owners). member = exactly their stored matrix; the `settings`
  key is ignored for members (settings is owner/admin-only, enforced in code).

## Bugs found and fixed while applying (2026-10-04)
This file had NEVER been applied to the live database. Three defects made it
unrunnable or non-functional; all three were confirmed by executing the
offending SQL, not by reading it:
1. `'member'` was used as the default invite role and as
   `workspace_invitations.role DEFAULT 'member'`, but the live `app_role` enum
   is `owner|admin|editor|writer|viewer`. `'member'::app_role` raised
   `invalid input value for enum app_role`. Fixed by adding the value (sec. 1).
2. The invitations SELECT policy referenced `user_id_check(email)`, a function
   that exists nowhere in the database — creating the policy raised
   `function user_id_check(text) does not exist`. The clause was both broken and
   dead: accepting an invite goes through the SECURITY DEFINER
   `accept_workspace_invitation()` token lookup, so no client read is needed.
3. `create_workspace_invitation` called `gen_random_bytes(32)` unqualified.
   On Supabase that function lives in the `extensions` schema, while every RPC
   here pins `search_path = public`, so building a token raised
   `function gen_random_bytes(integer) does not exist`. Now schema-qualified.
4. The same call used `encode(..., 'base64url')`, but 'base64url' is a Node
   encoding name, not a PostgreSQL one — it raised
   `unrecognized encoding: "base64url"`. Replaced with plain 'base64' plus a
   translate() to the URL-safe alphabet (and '=' padding dropped).

## Safety
- Additive only: one enum value + new column + two new tables + new functions.
  No existing table/policy is dropped (policy drops live in 20261001120000).
- Idempotent: IF NOT EXISTS / DROP IF EXISTS + CREATE OR REPLACE.
- Every RPC re-checks caller authority INSIDE the function (defense in depth
  alongside route wrappers) and writes an audit_logs row (control-center feed)
  — permission_audit additionally stores the per-module before/after diff.
- Added guards during the first apply: `update_member_access` refuses to target
  the caller; `remove_workspace_member` refuses self-removal and refuses to
  remove the LAST owner (which would leave the workspace with nobody able to
  manage members, since every mutation RPC requires owner/admin).
- JSON validation: level whitelist enforced by a CHECK-style helper inside the
  RPCs and mirrored by zod in the API layer.
*/

-- ===========================================================================
-- 1. 'member' role in app_role
-- ===========================================================================
-- The Members model (owner / admin / member) needs a 'member' enum value, but the
-- original app_role enum only has owner|admin|editor|writer|viewer — verified
-- against the live DB: `'member'::app_role` raised
-- "invalid input value for enum app_role". ADD VALUE is additive and does not
-- rewrite existing rows. IF NOT EXISTS keeps the file re-runnable.
--
-- NOTE: PG restricts using a NEW enum value in the same transaction that added
-- it. Every use below is in a later statement, but on older servers this can
-- still conflict inside one transaction, so callers that run this file as a
-- single multi-statement transaction should apply section 1 on its own first.
DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'member';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. permissions jsonb column on workspace_members
-- ===========================================================================
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN workspace_members.permissions IS
  'Per-module access matrix: {"brands":"view","social":"none",...}. Modules: brands|social|finance|tasks|content|settings. Levels: none|view|create|edit. Ignored for owner/admin (always full). Missing keys / empty object = all none.';

-- ===========================================================================
-- 3. permission_audit — full before/after history of access changes
-- ===========================================================================
CREATE TABLE IF NOT EXISTS permission_audit (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id       uuid,                     -- who made the change
  target_user_id uuid NOT NULL,            -- whose access changed
  action         text NOT NULL DEFAULT 'permissions.updated',
  changes        jsonb NOT NULL DEFAULT '{}', -- {module:{before,after}} | {role:{before,after}}
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_ws_created
  ON permission_audit(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_target
  ON permission_audit(workspace_id, target_user_id);

ALTER TABLE permission_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_read_permission_audit" ON permission_audit;
CREATE POLICY "workspace_read_permission_audit"
ON permission_audit FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id));

-- No client INSERT/UPDATE/DELETE policies — only the RPCs below write here.

-- ===========================================================================
-- 4. workspace_invitations — manual-link invites (no SMTP in phase 1)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         app_role NOT NULL DEFAULT 'member',
  permissions  jsonb NOT NULL DEFAULT '{}',
  token        text NOT NULL UNIQUE,
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_ws
  ON workspace_invitations(workspace_id, status);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Read scope: any member of the workspace can list its open invitations (the
-- Members UI shows the pending-invites list to owner/admin, and this policy is
-- the storage-level backstop behind the route's requireRole gate).
--
-- An earlier draft also tried to let the invited user read their own invitation
-- by email via a `user_id_check()` helper. That function does not exist anywhere
-- in the database — creating this policy failed with
-- "function user_id_check(text) does not exist". Accepting an invite never needs
-- a client read: accept_workspace_invitation() is SECURITY DEFINER and looks the
-- invitation up by token internally, so the clause was dead weight as well as
-- broken. The invitee therefore cannot list workspace invitations — correct.
DROP POLICY IF EXISTS "workspace_read_invitations" ON workspace_invitations;
CREATE POLICY "workspace_read_invitations"
ON workspace_invitations FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id));

-- Owner/admin read (simplify: same membership read policy, fine — email
-- addresses of open invites are low-sensitivity within a workspace).

-- No client INSERT/UPDATE/DELETE policies — RPCs only.

-- ===========================================================================
-- 5. Shared helpers
-- ===========================================================================

CREATE OR REPLACE FUNCTION is_valid_access_level(v text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT v IN ('none','view','create','edit');
$$;

CREATE OR REPLACE FUNCTION is_valid_permission_matrix(p jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_each_text(p) AS e(k, val)
    WHERE k NOT IN ('brands','social','finance','tasks','content','settings')
       OR NOT is_valid_access_level(val)
  );
$$;

-- Caller's role inside a given workspace (NULL when not a member).
CREATE OR REPLACE FUNCTION workspace_role_of(ws uuid, uid uuid)
RETURNS app_role
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role FROM workspace_members m
  WHERE m.workspace_id = ws AND m.user_id = uid
  LIMIT 1;
$$;

-- ===========================================================================
-- 6. RPC: update_member_access (role and/or permission matrix)
-- ===========================================================================
CREATE OR REPLACE FUNCTION update_member_access(
  p_target_user_id uuid,
  p_role           text DEFAULT NULL,
  p_permissions    jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws     uuid;
  v_caller_role app_role;
  v_target_role app_role;
  v_new_role    app_role;
  v_old_perms   jsonb;
  v_new_perms   jsonb;
  v_diff        jsonb := '{}'::jsonb;
  v_mod         text;
  v_before      text;
  v_after       text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'update_member_access: not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Resolve the caller's workspace + role (must be owner/admin somewhere).
  SELECT m.workspace_id, m.role INTO v_ws, v_caller_role
  FROM workspace_members m
  WHERE m.user_id = v_caller
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1;

  IF v_ws IS NULL OR v_caller_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'update_member_access: only workspace owners/admins may change member access'
      USING ERRCODE = '42501';
  END IF;

  -- Target must belong to the SAME workspace.
  SELECT m.role, m.permissions INTO v_target_role, v_old_perms
  FROM workspace_members m
  WHERE m.workspace_id = v_ws AND m.user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_member_access: target is not a member of this workspace'
      USING ERRCODE = 'P0002';
  END IF;

  -- Nobody can target an owner (owner is immutable except by DBA/migration).
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'update_member_access: owner access is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- Admins cannot promote to owner either.
  IF p_role = 'owner' AND v_caller_role = 'admin' THEN
    RAISE EXCEPTION 'update_member_access: admins cannot promote to owner'
      USING ERRCODE = '42501';
  END IF;

  -- Cannot target yourself (avoid an admin locking themselves out).
  IF p_target_user_id = v_caller THEN
    RAISE EXCEPTION 'update_member_access: cannot change your own access here'
      USING ERRCODE = '42501';
  END IF;

  -- Role change (owner|admin|editor|viewer|member allowed by enum; API layer
  -- restricts to admin/member — the RPC accepts any enum value for flexibility).
  IF p_role IS NOT NULL THEN
    v_new_role := p_role::app_role;
    IF v_new_role IS DISTINCT FROM v_target_role THEN
      UPDATE workspace_members SET role = v_new_role
      WHERE workspace_id = v_ws AND user_id = p_target_user_id;
      v_diff := v_diff || jsonb_build_object('role',
        jsonb_build_object('before', v_target_role, 'after', v_new_role));
      v_target_role := v_new_role;
    END IF;
  END IF;

  -- Permission matrix change.
  IF p_permissions IS NOT NULL THEN
    IF NOT is_valid_permission_matrix(p_permissions) THEN
      RAISE EXCEPTION 'update_member_access: invalid module key or access level'
        USING ERRCODE = '22023';
    END IF;
    v_new_perms := p_permissions;
    IF v_new_perms IS DISTINCT FROM v_old_perms THEN
      -- Per-module before/after diff for the audit trail.
      FOR v_mod IN SELECT DISTINCT
                     COALESCE(k1, k2)
                   FROM (
                     SELECT jsonb_object_keys(v_old_perms) AS k1, NULL::text AS k2
                     UNION ALL
                     SELECT NULL::text, jsonb_object_keys(v_new_perms)
                   ) u
      LOOP
        v_before := COALESCE(v_old_perms->>v_mod, 'none');
        v_after  := COALESCE(v_new_perms->>v_mod, 'none');
        IF v_before IS DISTINCT FROM v_after THEN
          v_diff := v_diff || jsonb_build_object(v_mod,
            jsonb_build_object('before', v_before, 'after', v_after));
        END IF;
      END LOOP;

      UPDATE workspace_members SET permissions = v_new_perms
      WHERE workspace_id = v_ws AND user_id = p_target_user_id;
    END IF;
  END IF;

  IF v_diff = '{}'::jsonb THEN
    -- Nothing changed — return current state without writing audit rows.
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  INSERT INTO permission_audit (workspace_id, actor_id, target_user_id, changes)
  VALUES (v_ws, v_caller, p_target_user_id, v_diff);

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_ws, v_caller, 'member.access_updated', 'workspace_member',
    p_target_user_id::text, jsonb_build_object('changes', v_diff)
  );

  RETURN jsonb_build_object('ok', true, 'changed', true, 'changes', v_diff);
END;
$$;

-- ===========================================================================
-- 7. RPC: remove_workspace_member
-- ===========================================================================
CREATE OR REPLACE FUNCTION remove_workspace_member(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws     uuid;
  v_caller_role app_role;
  v_target_role app_role;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'remove_workspace_member: not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.workspace_id, m.role INTO v_ws, v_caller_role
  FROM workspace_members m
  WHERE m.user_id = v_caller
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1;

  IF v_ws IS NULL OR v_caller_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'remove_workspace_member: only workspace owners/admins may remove members'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role INTO v_target_role
  FROM workspace_members m
  WHERE m.workspace_id = v_ws AND m.user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'remove_workspace_member: target is not a member of this workspace'
      USING ERRCODE = 'P0002';
  END IF;

  -- Owners can only be removed by owners; admins can never remove owners.
  IF v_target_role = 'owner' THEN
    IF v_caller_role <> 'owner' THEN
      RAISE EXCEPTION 'remove_workspace_member: admins cannot remove owners'
        USING ERRCODE = '42501';
    END IF;

    -- Never remove the LAST owner: the workspace would be left with nobody
    -- able to manage members (every mutation RPC requires owner/admin), and
    -- role changes cannot promote anyone to owner from the Members UI.
    IF (SELECT count(*) FROM workspace_members m
        WHERE m.workspace_id = v_ws AND m.role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'remove_workspace_member: cannot remove the last owner of the workspace'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Removing yourself is refused for the same reason: an admin demoting
  -- themselves to a plain member would silently strip their own authority.
  IF p_target_user_id = v_caller THEN
    RAISE EXCEPTION 'remove_workspace_member: cannot remove yourself'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM workspace_members
  WHERE workspace_id = v_ws AND user_id = p_target_user_id;

  INSERT INTO permission_audit (workspace_id, actor_id, target_user_id, action, changes)
  VALUES (v_ws, v_caller, p_target_user_id, 'member.removed',
          jsonb_build_object('role', jsonb_build_object('before', v_target_role, 'after', null)));

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_ws, v_caller, 'member.removed', 'workspace_member',
    p_target_user_id::text, jsonb_build_object('removed_role', v_target_role)
  );

  RETURN true;
END;
$$;

-- ===========================================================================
-- 8. RPC: create_workspace_invitation
-- ===========================================================================
CREATE OR REPLACE FUNCTION create_workspace_invitation(
  p_email       text,
  p_role        text DEFAULT 'member',
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws     uuid;
  v_caller_role app_role;
  v_inv_id uuid;
  v_token  text;
  v_email  text := lower(btrim(p_email));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'create_workspace_invitation: not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_email NOT LIKE '%_@_%._%' THEN
    RAISE EXCEPTION 'create_workspace_invitation: invalid email' USING ERRCODE = '22023';
  END IF;

  IF p_role NOT IN ('admin','member','editor','viewer') THEN
    RAISE EXCEPTION 'create_workspace_invitation: cannot invite as owner' USING ERRCODE = '22023';
  END IF;

  IF NOT is_valid_permission_matrix(p_permissions) THEN
    RAISE EXCEPTION 'create_workspace_invitation: invalid permission matrix' USING ERRCODE = '22023';
  END IF;

  SELECT m.workspace_id, m.role INTO v_ws, v_caller_role
  FROM workspace_members m
  WHERE m.user_id = v_caller
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1;

  IF v_ws IS NULL OR v_caller_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'create_workspace_invitation: only workspace owners/admins may invite'
      USING ERRCODE = '42501';
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = v_ws
      AND m.user_id = (SELECT u.id FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1)
  ) THEN
    RAISE EXCEPTION 'create_workspace_invitation: user is already a member' USING ERRCODE = '23505';
  END IF;

  -- Two portability fixes here, both found by executing the RPC against the
  -- live database rather than by reading it:
  --
  -- 1. gen_random_bytes() lives in the `extensions` schema on Supabase, but
  --    every RPC here pins `search_path = public`. Unqualified it raised
  --    "function gen_random_bytes(integer) does not exist".
  -- 2. PostgreSQL's encode() has no 'base64url' encoding — that name only
  --    exists in Node. `encode(..., 'base64')` plus a translate() that swaps
  --    '+' -> '-', '/' -> '_' and strips '=' padding produces a URL-safe token
  --    that survives a path segment unchanged (no escaping, no %2B).
  --
  -- 32 random bytes = 256 bits of entropy, so the token is not guessable.
  v_token := translate(
    encode(extensions.gen_random_bytes(32), 'base64'),
    '+/=',
    '-_'
  );

  -- Re-inviting a revoked/expired address: refresh the same row.
  INSERT INTO workspace_invitations
    (workspace_id, email, role, permissions, token, invited_by, status, expires_at)
  VALUES
    (v_ws, v_email, p_role::app_role, p_permissions, v_token, v_caller,
     'pending', now() + interval '7 days')
  ON CONFLICT (workspace_id, email) DO UPDATE
    SET role        = EXCLUDED.role,
        permissions = EXCLUDED.permissions,
        token       = EXCLUDED.token,
        invited_by  = EXCLUDED.invited_by,
        status      = 'pending',
        expires_at  = EXCLUDED.expires_at,
        accepted_at = NULL
  RETURNING id INTO v_inv_id;

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_ws, v_caller, 'member.invited', 'workspace_invitation', v_inv_id::text,
    jsonb_build_object('email', v_email, 'role', p_role)
  );

  RETURN v_inv_id;
END;
$$;

-- ===========================================================================
-- 9. RPC: revoke_workspace_invitation
-- ===========================================================================
CREATE OR REPLACE FUNCTION revoke_workspace_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ws     uuid;
  v_caller_role app_role;
  v_email  text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'revoke_workspace_invitation: not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.workspace_id, m.role INTO v_ws, v_caller_role
  FROM workspace_members m
  WHERE m.user_id = v_caller
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1;

  IF v_ws IS NULL OR v_caller_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'revoke_workspace_invitation: only workspace owners/admins may revoke'
      USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email
  FROM workspace_invitations
  WHERE id = p_invitation_id AND workspace_id = v_ws;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'revoke_workspace_invitation: invitation not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE workspace_invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id AND status = 'pending';

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_ws, v_caller, 'member.invitation_revoked', 'workspace_invitation',
    p_invitation_id::text, jsonb_build_object('email', v_email)
  );

  RETURN true;
END;
$$;

-- ===========================================================================
-- 10. RPC: accept_workspace_invitation (called by the LOGGED-IN invitee)
-- ===========================================================================
CREATE OR REPLACE FUNCTION accept_workspace_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email  text;
  v_ws     uuid;
  v_role   app_role;
  v_perms  jsonb;
  v_inv_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'accept_workspace_invitation: sign in first' USING ERRCODE = '42501';
  END IF;

  SELECT id, workspace_id, role, permissions, lower(email)
    INTO v_inv_id, v_ws, v_role, v_perms, v_email
  FROM workspace_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accept_workspace_invitation: invitation is invalid, expired or revoked'
      USING ERRCODE = 'P0002';
  END IF;

  -- The logged-in user's email must match the invited address.
  IF COALESCE(lower((SELECT email FROM auth.users WHERE id = v_caller)), '') <> v_email THEN
    RAISE EXCEPTION 'accept_workspace_invitation: signed in with a different email than invited'
      USING ERRCODE = '42501';
  END IF;

  -- Already a member (stale invitation)? Accept as no-op and mark it.
  IF EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = v_ws AND m.user_id = v_caller
  ) THEN
    UPDATE workspace_invitations SET status = 'accepted', accepted_at = now()
    WHERE id = v_inv_id;
    RETURN v_ws;
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
  VALUES (v_ws, v_caller, v_role, v_perms);

  UPDATE workspace_invitations SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv_id;

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_ws, v_caller, 'member.joined', 'workspace_invitation', v_inv_id::text,
    jsonb_build_object('email', v_email, 'role', v_role)
  );

  RETURN v_ws;
END;
$$;

-- ===========================================================================
-- 11. EXECUTE grants (authenticated only — never anon)
-- ===========================================================================
GRANT EXECUTE ON FUNCTION update_member_access(uuid, text, jsonb)        TO authenticated;
GRANT EXECUTE ON FUNCTION remove_workspace_member(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION create_workspace_invitation(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_workspace_invitation(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION accept_workspace_invitation(text)              TO authenticated;
REVOKE EXECUTE ON FUNCTION update_member_access(uuid, text, jsonb)        FROM anon;
REVOKE EXECUTE ON FUNCTION remove_workspace_member(uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION create_workspace_invitation(text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION revoke_workspace_invitation(uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION accept_workspace_invitation(text)              FROM anon;
