-- =========================================================================
-- FlowBoard RLS lockdown — PRODUCTION SAFETY
-- =========================================================================
--
-- The flow_* tables were created via Prisma (prisma/migrations), so unlike
-- Media Deck's tables they had NO Row Level Security: any client holding the
-- public anon key could read/modify every workspace's data directly through
-- the Supabase REST API (PostgREST), bypassing all application-level
-- authorization.
--
-- FlowBoard accesses the database exclusively server-side through Prisma as
-- the `postgres` role (the table owner) from DATABASE_URL/DIRECT_URL.
-- Media Deck's lockdown convention is therefore applied, owner-safe:
--
--   1. ENABLE row level security on every flow_* table.
--      With RLS enabled and NO policies, PostgREST-facing roles
--      (anon/authenticated) are denied every row.
--   2. REVOKE all table privileges from anon and authenticated so the REST
--      surface itself is closed off.
--
-- Deliberately NO `FORCE ROW LEVEL SECURITY`: the Prisma connection user is
-- the table owner, and FORCE would make RLS apply to the owner as well —
-- with zero policies that would break FlowBoard's own server access.
-- Table owners bypass RLS by default, which is exactly what Prisma needs.
--
-- Idempotent: safe to re-run. Non-destructive: no data is touched.
-- =========================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'flow_users',
    'flow_workspaces',
    'flow_workspace_members',
    'flow_boards',
    'flow_board_members',
    'flow_lists',
    'flow_cards',
    'flow_card_members',
    'flow_card_watchers',
    'flow_labels',
    'flow_board_labels',
    'flow_card_labels',
    'flow_checklists',
    'flow_checklist_items',
    'flow_comments',
    'flow_attachments',
    'flow_activities',
    'flow_automation_rules',
    'flow_board_templates',
    'flow_card_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
  END LOOP;
END $$;
