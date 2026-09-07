-- =============================================================================
-- PRODUCTION READ-ONLY SNAPSHOT (Phase 2 audit)
-- Project: Media Deck / sepehr (sksbltwbbiuweqeiypyo)
-- Date: 2026-09-07
--
-- RUN IN SUPABASE SQL EDITOR (or psql) — 100% READ-ONLY: SELECTs only.
-- It does not create, alter, drop, update, delete, or grant anything.
--
-- Purpose: capture the exact Production state the recovery plan needs:
--   1. migration registry
--   2. table inventory + RLS flags
--   3. exact columns for the tables the app depends on
--   4. foreign keys / indexes
--   5. RLS policies WITH roles (to see which role can do what)
--   6. helper functions
--   7. workspace / membership counts (backfill-safety)
--   8. notification state + null-workspace candidates
--   9. legacy brand sources for the brands backfill (+ duplicates/ambiguity)
--  10. flow_* lockdown state
--  11. partial-application signals for the Aug-28…Sep-07 migrations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Migration registry (Supabase CLI / GitHub-integration tracking)
-- -----------------------------------------------------------------------------
SELECT '1a. schema_migrations columns' AS section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

SELECT '1b. recorded migrations' AS section;
SELECT COALESCE(name, version) AS migration, version, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- -----------------------------------------------------------------------------
-- 2. Table inventory + RLS flags
-- -----------------------------------------------------------------------------
SELECT '2. public tables + RLS' AS section;
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- -----------------------------------------------------------------------------
-- 3. Exact columns for tables the app reads/writes
-- -----------------------------------------------------------------------------
SELECT '3. key table columns' AS section;
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'workspaces','workspace_members','profiles','notifications','tasks',
    'social_accounts','social_metrics','social_sync_logs',
    'social_data_quality_reviews','social_metric_edit_logs',
    'import_sessions','import_rows','import_audit_log',
    'flow_cards','flow_boards','flow_lists'
  )
ORDER BY table_name, ordinal_position;

-- -----------------------------------------------------------------------------
-- 4. Foreign keys (for the tables above)
-- -----------------------------------------------------------------------------
SELECT '4. foreign keys' AS section;
SELECT tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
     ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
     ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'workspaces','workspace_members','profiles','notifications','tasks',
    'social_accounts','social_metrics','social_sync_logs',
    'social_data_quality_reviews','social_metric_edit_logs',
    'import_sessions','import_rows','import_audit_log',
    'flow_cards','flow_boards','flow_lists'
  )
ORDER BY tc.table_name, kcu.column_name;

-- -----------------------------------------------------------------------------
-- 5. RLS policies WITH roles (anon vs authenticated visibility)
-- -----------------------------------------------------------------------------
SELECT '5. policies with roles' AS section;
SELECT pol.polname AS policy_name,
       cls.relname AS table_name,
       pol.polcmd AS command,           -- r=SELECT w=UPDATE a=INSERT d=DELETE *=ALL
       CASE pol.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
       ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN (
    'workspaces','workspace_members','profiles','notifications','tasks',
    'social_accounts','social_metrics','social_sync_logs',
    'social_data_quality_reviews','social_metric_edit_logs',
    'import_sessions','import_rows','import_audit_log'
  )
ORDER BY cls.relname, pol.polname;

-- Which of the four old open notification policies still exist? (target = zero)
SELECT '5b. legacy open notification policies' AS section;
SELECT pol.polname, cls.relname, pol.polcmd,
       ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public' AND cls.relname = 'notifications'
  AND pol.polname IN ('public_read_notifications','client_insert_notifications',
                      'client_update_notifications','client_delete_notifications');

-- -----------------------------------------------------------------------------
-- 6. Helper functions
-- -----------------------------------------------------------------------------
SELECT '6. helper functions' AS section;
SELECT p.proname, n.nspname AS schema, l.lanname AS language,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE p.proname IN ('is_workspace_member','set_updated_at')
ORDER BY p.proname;

-- -----------------------------------------------------------------------------
-- 7. Workspace / membership counts (decides backfill safety)
-- -----------------------------------------------------------------------------
SELECT '7a. workspace count' AS section;
SELECT count(*) AS workspace_count, count(DISTINCT name) AS distinct_names,
       count(*) FILTER (WHERE slug = 'default-workspace') AS has_default_slug
FROM workspaces;

