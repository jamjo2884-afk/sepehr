-- =============================================================================
-- PRODUCTION VERIFICATION (Phase 16) — run AFTER the reconciliation migration
-- Project: Media Deck / sepehr (sksbltwbbiuweqeiypyo) — Date: 2026-09-07
-- 100% READ-ONLY. Every check below must pass / show expected values before the
-- recovery is declared complete.
-- =============================================================================

-- 1. Required tables exist (expect one row per table below, 12 tables)
SELECT '1. required tables' AS check_name, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('brands','finance_budgets','finance_campaigns',
                     'finance_expenses','finance_expense_allocations',
                     'team_members','team_member_brand_allocations',
                     'contents','audit_logs','user_settings',
                     'social_platform_settings')
ORDER BY table_name;

-- 2. Required columns exist
SELECT '2. required columns' AS check_name, table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
       (table_name = 'brands' AND column_name IN ('id','workspace_id','name','slug','status','logo_url','color','created_at','updated_at'))
    OR (table_name = 'finance_campaigns' AND column_name IN ('id','brand_id','workspace_id','name','start_date','end_date','budget','status','description','created_at','updated_at'))
    OR (table_name = 'contents' AND column_name IN ('id','workspace_id','brand_id','campaign_id','title','type','status','body','platform','scheduled_at','published_at','created_by','created_at','updated_at'))
    OR (table_name = 'audit_logs' AND column_name IN ('id','workspace_id','user_id','action','entity_type','entity_id','metadata','created_at'))
    OR (table_name = 'notifications' AND column_name IN ('workspace_id','type','link'))
    OR (table_name = 'flow_cards' AND column_name IN ('brand_id','content_id'))
    OR (table_name = 'social_accounts' AND column_name IN ('brand_id','workspace_id'))
    OR (table_name = 'team_member_brand_allocations' AND column_name IN ('brand_id','workspace_id','allocation_percentage'))
  )
ORDER BY table_name, column_name;

-- 3. Foreign keys exist (contents→brands, contents→finance_campaigns, contents→workspaces, flow_cards→brands, flow_cards→contents)
SELECT '3. foreign keys' AS check_name, tc.table_name, kcu.column_name,
       ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
     ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  AND ((tc.table_name = 'contents' AND kcu.column_name IN ('brand_id','campaign_id','workspace_id'))
    OR (tc.table_name = 'flow_cards' AND kcu.column_name IN ('brand_id','content_id')));

-- 4. RLS enabled on the required tables (expect all true / 1)
SELECT '4. RLS enabled' AS check_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('brands','contents','audit_logs','notifications',
                    'finance_campaigns','finance_budgets','finance_expenses',
                    'finance_expense_allocations','team_members',
                    'team_member_brand_allocations','social_accounts')
ORDER BY c.relname;

-- 5. Legacy open notification policies are GONE (expect ZERO rows)
SELECT '5. legacy open notification policies' AS check_name, pol.polname, cls.relname
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public' AND cls.relname = 'notifications'
  AND pol.polname IN ('public_read_notifications','client_insert_notifications',
                      'client_update_notifications','client_delete_notifications');

-- 6. Workspace/user-scoped notification policies exist (expect ≥2 rows)
SELECT '6. notification workspace policies' AS check_name, pol.polname, pol.polcmd
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public' AND cls.relname = 'notifications'
  AND pol.polname LIKE 'workspace\_%notifications%'
ORDER BY pol.polname;

-- 7. Notifications without workspace_id — MUST BE ZERO after backfill
SELECT '7. notifications NULL workspace' AS check_name,
       count(*) FILTER (WHERE workspace_id IS NULL) AS null_workspace_count,
       count(*) AS total
FROM notifications;

-- 8. Row counts (informational)
SELECT '8. contents count' AS check_name, count(*) AS cnt FROM contents
UNION ALL SELECT '8. audit_logs count', count(*) FROM audit_logs
UNION ALL SELECT '8. brands count', count(*) FROM brands
UNION ALL SELECT '8. notifications count', count(*) FROM notifications;

-- 9. flow_cards columns present
SELECT '9. flow_cards link columns' AS check_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'flow_cards'
  AND column_name IN ('brand_id','content_id');

-- 10. Helper functions exist
SELECT '10. helper functions' AS check_name, p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_workspace_member','set_updated_at')
ORDER BY p.proname;

-- 11. No anon/permissive policies on the Phase-23 tables
--     (expect ZERO rows — if the chosen target model is authenticated-only)
SELECT '11. anon-visible policies on phase-23 tables' AS check_name,
       cls.relname AS table_name, pol.polname,
       ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN ('brands','contents','audit_logs','finance_campaigns',
                      'finance_budgets','finance_expenses','notifications')
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(pol.polroles) AND r.rolname = 'anon');

-- =============================================================================
-- End of verification. All checks should pass before production is declared fixed.
-- =============================================================================
