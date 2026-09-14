/*
# 20260914 — Brand Status Profile (صورت وضعیت برند)

## Purpose
One editable, per-brand "management profile" (وضعیت کلی، تولید محتوا،
انتشار، جریان‌سازی، نیازها) shown on the brand detail page
(`/brands/[id]` → تب «صورت وضعیت برند»).

- One row per brand: `brand_id` is UNIQUE.
- All fields are free-form text (managerial notes), stored as `text`.
- Follower / social numbers are NOT stored here — they are always read
  live from `social_accounts` + `social_metrics` (single source of truth,
  no duplicated data).

## Safety
- Non-destructive: additive DDL only (CREATE TABLE IF NOT EXISTS).
- Idempotent: safe to re-run.
- RLS = authenticated + workspace-scoped (Model A), via the existing
  `is_workspace_member()` helper — same pattern as `brands` in
  20260907_production_schema_reconciliation.sql.
- ON DELETE CASCADE: deleting a brand removes its profile.
*/

-- =============================================================================
-- 1. Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS brand_status_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id     uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- هویت و جایگاه برند
  brand_definition       text NOT NULL DEFAULT '',
  brand_mission          text NOT NULL DEFAULT '',
  brand_audience         text NOT NULL DEFAULT '',
  brand_position         text NOT NULL DEFAULT '',
  brand_strengths        text NOT NULL DEFAULT '',
  brand_weaknesses       text NOT NULL DEFAULT '',

  -- وضعیت تولید محتوا
  content_status         text NOT NULL DEFAULT '',
  content_formats        text NOT NULL DEFAULT '',
  content_weaknesses     text NOT NULL DEFAULT '',
  content_needs          text NOT NULL DEFAULT '',
  content_staffing_needs text NOT NULL DEFAULT '',

  -- وضعیت انتشار و توزیع
  publishing_status      text NOT NULL DEFAULT '',
  publishing_discipline  text NOT NULL DEFAULT '',
  publishing_channels    text NOT NULL DEFAULT '',
  distribution_issues    text NOT NULL DEFAULT '',
  distribution_opportunities text NOT NULL DEFAULT '',

  -- وضعیت جریان‌سازی و تبلیغات
  monetization_topics    text NOT NULL DEFAULT '',
  ad_capacity            text NOT NULL DEFAULT '',
  active_campaigns       text NOT NULL DEFAULT '',
  ad_opportunities       text NOT NULL DEFAULT '',
  ad_needs               text NOT NULL DEFAULT '',

  -- نیازهای برند
  top_need               text NOT NULL DEFAULT '',
  urgent_needs           text NOT NULL DEFAULT '',
  midterm_needs          text NOT NULL DEFAULT '',
  management_suggestions text NOT NULL DEFAULT '',

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_status_profiles_workspace_id
  ON brand_status_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_status_profiles_brand_id
  ON brand_status_profiles(brand_id);

-- =============================================================================
-- 2. RLS — workspace-scoped (Model A), same as brands
-- =============================================================================

ALTER TABLE brand_status_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_read_brand_status_profiles" ON brand_status_profiles;
CREATE POLICY "workspace_read_brand_status_profiles"
ON brand_status_profiles FOR SELECT TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_insert_brand_status_profiles" ON brand_status_profiles;
CREATE POLICY "workspace_insert_brand_status_profiles"
ON brand_status_profiles FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_update_brand_status_profiles" ON brand_status_profiles;
CREATE POLICY "workspace_update_brand_status_profiles"
ON brand_status_profiles FOR UPDATE TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_delete_brand_status_profiles" ON brand_status_profiles;
CREATE POLICY "workspace_delete_brand_status_profiles"
ON brand_status_profiles FOR DELETE TO authenticated
USING (is_workspace_member(workspace_id));

-- =============================================================================
-- 3. updated_at trigger (same helper as the rest of the business schema)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_brand_status_profiles_updated_at ON brand_status_profiles;
CREATE TRIGGER trg_brand_status_profiles_updated_at
BEFORE UPDATE ON brand_status_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
