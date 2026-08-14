/*
# Social writes + period_start index (daily/weekly support)

## Purpose
Enable the service layer to record daily/weekly metrics and to query
period ranges efficiently:

1. Open INSERT/UPDATE/DELETE on `social_accounts` and `social_metrics` to
   anon + authenticated, following the same pattern as the business tables
   (`20260814120000_allow_business_writes.sql`). The app records metrics
   from the client with the anon key while the demo workspace has no login.
2. Index `social_metrics.period_start` so date-range queries for
   daily/weekly comparisons stay fast.

## Security notes
- Same permissive stance as the business writes migration: the app runs
  without auth in the demo workspace. When real multi-tenant auth lands,
  narrow these to `is_workspace_member()`-style checks.
- Re-running is safe: policies dropped before create, index IF NOT EXISTS.
*/

-- ===========================================================================
-- 1. Write policies
-- ===========================================================================
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['social_accounts', 'social_metrics'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ===========================================================================
-- 2. period_start index for date-range queries
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_social_metrics_period_start
  ON social_metrics(period_start);