SELECT '7b. workspace rows' AS section;
SELECT id, name, slug, created_at FROM workspaces ORDER BY created_at;

SELECT '7c. membership count' AS section;
SELECT count(*) AS member_rows, count(DISTINCT workspace_id) AS ws_count,
       count(DISTINCT user_id) AS user_count
FROM workspace_members;

SELECT '7d. members with roles' AS section;
SELECT wm.workspace_id, wm.user_id, wm.role, count(*) OVER () AS total
FROM workspace_members wm ORDER BY wm.workspace_id, wm.user_id;

-- -----------------------------------------------------------------------------
-- 8. Notifications state (pre-upgrade baseline + null-workspace candidate count)
-- -----------------------------------------------------------------------------
SELECT '8a. notifications totals' AS section;
SELECT count(*) AS total,
       count(*) FILTER (WHERE user_id = 'demo') AS demo_user_rows,
       count(DISTINCT user_id) AS distinct_user_ids
FROM notifications;

-- After the workspace_id upgrade this must be 0:
SELECT '8b. notifications without workspace (runs pre-upgrade; expect error until columns exist)'
  AS section;  -- informational only

-- -----------------------------------------------------------------------------
-- 9. Legacy brand sources (brands backfill)
-- -----------------------------------------------------------------------------
SELECT '9a. social_accounts legacy brand values' AS section;
SELECT count(*) AS accounts, count(DISTINCT brand) AS distinct_brands,
       count(*) FILTER (WHERE brand IS NULL OR brand = '') AS empty_brand
FROM social_accounts;

SELECT '9b. duplicate legacy brand values (by brand)' AS section;
SELECT brand, count(*) AS cnt
FROM social_accounts
WHERE brand IS NOT NULL AND brand <> ''
GROUP BY brand
HAVING count(*) > 1
ORDER BY cnt DESC
LIMIT 50;

-- Empty brand strings that cannot be mapped (ambiguous → needs review):
SELECT '9c. empty/blank brand accounts (count + sample)' AS section;
SELECT count(*) AS total_blank,
       (SELECT count(*) FROM social_accounts WHERE brand IS NOT NULL AND brand <> '') AS mapped_candidates
FROM social_accounts
WHERE brand IS NULL OR brand = '';

SELECT '9d. sample of blank-brand accounts (id, platform, username, display_name)'
  AS section;
SELECT id, platform, username, display_name
FROM social_accounts
WHERE brand IS NULL OR brand = ''
ORDER BY created_at
LIMIT 20;

-- -----------------------------------------------------------------------------
-- 10. flow_* lockdown state + flow_cards columns
-- -----------------------------------------------------------------------------
SELECT '10a. flow tables privileges (locked down = no grants for anon/authenticated)'
  AS section;
SELECT cls.relname AS table_name,
       array_agg(grantee ORDER BY grantee) FILTER (WHERE privilege_type = 'SELECT')
         AS select_grantees
FROM information_schema.role_table_grants g
JOIN pg_class cls ON cls.relname = g.table_name
JOIN pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = 'public'
WHERE g.table_schema = 'public' AND cls.relname LIKE 'flow\_%'
GROUP BY cls.relname
ORDER BY cls.relname;

SELECT '10b. flow_cards columns (expect NO brand_id/content_id yet)' AS section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'flow_cards'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- 11. Partial-application signals for the Aug-28…Sep-07 wave
-- -----------------------------------------------------------------------------
-- If any of these return rows, that migration partially applied and must be
-- reconciled carefully instead of replayed.
SELECT '11a. social_accounts already has brand_id?' AS section;
SELECT count(*) AS brand_id_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'social_accounts'
  AND column_name = 'brand_id';

SELECT '11b. social_accounts already has workspace_id?' AS section;
SELECT count(*) AS workspace_id_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'social_accounts'
  AND column_name = 'workspace_id';

SELECT '11c. notifications already upgraded?' AS section;
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
  AND column_name IN ('workspace_id','type','link')
ORDER BY column_name;

SELECT '11d. do brand/finance/team/contents/audit tables exist?' AS section;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('brands','finance_budgets','finance_campaigns',
                     'finance_expenses','finance_expense_allocations',
                     'team_members','team_member_brand_allocations',
                     'contents','audit_logs','user_settings',
                     'social_platform_settings')
ORDER BY table_name;

-- =============================================================================
-- End of read-only snapshot.
-- =============================================================================
