/*
# 20260907 — Production Schema Reconciliation (Phase 23 recovery) — v2

## Purpose
Bring the Production database (project "sepehr", sksbltwbbiuweqeiypyo) to the
schema the current Media Deck application expects — WITHOUT replaying the
historical Aug-27…Sep-07 migrations blindly, because Production applied its
Supabase migrations selectively and its registry is not a reliable source of
truth (early migrations were run via Management API and never recorded).

## Verified Production state this migration targets (2026-09-07)
- Present: workspaces/workspace_members/profiles/notifications/tasks/social_*,
  and Prisma-created flow_* tables (FlowBoard RLS lockdown already applied).
- Absent: brands, finance_*, team_*, contents, audit_logs, user_settings,
  social_platform_settings.
- notifications = pre-upgrade shape with the four open permissive policies
  (public_read/client_insert/client_update/client_delete_notifications).
- social_accounts = legacy shape (brand text, NO brand_id/workspace_id),
  110 rows. NOT modified here (no provable workspace mapping).
- Production has 3 workspaces / 3 members / 3 users → NO default-workspace
  assumption anywhere.

## ORDER OF CREATION (dependency-correct — every FK target exists first)
  helpers → enum → brands → finance → team → settings → notifications
  → contents → audit_logs → flow_cards links
  (brands is created BEFORE finance/team because they FK to brands(id);
   contents comes after brands + finance_campaigns; flow_cards last.)

## Decisions encoded here (Model A)
- RLS = authenticated + workspace-scoped on every table created here.
- No policy uses `USING (true)` / `WITH CHECK (true)` on a workspace-scoped
  table. The only `USING (true)` remaining is social_platform_settings' SELECT
  — that table is intentionally GLOBAL (no workspace_id, verified against the
  repo schema), and its write policy is gated to workspace owners/admins.
- finance_expense_allocations INSERT/UPDATE/DELETE enforce workspace membership
  through their parent finance_expenses row (no bare `true`).

## No-backfill rule (multiple workspaces)
- workspace_id on pre-existing rows is NOT auto-assigned.
- No brand rows are seeded (brands is created empty): legacy brand strings have
  no provable workspace mapping; manual mapping (tools/brand_workspace_mapping_report.sql)
  will populate brands + backfill social_accounts in a later, separate migration.
- social_accounts keeps its legacy shape so today's reads keep working.

## Safety & idempotency
- Non-destructive: no DROP TABLE/COLUMN, no TRUNCATE, no DELETE, no UPDATE of
  existing business rows. Only additive DDL + policy replacement.
- Safe to re-run: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
  DROP POLICY IF EXISTS → CREATE POLICY everywhere.
- Does NOT drop legacy `brand` text columns anywhere.
- 20260829110000_finalize_brand_id.sql is deliberately NOT applied.
- 20260907_phase23_control_center.sql (if applied before/after) is compatible:
  its objects are created with the same names/definitions here, so either order
  converges to the same end state.
*/

-- =============================================================================
-- 1. Helper functions (existing versions preserved)
-- =============================================================================

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

-- is_workspace_member: created ONLY if missing (keeps the recursion-safe
-- SECURITY DEFINER variant already deployed by the July migrations; existing
-- policies depend on its current semantics, so it is never redefined here).
DO $do$
BEGIN
  IF to_regprocedure('public.is_workspace_member(uuid)') IS NULL THEN
    CREATE FUNCTION public.is_workspace_member(workspace_uuid uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = workspace_uuid AND m.user_id = auth.uid()
      );
    $$;
  END IF;
END $do$;

