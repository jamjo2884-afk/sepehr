-- =============================================================================
-- Close legacy anon-read exposure (2026-09-19)
--
-- PROBLEM (verified against the live database, 2026-09-19):
-- 12 tables carry blanket `USING (true)` policies granted TO anon — anyone
-- with the public anon key can read all rows via the REST endpoint:
--   activity_items, import_audit_log, import_rows, import_sessions,
--   social_accounts, social_data_quality_reviews, social_followers,
--   social_metric_edit_logs, social_metrics, social_sync_logs,
--   task_labels, tasks
-- These contain real tenant data (110 social accounts, 1,495 metrics,
-- 3,473 import rows at audit time). The app itself was reading them as anon
-- through the shared anon-key client, which is why the policies existed.
--
-- FIX = two coupled changes (this migration is PART 2 of 2):
--   Part 1 (below): create mirrored policies TO authenticated with identical
--     predicates, so the app keeps full function after its services moved to
--     the cookie-backed SSR client (commit-pair requirement — deploy together).
--   Part 2 (below): drop every anon-role policy on the 12 tables. With RLS
--     enabled and no policy, unauthenticated readers see zero rows.
--
-- NOT changed here (kept intentionally):
--   - grants: default anon SELECT grants remain (harmless without policies —
--     same pattern as the 16 already-safe tables).
--   - social_platform_settings: its global anon-free SELECT policy stays
--     (intentionally public reference data — verified no workspace scope).
--   - brands/contents/workspaces: untouched (authenticated-scoped already;
--     guest-mode policies are a separate, reviewed migration).
--
-- KNOWN LIMITATION (documented, phase 2): the mirrored authenticated policies
-- are blanket `true` because 9 of the 12 tables have no workspace/brand scope
-- column and brands is not yet backfilled (no-backfill rule in
-- 20260907_production_schema_reconciliation.sql). Per-workspace tightening is
-- a follow-up once brand→workspace mapping exists. Net effect TODAY is still
-- strictly safer: unauthenticated access goes from "all rows" to "zero rows".
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE; the Part-2 DO block
-- targets whatever anon policies exist at run time.
-- =============================================================================

-- ============================================================================
-- PART 1 — mirrored policies TO authenticated (preserve app function)
-- ============================================================================

-- activity_items
DROP POLICY IF EXISTS "authenticated_read_activity_items" ON activity_items;
CREATE POLICY "authenticated_read_activity_items" ON activity_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_activity_items" ON activity_items;
CREATE POLICY "authenticated_insert_activity_items" ON activity_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_activity_items" ON activity_items;
CREATE POLICY "authenticated_update_activity_items" ON activity_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_activity_items" ON activity_items;
CREATE POLICY "authenticated_delete_activity_items" ON activity_items FOR DELETE TO authenticated USING (true);

-- import_audit_log
DROP POLICY IF EXISTS "authenticated_read_import_audit_log" ON import_audit_log;
CREATE POLICY "authenticated_read_import_audit_log" ON import_audit_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_import_audit_log" ON import_audit_log;
CREATE POLICY "authenticated_insert_import_audit_log" ON import_audit_log FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_import_audit_log" ON import_audit_log;
CREATE POLICY "authenticated_update_import_audit_log" ON import_audit_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_import_audit_log" ON import_audit_log;
CREATE POLICY "authenticated_delete_import_audit_log" ON import_audit_log FOR DELETE TO authenticated USING (true);

-- import_rows
DROP POLICY IF EXISTS "authenticated_read_import_rows" ON import_rows;
CREATE POLICY "authenticated_read_import_rows" ON import_rows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_import_rows" ON import_rows;
CREATE POLICY "authenticated_insert_import_rows" ON import_rows FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_import_rows" ON import_rows;
CREATE POLICY "authenticated_update_import_rows" ON import_rows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_import_rows" ON import_rows;
CREATE POLICY "authenticated_delete_import_rows" ON import_rows FOR DELETE TO authenticated USING (true);

-- import_sessions
DROP POLICY IF EXISTS "authenticated_read_import_sessions" ON import_sessions;
CREATE POLICY "authenticated_read_import_sessions" ON import_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_import_sessions" ON import_sessions;
CREATE POLICY "authenticated_insert_import_sessions" ON import_sessions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_import_sessions" ON import_sessions;
CREATE POLICY "authenticated_update_import_sessions" ON import_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_import_sessions" ON import_sessions;
CREATE POLICY "authenticated_delete_import_sessions" ON import_sessions FOR DELETE TO authenticated USING (true);

