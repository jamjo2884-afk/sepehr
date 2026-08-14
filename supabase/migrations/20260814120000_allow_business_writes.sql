/*
# Allow client writes to business tables

## Purpose
The app's forms (create project / operation / asset, update status,
delete) call the Supabase client with the anon key. The original business
schema only opened SELECT to anon/authenticated; this migration adds
INSERT/UPDATE/DELETE policies for `authenticated` (and `anon` while the
demo workspace has no login) so the client can write rows.

## Security notes
- Policies are intentionally permissive for now: the app runs without a
  configured auth flow in the demo workspace, and the workspace_id column
  is `demo`. When real multi-tenant auth lands, these policies should be
  narrowed to `is_workspace_member(workspace_id)`.
- `authenticated` and `anon` both get write access so both the demo and a
  signed-in user can create rows.
- Re-running is safe: policies dropped before create.

## Applies to
projects, campaigns, media_assets, operations, knowledge_items,
audience_segments, automations, analytics_reports, notifications,
activity_items
*/

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['projects','campaigns','media_assets','operations',
    'knowledge_items','audience_segments','automations','analytics_reports',
    'notifications','activity_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;
