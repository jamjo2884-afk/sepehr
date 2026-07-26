/*
# Authentication & Workspace Foundation

## Purpose
Prepare the database for a multi-tenant SaaS platform. This migration
creates the core identity and tenancy tables (no business tables yet) and
wires up secure Row-Level Security plus an automatic onboarding trigger.

## New Tables

1. `workspaces`
   - `id` (uuid, PK)
   - `name` (text, not null) — display name of the workspace
   - `slug` (text, unique, not null) — URL-safe identifier
   - `logo_url` (text, nullable) — optional workspace logo
   - `created_at` (timestamptz, default now())

2. `profiles`
   - `id` (uuid, PK) — references `auth.users(id)`, one-to-one with the auth user
   - `full_name` (text, not null)
   - `avatar_url` (text, nullable)
   - `role` (app_role, not null, default 'viewer')
   - `workspace_id` (uuid, nullable, references workspaces) — primary workspace
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())

3. `workspace_members`
   - `id` (uuid, PK)
   - `workspace_id` (uuid, FK -> workspaces, cascade delete)
   - `user_id` (uuid, FK -> auth.users, cascade delete)
   - `role` (app_role, not null, default 'viewer')
   - `created_at` (timestamptz, default now())
   - Unique constraint on (workspace_id, user_id)

## Enums
- `app_role` (owner, admin, editor, writer, viewer) — canonical role set.
  No permission logic is enforced yet; only the structure is in place.

## Security (RLS)
- `workspaces`: members can SELECT/UPDATE a workspace they belong to.
  INSERT allowed for authenticated users. DELETE restricted to owner role.
- `profiles`: each user can SELECT/UPDATE only their own profile row.
  Profiles are also readable by members of the same workspace.
- `workspace_members`: members of a workspace can SELECT membership rows.
  A user can INSERT/UPDATE/DELETE only their own membership rows.

## Automation
- Trigger `on_auth_user_created` fires after a new auth user is inserted.
  It creates a default `workspaces` row ("فضای کاری من"), a `profiles` row
  with role 'owner', and a `workspace_members` row with role 'owner'.

## Notes
1. Email confirmation stays OFF.
2. `profiles.id` defaults to `auth.uid()` so client inserts that omit id
   still satisfy the INSERT policy WITH CHECK.
3. All policies are scoped to `authenticated` (the app has a sign-in screen).
4. Re-running is safe: IF NOT EXISTS on tables, policies dropped before create.
*/

-- ===========================================================================
-- 1. Enums
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('owner', 'admin', 'editor', 'writer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. Tables (created before policies that reference them)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  role app_role NOT NULL DEFAULT 'viewer',
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id
  ON profiles(workspace_id);

-- ===========================================================================
-- 4. Enable RLS
-- ===========================================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 5. workspaces policies
-- ===========================================================================
DROP POLICY IF EXISTS "members_select_workspaces" ON workspaces;
CREATE POLICY "members_select_workspaces"
ON workspaces FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "auth_insert_workspaces" ON workspaces;
CREATE POLICY "auth_insert_workspaces"
ON workspaces FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "members_update_workspaces" ON workspaces;
CREATE POLICY "members_update_workspaces"
ON workspaces FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "owners_delete_workspaces" ON workspaces;
CREATE POLICY "owners_delete_workspaces"
ON workspaces FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspaces.id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
);

-- ===========================================================================
-- 6. profiles policies
-- ===========================================================================
DROP POLICY IF EXISTS "select_own_or_workspace_profiles" ON profiles;
CREATE POLICY "select_own_or_workspace_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = profiles.workspace_id AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ===========================================================================
-- 7. workspace_members policies
-- ===========================================================================
DROP POLICY IF EXISTS "members_select_workspace_members" ON workspace_members;
CREATE POLICY "members_select_workspace_members"
ON workspace_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = workspace_members.workspace_id AND m.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "insert_own_workspace_member" ON workspace_members;
CREATE POLICY "insert_own_workspace_member"
ON workspace_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_workspace_member" ON workspace_members;
CREATE POLICY "update_own_workspace_member"
ON workspace_members FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_workspace_member" ON workspace_members;
CREATE POLICY "delete_own_workspace_member"
ON workspace_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ===========================================================================
-- 8. updated_at trigger for profiles
-- ===========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ===========================================================================
-- 9. Onboarding: auto-create profile + default workspace on signup
-- ===========================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  unique_slug text;
  slug_count int;
BEGIN
  base_slug := 'workspace-' || substr(NEW.id::text, 1, 8);
  unique_slug := base_slug;
  slug_count := 0;
  WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = unique_slug) LOOP
    slug_count := slug_count + 1;
    unique_slug := base_slug || '-' || slug_count::text;
  END LOOP;

  INSERT INTO workspaces (name, slug)
  VALUES ('فضای کاری من', unique_slug)
  RETURNING id INTO new_workspace_id;

  INSERT INTO profiles (id, full_name, role, workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'owner',
    new_workspace_id
  )
  ON CONFLICT (id) DO UPDATE
    SET workspace_id = new_workspace_id, role = 'owner';

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'owner';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
