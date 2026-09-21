/*
# Guest Mode — DB-backed runtime toggle (app_settings singleton)

## Purpose
Move the guest-mode opt-in from a static env var (GUEST_MODE_ENABLED) to a
DB-backed singleton row so owners/admins can toggle it at runtime from the
Settings UI without a redeploy.

## New objects
1. `app_settings` (singleton, enforced by CHECK id = 1)
   - guest_mode_enabled boolean NOT NULL DEFAULT false
   - changed_by uuid (auth.users, nullable — RPC caller)
   - changed_at timestamptz NOT NULL DEFAULT now()
   - updated_at timestamptz NOT NULL DEFAULT now()
2. `set_guest_mode(enabled boolean)` — SECURITY DEFINER RPC
   - Caller MUST be an owner/admin in at least one workspace
     (checked INSIDE the function against workspace_members — the client
     never writes the row directly; there is no client-writable policy).
   - INSERT-or-UPDATE on the singleton, stamps changed_by/changed_at.
   - Writes a row into the existing `audit_logs` table:
     entity_type='app_settings', entity_id='guest_mode',
     metadata={enabled, reason:null} — WHO (user_id) and WHEN (created_at).
   - Returns the new state as a single boolean cell.
3. RPC EXECUTE granted to `authenticated` only (NOT anon) — guests cannot
   even call it; the role check inside guards privilege escalation.

## Safety
- Additive only; no existing table/policy is dropped or altered.
- RLS enabled on app_settings with owner/admin read for authenticated users;
  anon can still read the row via the separate public read policy so the
  lightweight flag fetch in isGuestModeEnabled() works without a session
  (it reads ONE boolean — no tenant data in this table).
- Idempotent: re-runnable (IF NOT EXISTS / DROP+CREATE policy / OR REPLACE).

## Note on audit storage
The requirement asked for "changed_by/changed_at in the same table OR the
existing audit_logs". We do BOTH: the singleton row keeps the latest actor
(changed_by/changed_at) for cheap display, and every toggle appends an
immutable row to audit_logs (user_id + created_at) for the full history.
*/

-- ===========================================================================
-- 1. Singleton settings table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  -- Singleton: exactly one row, enforced by CHECK.
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  guest_mode_enabled  boolean    NOT NULL DEFAULT false,
  changed_by          uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row if absent (guest mode defaults to OFF).
INSERT INTO app_settings (id, guest_mode_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. Policies
-- ===========================================================================
-- Owner/admin can read the singleton (UI shows current state).
DROP POLICY IF EXISTS "admin_read_app_settings" ON app_settings;
CREATE POLICY "admin_read_app_settings"
ON app_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);

-- anon may read the singleton so the lightweight, session-less REST fetch
-- used by isGuestModeEnabled() works for visitors. The table holds no tenant
-- data — one boolean plus the latest-change timestamp/actor uuid.
DROP POLICY IF EXISTS "public_read_guest_flag" ON app_settings;
CREATE POLICY "public_read_guest_flag"
ON app_settings FOR SELECT
TO anon
USING (true);

-- NO INSERT/UPDATE/DELETE policies for ANY role: the row can only change
-- through the SECURITY DEFINER RPC below.

-- ===========================================================================
-- 3. set_guest_mode RPC — SECURITY DEFINER, owner/admin gate inside
-- ===========================================================================
CREATE OR REPLACE FUNCTION set_guest_mode(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_authorized boolean;
  v_workspace uuid;
BEGIN
  -- Gate INSIDE the function: caller must be an owner/admin in at least one
  -- workspace. No client UPDATE path exists — this is the only write route.
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.user_id = v_caller AND m.role IN ('owner', 'admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'set_guest_mode: only workspace owners/admins may toggle guest mode'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- Stamp the actor on the singleton row (latest-change snapshot).
  INSERT INTO app_settings (id, guest_mode_enabled, changed_by, changed_at, updated_at)
  VALUES (1, p_enabled, v_caller, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET guest_mode_enabled = EXCLUDED.guest_mode_enabled,
        changed_by         = EXCLUDED.changed_by,
        changed_at         = EXCLUDED.changed_at,
        updated_at         = EXCLUDED.updated_at;

  -- Immutable history: who (user_id) and when (created_at) — same audit_logs
  -- table used by the Phase 23 control center. Logged under the caller's own
  -- workspace (first membership) so the row is visible in that workspace's
  -- audit trail.
  SELECT m.workspace_id INTO v_workspace
  FROM workspace_members m
  WHERE m.user_id = v_caller
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1;

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_workspace,
    v_caller,
    'guest_mode.toggled',
    'app_settings',
    'guest_mode',
    jsonb_build_object('enabled', p_enabled)
  );

  RETURN (SELECT guest_mode_enabled FROM app_settings WHERE id = 1);
END;
$$;

REVOKE ALL ON FUNCTION set_guest_mode(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_guest_mode(boolean) TO authenticated;

-- ===========================================================================
-- 4. Convenience helper used by the lightweight anon fetch (optional read)
-- ===========================================================================
CREATE OR REPLACE FUNCTION get_guest_mode_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT guest_mode_enabled FROM app_settings WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION get_guest_mode_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_guest_mode_enabled() TO anon, authenticated;

-- ===========================================================================
-- 6. audit_logs: allow the SECURITY DEFINER insert (function runs as owner,
--    but keep the policy explicit so a definer-role change cannot break it)
-- ===========================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_logs'
      AND policyname = 'rpc_insert_audit_logs'
  ) THEN
    CREATE POLICY "rpc_insert_audit_logs"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;
