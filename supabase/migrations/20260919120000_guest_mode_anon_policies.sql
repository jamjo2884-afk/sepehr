-- =============================================================================
-- Guest Mode (2026-09-19) — read-only anon policies for the demo workspace
--
-- Decision (documented, replacing the open RLS question):
-- Option (a) — pure RLS, NO service-role client anywhere.
--
-- Why:
-- 1. Unauthenticated guests run every Supabase query through the app's normal
--    cookie-backed server client. With no session that client is effectively
--    `anon`, so RLS is the single enforcement point and it cannot be bypassed
--    by app code paths.
-- 2. Before this migration, `anon` has NO policies on brands/contents (they
--    return zero rows), so enabling guest reads by adding a narrow policy is
--    strictly additive — existing tenant protections are untouched.
-- 3. Legacy anon policies on social_*/tasks/import_* tables (pre-existing
--    exposure, reported separately) are NOT extended here; guest-mode keeps
--    those surfaces behind the app-level deny-by-default allowlist.
--
-- Scope: SELECT only, only rows of the fixed guest workspace uuid
-- (deb00d00-0000-4000-8000-deb00d000001, seeded by the companion seed
-- migration). The canonical app label 'demo-workspace-000' is NOT a uuid and
-- cannot be a row id — the uuid constant mirrors src/lib/guest-mode.ts.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE.
-- =============================================================================

-- The workspace row itself must be readable for slug/name lookups; it is the
-- demo row, not tenant data.
DROP POLICY IF EXISTS "guest_read_demo_workspace" ON workspaces;
CREATE POLICY "guest_read_demo_workspace"
ON workspaces FOR SELECT TO anon
USING (id = 'deb00d00-0000-4000-8000-deb00d000001'::uuid);

DROP POLICY IF EXISTS "guest_read_demo_brands" ON brands;
CREATE POLICY "guest_read_demo_brands"
ON brands FOR SELECT TO anon
USING (workspace_id = 'deb00d00-0000-4000-8000-deb00d000001'::uuid);

DROP POLICY IF EXISTS "guest_read_demo_contents" ON contents;
CREATE POLICY "guest_read_demo_contents"
ON contents FOR SELECT TO anon
USING (workspace_id = 'deb00d00-0000-4000-8000-deb00d000001'::uuid);