-- =============================================================================
-- 2. Enum
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE finance_campaign_status AS ENUM ('planned', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. brands (schema only — created FIRST because finance/team FK to it.
--    NO seeding: brand→workspace mapping is pending manual assignment.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS brands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  slug         text NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  logo_url     text,
  color        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_brands_workspace_id ON brands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Drop policies that may exist from the repo brands migration or from other
-- environments (including its permissive demo_all policy — never recreated).
DROP POLICY IF EXISTS "authenticated_read_brands" ON brands;
DROP POLICY IF EXISTS "authenticated_insert_brands" ON brands;
DROP POLICY IF EXISTS "authenticated_update_brands" ON brands;
DROP POLICY IF EXISTS "authenticated_delete_brands" ON brands;
DROP POLICY IF EXISTS "demo_all_brands" ON brands;

DROP POLICY IF EXISTS "workspace_read_brands" ON brands;
CREATE POLICY "workspace_read_brands"
ON brands FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_insert_brands" ON brands;
CREATE POLICY "workspace_insert_brands"
ON brands FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_update_brands" ON brands;
CREATE POLICY "workspace_update_brands"
ON brands FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_delete_brands" ON brands;
CREATE POLICY "workspace_delete_brands"
ON brands FOR DELETE TO authenticated
USING (
  is_workspace_member(workspace_id)
  AND EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 4. Finance tables (final, app-compatible shape)
--    Deviation note: the historical create file had a `brand text NOT NULL`
--    column (intermediate state). Production has ZERO finance rows and the app
--    inserts `brand_id` only, so these tables are created directly in the
--    post-finalize shape (brand_id + workspace_id, no legacy brand column).
--    brands(id) already exists (section 3).
-- =============================================================================

CREATE TABLE IF NOT EXISTS finance_budgets (
  id            text PRIMARY KEY,
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id      uuid REFERENCES brands(id) ON DELETE SET NULL,
  period        text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  period_label  text NOT NULL,
  amount        numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, period, period_label)
);

CREATE TABLE IF NOT EXISTS finance_campaigns (
  id            text PRIMARY KEY,
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id      uuid REFERENCES brands(id) ON DELETE SET NULL,
  name          text NOT NULL,
  start_date    text NOT NULL,
  end_date      text,
  budget        numeric(18,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  status        finance_campaign_status NOT NULL DEFAULT 'planned',
  description   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id            text PRIMARY KEY,
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id      uuid REFERENCES brands(id) ON DELETE SET NULL,
  expense_date  text NOT NULL,
  amount        numeric(18,2) NOT NULL CHECK (amount > 0),
  category      text NOT NULL DEFAULT 'other',
  campaign_id   text REFERENCES finance_campaigns(id) ON DELETE SET NULL,
  description   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_expense_allocations (
  id                text PRIMARY KEY,
  expense_id        text NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  platform          text NOT NULL,
  social_account_id text,
  amount            numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  percentage        numeric(6,3),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_workspace_id ON finance_budgets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_brand_id ON finance_budgets(brand_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_period ON finance_budgets(period, period_label);
CREATE INDEX IF NOT EXISTS idx_finance_campaigns_workspace_id ON finance_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_finance_campaigns_brand_id ON finance_campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_finance_campaigns_status ON finance_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_workspace_id ON finance_expenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_brand_id ON finance_expenses(brand_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_campaign ON finance_expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_finance_allocations_expense ON finance_expense_allocations(expense_id);

ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expense_allocations ENABLE ROW LEVEL SECURITY;

-- Remove any demo/public/legacy policies that may exist from other environments,
-- then install the workspace-scoped (Model A) policy set.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_budgets', 'finance_campaigns', 'finance_expenses', 'finance_expense_allocations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%s" ON %I', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "workspace_read_finance_budgets" ON finance_budgets;
CREATE POLICY "workspace_read_finance_budgets"
ON finance_budgets FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_insert_finance_budgets" ON finance_budgets;
CREATE POLICY "workspace_insert_finance_budgets"
ON finance_budgets FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_update_finance_budgets" ON finance_budgets;
CREATE POLICY "workspace_update_finance_budgets"
ON finance_budgets FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_delete_finance_budgets" ON finance_budgets;
CREATE POLICY "workspace_delete_finance_budgets"
ON finance_budgets FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_read_finance_campaigns" ON finance_campaigns;
CREATE POLICY "workspace_read_finance_campaigns"
ON finance_campaigns FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_insert_finance_campaigns" ON finance_campaigns;
CREATE POLICY "workspace_insert_finance_campaigns"
ON finance_campaigns FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_update_finance_campaigns" ON finance_campaigns;
CREATE POLICY "workspace_update_finance_campaigns"
ON finance_campaigns FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_delete_finance_campaigns" ON finance_campaigns;
CREATE POLICY "workspace_delete_finance_campaigns"
ON finance_campaigns FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_read_finance_expenses" ON finance_expenses;
CREATE POLICY "workspace_read_finance_expenses"
ON finance_expenses FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_insert_finance_expenses" ON finance_expenses;
CREATE POLICY "workspace_insert_finance_expenses"
ON finance_expenses FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_update_finance_expenses" ON finance_expenses;
CREATE POLICY "workspace_update_finance_expenses"
ON finance_expenses FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_delete_finance_expenses" ON finance_expenses;
CREATE POLICY "workspace_delete_finance_expenses"
ON finance_expenses FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

-- Allocations: every operation is scoped through the parent expense's
-- workspace. No `USING(true)`/`WITH CHECK(true)` anywhere.
DROP POLICY IF EXISTS "workspace_read_finance_expense_allocations" ON finance_expense_allocations;
CREATE POLICY "workspace_read_finance_expense_allocations"
ON finance_expense_allocations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM finance_expenses fe
    WHERE fe.id = finance_expense_allocations.expense_id
      AND is_workspace_member(fe.workspace_id)
  )
);
DROP POLICY IF EXISTS "workspace_insert_finance_expense_allocations" ON finance_expense_allocations;
CREATE POLICY "workspace_insert_finance_expense_allocations"
ON finance_expense_allocations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM finance_expenses fe
    WHERE fe.id = finance_expense_allocations.expense_id
      AND is_workspace_member(fe.workspace_id)
  )
);
DROP POLICY IF EXISTS "workspace_update_finance_expense_allocations" ON finance_expense_allocations;
CREATE POLICY "workspace_update_finance_expense_allocations"
ON finance_expense_allocations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM finance_expenses fe
    WHERE fe.id = finance_expense_allocations.expense_id
      AND is_workspace_member(fe.workspace_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM finance_expenses fe
    WHERE fe.id = finance_expense_allocations.expense_id
      AND is_workspace_member(fe.workspace_id)
  )
);
DROP POLICY IF EXISTS "workspace_delete_finance_expense_allocations" ON finance_expense_allocations;
CREATE POLICY "workspace_delete_finance_expense_allocations"
ON finance_expense_allocations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM finance_expenses fe
    WHERE fe.id = finance_expense_allocations.expense_id
      AND is_workspace_member(fe.workspace_id)
  )
);