-- social_accounts
DROP POLICY IF EXISTS "authenticated_read_social_accounts" ON social_accounts;
CREATE POLICY "authenticated_read_social_accounts" ON social_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_social_accounts" ON social_accounts;
CREATE POLICY "authenticated_insert_social_accounts" ON social_accounts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_social_accounts" ON social_accounts;
CREATE POLICY "authenticated_update_social_accounts" ON social_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_social_accounts" ON social_accounts;
CREATE POLICY "authenticated_delete_social_accounts" ON social_accounts FOR DELETE TO authenticated USING (true);

-- social_data_quality_reviews
DROP POLICY IF EXISTS "authenticated_read_social_data_quality_reviews" ON social_data_quality_reviews;
CREATE POLICY "authenticated_read_social_data_quality_reviews" ON social_data_quality_reviews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_social_data_quality_reviews" ON social_data_quality_reviews;
CREATE POLICY "authenticated_insert_social_data_quality_reviews" ON social_data_quality_reviews FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_social_data_quality_reviews" ON social_data_quality_reviews;
CREATE POLICY "authenticated_update_social_data_quality_reviews" ON social_data_quality_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_social_data_quality_reviews" ON social_data_quality_reviews;
CREATE POLICY "authenticated_delete_social_data_quality_reviews" ON social_data_quality_reviews FOR DELETE TO authenticated USING (true);

-- social_followers (read-only legacy table, zero code readers)
DROP POLICY IF EXISTS "authenticated_read_social_followers" ON social_followers;
CREATE POLICY "authenticated_read_social_followers" ON social_followers FOR SELECT TO authenticated USING (true);

-- social_metric_edit_logs
DROP POLICY IF EXISTS "authenticated_read_social_metric_edit_logs" ON social_metric_edit_logs;
CREATE POLICY "authenticated_read_social_metric_edit_logs" ON social_metric_edit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_social_metric_edit_logs" ON social_metric_edit_logs;
CREATE POLICY "authenticated_insert_social_metric_edit_logs" ON social_metric_edit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- social_metrics
DROP POLICY IF EXISTS "authenticated_read_social_metrics" ON social_metrics;
CREATE POLICY "authenticated_read_social_metrics" ON social_metrics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_social_metrics" ON social_metrics;
CREATE POLICY "authenticated_insert_social_metrics" ON social_metrics FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_social_metrics" ON social_metrics;
CREATE POLICY "authenticated_update_social_metrics" ON social_metrics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_social_metrics" ON social_metrics;
CREATE POLICY "authenticated_delete_social_metrics" ON social_metrics FOR DELETE TO authenticated USING (true);

-- social_sync_logs
DROP POLICY IF EXISTS "authenticated_read_social_sync_logs" ON social_sync_logs;
CREATE POLICY "authenticated_read_social_sync_logs" ON social_sync_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_social_sync_logs" ON social_sync_logs;
CREATE POLICY "authenticated_insert_social_sync_logs" ON social_sync_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_social_sync_logs" ON social_sync_logs;
CREATE POLICY "authenticated_update_social_sync_logs" ON social_sync_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- task_labels
DROP POLICY IF EXISTS "authenticated_read_task_labels" ON task_labels;
CREATE POLICY "authenticated_read_task_labels" ON task_labels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_task_labels" ON task_labels;
CREATE POLICY "authenticated_insert_task_labels" ON task_labels FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_task_labels" ON task_labels;
CREATE POLICY "authenticated_update_task_labels" ON task_labels FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_task_labels" ON task_labels;
CREATE POLICY "authenticated_delete_task_labels" ON task_labels FOR DELETE TO authenticated USING (true);

-- tasks
DROP POLICY IF EXISTS "authenticated_read_tasks" ON tasks;
CREATE POLICY "authenticated_read_tasks" ON tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_tasks" ON tasks;
CREATE POLICY "authenticated_insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_tasks" ON tasks;
CREATE POLICY "authenticated_update_tasks" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_tasks" ON tasks;
CREATE POLICY "authenticated_delete_tasks" ON tasks FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- PART 2 — drop every anon-role policy on the 12 legacy tables
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'activity_items', 'import_audit_log', 'import_rows', 'import_sessions',
        'social_accounts', 'social_data_quality_reviews', 'social_followers',
        'social_metric_edit_logs', 'social_metrics', 'social_sync_logs',
        'task_labels', 'tasks'
      )
      AND 'anon' = ANY (roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;
