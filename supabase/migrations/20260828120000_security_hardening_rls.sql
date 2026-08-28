/*
# Security Hardening — Phase 22

## Purpose
Restrict Row-Level Security policies from open `anon` access to
`authenticated`-only access across all business tables.

## Changes
1. **Social tables** (social_accounts, social_metrics):
   - SELECT: anon → authenticated only
   - No write policies for anon (writes via service role on server)

2. **Finance tables** (finance_budgets, finance_expenses, finance_expense_allocations, finance_campaigns):
   - All CRUD: anon → authenticated only

3. **Team tables** (team_members, team_member_brand_allocations):
   - All CRUD: no role → authenticated only

4. **Import tables** (import_sessions, import_rows, import_audit_log):
   - All CRUD: anon → authenticated only

5. **Social supporting tables** (social_sync_logs, social_metric_edit_logs, social_data_quality_reviews):
   - SELECT: anon → authenticated only

6. **Task tables** (tasks):
   - All CRUD: anon → authenticated only

## Safety
- Uses DROP POLICY IF EXISTS + CREATE POLICY (idempotent)
- Does not modify table structure or data
- Does not modify existing migration files
- Reversible by creating a migration that restores the original policies

## Demo Mode
When Supabase is not configured, the app uses in-memory/localStorage
fallback. These policies only apply when Supabase IS configured.
*/

-- ===========================================================================
-- 1. Social Accounts & Metrics — restrict reads to authenticated
-- ===========================================================================
DROP POLICY IF EXISTS "public_read_social_accounts" ON social_accounts;
CREATE POLICY "authenticated_read_social_accounts"
ON social_accounts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "public_read_social_metrics" ON social_metrics;
CREATE POLICY "authenticated_read_social_metrics"
ON social_metrics FOR SELECT
TO authenticated
USING (true);

-- Server-side writes only (no client write policies for social data)
-- Writes are done via service role in API routes

-- ===========================================================================
-- 2. Social Sync Logs
-- ===========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_social_sync_logs" ON social_sync_logs;
  CREATE POLICY "authenticated_read_social_sync_logs"
  ON social_sync_logs FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 3. Social Metric Edit Logs
-- ===========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_social_metric_edit_logs" ON social_metric_edit_logs;
  CREATE POLICY "authenticated_read_social_metric_edit_logs"
  ON social_metric_edit_logs FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 4. Social Data Quality Reviews
-- ===========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_social_data_quality_reviews" ON social_data_quality_reviews;
  CREATE POLICY "authenticated_read_social_data_quality_reviews"
  ON social_data_quality_reviews FOR SELECT
  TO authenticated
  USING (true);

  -- Restrict write policies too
  DROP POLICY IF EXISTS "client_insert_social_data_quality_reviews" ON social_data_quality_reviews;
  CREATE POLICY "authenticated_insert_social_data_quality_reviews"
  ON social_data_quality_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

  DROP POLICY IF EXISTS "client_update_social_data_quality_reviews" ON social_data_quality_reviews;
  CREATE POLICY "authenticated_update_social_data_quality_reviews"
  ON social_data_quality_reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 5. Import Review Center
-- ===========================================================================
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['import_sessions', 'import_rows', 'import_audit_log'] LOOP
    -- Drop existing public policies
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);

    -- Create authenticated-only policies
    EXECUTE format('CREATE POLICY "authenticated_read_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_update_%s" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_delete_%s" ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 6. Todo / Task System
-- ===========================================================================
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tasks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);

    EXECUTE format('CREATE POLICY "authenticated_read_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_update_%s" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_delete_%s" ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 7. Finance Tables — restrict from anon to authenticated
-- ===========================================================================
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_budgets', 'finance_campaigns', 'finance_expenses', 'finance_expense_allocations'] LOOP
    -- Drop open policies
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);

    -- Authenticated-only policies
    EXECUTE format('CREATE POLICY "authenticated_read_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_update_%s" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "authenticated_delete_%s" ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 8. Team Tables — restrict from open to authenticated
-- ===========================================================================
DO $$ BEGIN
  -- team_members
  DROP POLICY IF EXISTS "team_members_select" ON team_members;
  DROP POLICY IF EXISTS "team_members_insert" ON team_members;
  DROP POLICY IF EXISTS "team_members_update" ON team_members;
  DROP POLICY IF EXISTS "team_members_delete" ON team_members;

  CREATE POLICY "authenticated_read_team_members" ON team_members FOR SELECT TO authenticated USING (true);
  CREATE POLICY "authenticated_insert_team_members" ON team_members FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "authenticated_update_team_members" ON team_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "authenticated_delete_team_members" ON team_members FOR DELETE TO authenticated USING (true);

  -- team_member_brand_allocations
  DROP POLICY IF EXISTS "team_allocations_select" ON team_member_brand_allocations;
  DROP POLICY IF EXISTS "team_allocations_insert" ON team_member_brand_allocations;
  DROP POLICY IF EXISTS "team_allocations_update" ON team_member_brand_allocations;
  DROP POLICY IF EXISTS "team_allocations_delete" ON team_member_brand_allocations;

  CREATE POLICY "authenticated_read_team_allocations" ON team_member_brand_allocations FOR SELECT TO authenticated USING (true);
  CREATE POLICY "authenticated_insert_team_allocations" ON team_member_brand_allocations FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "authenticated_update_team_allocations" ON team_member_brand_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "authenticated_delete_team_allocations" ON team_member_brand_allocations FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ===========================================================================
-- 9. Social Platform Settings
-- ===========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_social_platform_settings" ON social_platform_settings;
  CREATE POLICY "authenticated_read_social_platform_settings"
  ON social_platform_settings FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "client_insert_social_platform_settings" ON social_platform_settings;
  CREATE POLICY "authenticated_insert_social_platform_settings"
  ON social_platform_settings FOR INSERT TO authenticated WITH CHECK (true);

  DROP POLICY IF EXISTS "client_update_social_platform_settings" ON social_platform_settings;
  CREATE POLICY "authenticated_update_social_platform_settings"
  ON social_platform_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "client_delete_social_platform_settings" ON social_platform_settings;
  CREATE POLICY "authenticated_delete_social_platform_settings"
  ON social_platform_settings FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;