DROP TRIGGER IF EXISTS trg_finance_budgets_updated_at ON finance_budgets;
CREATE TRIGGER trg_finance_budgets_updated_at BEFORE UPDATE ON finance_budgets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_finance_campaigns_updated_at ON finance_campaigns;
CREATE TRIGGER trg_finance_campaigns_updated_at BEFORE UPDATE ON finance_campaigns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_finance_expenses_updated_at ON finance_expenses;
CREATE TRIGGER trg_finance_expenses_updated_at BEFORE UPDATE ON finance_expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 5. Team tables (final shape: brand_id/workspace_id, no legacy brand column)
--    brands(id) and finance-independent; team_members before allocations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id              text PRIMARY KEY,
  workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  name            text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('full_time','part_time','project','intern')),
  monthly_cost    numeric NOT NULL CHECK (monthly_cost >= 0),
  start_date      date NOT NULL DEFAULT current_date,
  end_date        date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_member_brand_allocations (
  id                    text PRIMARY KEY,
  team_member_id        text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  workspace_id          uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id              uuid REFERENCES brands(id) ON DELETE SET NULL,
  allocation_percentage numeric NOT NULL CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_workspace_id ON team_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_start_date ON team_members(start_date);
CREATE INDEX IF NOT EXISTS idx_team_allocations_workspace_id ON team_member_brand_allocations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_allocations_member ON team_member_brand_allocations(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_allocations_brand_id ON team_member_brand_allocations(brand_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_brand_allocations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['team_members', 'team_member_brand_allocations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "team_members_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_members_insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_members_update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_members_delete" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_allocations_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_allocations_insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_allocations_update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "team_allocations_delete" ON %I', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "workspace_read_team_members" ON team_members;
CREATE POLICY "workspace_read_team_members"
ON team_members FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_insert_team_members" ON team_members;
CREATE POLICY "workspace_insert_team_members"
ON team_members FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_update_team_members" ON team_members;
CREATE POLICY "workspace_update_team_members"
ON team_members FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_delete_team_members" ON team_members;
CREATE POLICY "workspace_delete_team_members"
ON team_members FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_read_team_allocations" ON team_member_brand_allocations;
CREATE POLICY "workspace_read_team_allocations"
ON team_member_brand_allocations FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_insert_team_allocations" ON team_member_brand_allocations;
CREATE POLICY "workspace_insert_team_allocations"
ON team_member_brand_allocations FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_update_team_allocations" ON team_member_brand_allocations;
CREATE POLICY "workspace_update_team_allocations"
ON team_member_brand_allocations FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_delete_team_allocations" ON team_member_brand_allocations;
CREATE POLICY "workspace_delete_team_allocations"
ON team_member_brand_allocations FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON team_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_team_allocations_updated_at ON team_member_brand_allocations;
CREATE TRIGGER trg_team_allocations_updated_at BEFORE UPDATE ON team_member_brand_allocations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 6. Settings tables
-- =============================================================================

-- social_platform_settings is INTENTIONALLY GLOBAL (matches the repo schema:
-- no workspace_id — it configures which platforms exist system-wide). Reads are
-- open to authenticated users (non-sensitive, global config). Writes are
-- restricted to workspace owners/admins and the PATCH route requires the same
-- role (server-side). No anon access; no workspace_* naming (it is not
-- workspace-scoped).
CREATE TABLE IF NOT EXISTS social_platform_settings (
  platform   social_platform PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed idempotently per platform. Production's social_platform enum may lack
-- values that were added by later repo enum migrations, so each insert is
-- wrapped: if the enum does not contain the value yet the platform is SKIPPED
-- with a notice instead of aborting the whole migration (the enum-add
-- migrations can be applied later, then this seed re-runs safely).
DO $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY ARRAY['instagram', 'telegram', 'youtube', 'twitter',
                           'bale', 'eita', 'rubika', 'rubino', 'soroushplus',
                           'aparat', 'threads', 'clubhouse', 'shad', 'igap',
                           'site', 'gap', 'virasty', 'facebook'] LOOP
    BEGIN
      EXECUTE format(
        'INSERT INTO social_platform_settings (platform, enabled) VALUES (%L, true) ON CONFLICT (platform) DO NOTHING',
        p
      );
    EXCEPTION
      WHEN invalid_text_representation OR undefined_object THEN
        RAISE NOTICE 'social_platform value % not available yet — seed skipped (apply enum migration first)', p;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_platform_settings_enabled ON social_platform_settings(enabled);

ALTER TABLE social_platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_platform_settings" ON social_platform_settings;
DROP POLICY IF EXISTS "write_social_platform_settings" ON social_platform_settings;
DROP POLICY IF EXISTS "workspace_read_social_platform_settings" ON social_platform_settings;
DROP POLICY IF EXISTS "workspace_update_social_platform_settings" ON social_platform_settings;

-- Global config read for authenticated users (documented intentional).
DROP POLICY IF EXISTS "authenticated_read_social_platform_settings" ON social_platform_settings;
CREATE POLICY "authenticated_read_social_platform_settings"
ON social_platform_settings FOR SELECT TO authenticated
USING (true);

-- Writes limited to workspace owners/admins (no other authenticated user can
-- change global platform enablement). An INSERT policy is REQUIRED for the
-- PostgREST upsert path (ON CONFLICT executes as INSERT) — also owner/admin
-- only; the PK is the enum platform so no cross-row scope exists to enforce.
DROP POLICY IF EXISTS "admin_update_social_platform_settings" ON social_platform_settings;
CREATE POLICY "admin_update_social_platform_settings"
ON social_platform_settings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "admin_insert_social_platform_settings" ON social_platform_settings;
CREATE POLICY "admin_insert_social_platform_settings"
ON social_platform_settings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);

DROP TRIGGER IF EXISTS trg_social_platform_settings_updated_at ON social_platform_settings;
CREATE TRIGGER trg_social_platform_settings_updated_at
BEFORE UPDATE ON social_platform_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- user_settings: per-user, own-row only (matches the repo migration).
CREATE TABLE IF NOT EXISTS user_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_name text NOT NULL DEFAULT 'Media Deck',
  timezone       text NOT NULL DEFAULT 'Asia/Tehran',
  date_format    text NOT NULL DEFAULT 'jalali' CHECK (date_format IN ('jalali', 'gregorian', 'auto')),
  theme          text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  density        text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  notifications  jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
CREATE POLICY "Users can read own settings"
ON user_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
ON user_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
ON user_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 7. notifications — non-destructive upgrade + security replacement (Phase 9)
--    No workspace_id backfill: Production has multiple workspaces and existing
--    rows have no provable mapping; they are preserved untouched (NULL) and
--    reported by tools/production_verify.sql check #7.
-- =============================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);

-- Replace the four open permissive policies. Also clear any workspace_* names
-- from a previous/parallel run so the definitions below are authoritative.
DROP POLICY IF EXISTS "public_read_notifications" ON notifications;
DROP POLICY IF EXISTS "client_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "client_update_notifications" ON notifications;
DROP POLICY IF EXISTS "client_delete_notifications" ON notifications;
DROP POLICY IF EXISTS "workspace_read_notifications" ON notifications;
DROP POLICY IF EXISTS "workspace_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "workspace_update_notifications" ON notifications;
DROP POLICY IF EXISTS "workspace_delete_notifications" ON notifications;

-- notifications.user_id is text; auth.uid() is uuid → compare after cast.
-- Policy logic is intentionally member-or-own-row; no bare `true` anywhere.
CREATE POLICY "workspace_read_notifications"
ON notifications FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

CREATE POLICY "workspace_insert_notifications"
ON notifications FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

CREATE POLICY "workspace_update_notifications"
ON notifications FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text)
WITH CHECK (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

CREATE POLICY "workspace_delete_notifications"
ON notifications FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

-- =============================================================================
-- 8. contents (Phase 10)
--    Prerequisites (all created above): workspaces ✅, brands ✅ (empty),
--    finance_campaigns ✅. brand_id/campaign_id stay NULL for new rows until a
--    brand/campaign is chosen — no auto-assignment.
-- =============================================================================

CREATE TABLE IF NOT EXISTS contents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id     uuid REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id  text REFERENCES finance_campaigns(id) ON DELETE SET NULL,
  title        text NOT NULL,
  type         text NOT NULL DEFAULT 'post'
    CHECK (type IN ('post', 'reel', 'story', 'video', 'carousel', 'document', 'other')),
  status       text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'rejected', 'cancelled', 'failed')),
  body         text NOT NULL DEFAULT '',
  platform     text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contents_workspace_status ON contents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_contents_brand_id ON contents(brand_id);
CREATE INDEX IF NOT EXISTS idx_contents_campaign_id ON contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contents_scheduled_at ON contents(scheduled_at);

ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_read_contents" ON contents;
CREATE POLICY "workspace_read_contents"
ON contents FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_insert_contents" ON contents;
CREATE POLICY "workspace_insert_contents"
ON contents FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_update_contents" ON contents;
CREATE POLICY "workspace_update_contents"
ON contents FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_delete_contents" ON contents;
CREATE POLICY "workspace_delete_contents"
ON contents FOR DELETE TO authenticated
USING (
  is_workspace_member(workspace_id)
  AND EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = contents.workspace_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

DROP TRIGGER IF EXISTS trg_contents_updated_at ON contents;
CREATE TRIGGER trg_contents_updated_at
BEFORE UPDATE ON contents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 9. audit_logs (Phase 11)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL DEFAULT '',
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_read_audit_logs" ON audit_logs;
CREATE POLICY "workspace_read_audit_logs"
ON audit_logs FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_insert_audit_logs" ON audit_logs;
CREATE POLICY "workspace_insert_audit_logs"
ON audit_logs FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

-- =============================================================================
-- 10. flow_cards — Phase 23 nullable links only (Prisma-owned table, untouched)
--     brands(id) and contents(id) both exist above. Guarded: runs only when the
--     table exists (Prisma creates it out of band).
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.flow_cards') IS NOT NULL THEN
    ALTER TABLE flow_cards ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
    ALTER TABLE flow_cards ADD COLUMN IF NOT EXISTS content_id uuid REFERENCES contents(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_flow_cards_brand_id ON flow_cards(brand_id);
    CREATE INDEX IF NOT EXISTS idx_flow_cards_content_id ON flow_cards(content_id);
  END IF;
END $$;

-- =============================================================================
-- 11. Final schema validation (fail loudly instead of false-success)
--     CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS never silently
--     repair a DIVERGENT pre-existing object. If any table/column the app
--     depends on is missing or shaped differently (e.g. a legacy finance table
--     with NOT NULL brand text still present), this migration FAILS here so the
--     mismatch is reported instead of being ignored.
-- =============================================================================

DO $$
DECLARE t text; col text; present boolean;
BEGIN
  -- Tables this migration is responsible for must all exist now.
  FOREACH t IN ARRAY ARRAY['brands', 'finance_budgets', 'finance_campaigns',
                           'finance_expenses', 'finance_expense_allocations',
                           'team_members', 'team_member_brand_allocations',
                           'social_platform_settings', 'user_settings',
                           'contents', 'audit_logs'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'reconciliation failed: required table % does not exist', t;
    END IF;
  END LOOP;

  -- Columns the application writes/reads. brand_id/workspace_id are the
  -- post-migration shape — a legacy-only table (brand text, no brand_id) must
  -- never be left in place silently.
  -- NOTE: iterated as a VALUES list via FOR (multi-target FOREACH is only valid
  -- over composite-record arrays; this form is valid in every PG version).
  -- Each element is a 'table.column' pair; split inside the loop. FOREACH over
  -- a flat text[] with a single target is valid in every PG version and keeps
  -- the loop variables free of SQL-identifier collisions.
  FOREACH t IN ARRAY ARRAY[
    'brands.workspace_id',
    'finance_budgets.brand_id',
    'finance_budgets.workspace_id',
    'finance_campaigns.brand_id',
    'finance_campaigns.workspace_id',
    'finance_expenses.brand_id',
    'finance_expenses.workspace_id',
    'finance_expense_allocations.expense_id',
    'team_members.workspace_id',
    'team_member_brand_allocations.workspace_id',
    'team_member_brand_allocations.brand_id',
    'user_settings.user_id',
    'contents.workspace_id',
    'contents.brand_id',
    'contents.campaign_id',
    'audit_logs.workspace_id',
    'notifications.workspace_id',
    'notifications.type',
    'notifications.link'
  ] LOOP
    col := split_part(t, '.', 2);
    t := split_part(t, '.', 1);
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = col
    ) INTO present;
    IF NOT present THEN
      RAISE EXCEPTION 'reconciliation failed: % . % missing required column %',
        t, 'table', col;
    END IF;
  END LOOP;

  -- Legacy brand text columns on finance tables must not be NOT NULL
  -- (the application inserts brand_id only — such a column would reject writes).
  FOREACH t IN ARRAY ARRAY['finance_budgets', 'finance_campaigns', 'finance_expenses'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t
        AND column_name = 'brand' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION
        'reconciliation failed: % has legacy NOT NULL brand text column — app writes brand_id only',
        t;
    END IF;
  END LOOP;

  -- flow_cards is optional (Prisma-owned); if present it must have the links.
  IF to_regclass('public.flow_cards') IS NOT NULL THEN
    FOREACH col IN ARRAY ARRAY['brand_id', 'content_id'] LOOP
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'flow_cards' AND column_name = col
      ) INTO present;
      IF NOT present THEN
        RAISE EXCEPTION 'reconciliation failed: flow_cards missing column %', col;
      END IF;
    END LOOP;
  END IF;
END $$;

-- =============================================================================
-- 12. Post-conditions reminder (run separately, read-only):
--   - tools/production_verify.sql              → required checks
--   - tools/brand_workspace_mapping_report.sql → manual brand/workspace mapping
-- No business rows were modified by this migration.
-- =============================================================================
