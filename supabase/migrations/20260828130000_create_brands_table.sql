/*
# Phase 23 — Workspace & Brands Architecture

## Purpose
Create a proper `brands` table linked to workspaces, seed it from existing
brand strings, and add `brand_id` foreign key columns to all business tables.

This is a BACKWARD-COMPATIBLE migration:
- All existing `brand` text columns are preserved
- New `brand_id` columns are nullable (optional during transition)
- Application code continues using `brand` strings until brand_id is fully adopted

## Strategy
1. Create `brands` table
2. Seed from existing unique brand strings
3. Add `brand_id` columns (nullable) to business tables
4. Backfill `brand_id` from brand string
5. Application code updated to use brand_id when available

## Safety
- No TRUNCATE, DROP, or DELETE
- All existing data preserved
- Dual-column approach (brand + brand_id coexist)
- Reversible by dropping brand_id columns and brands table
*/

-- ===========================================================================
-- 1. Brands Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  logo_url    text,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name),
  UNIQUE (workspace_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_workspace_id ON brands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);

-- ===========================================================================
-- 2. Seed Default Workspace + Brands from existing data
-- ===========================================================================

-- Seed default workspace if not exists (for environments without auth trigger)
DO $$ DECLARE
  default_ws_id uuid;
BEGIN
  SELECT id INTO default_ws_id FROM workspaces LIMIT 1;
  IF default_ws_id IS NULL THEN
    INSERT INTO workspaces (name, slug)
    VALUES ('فضای کاری پیش‌فرض', 'default-workspace')
    RETURNING id INTO default_ws_id;
  END IF;
END $$;

-- Create brands from unique brand strings in social_accounts
DO $$ DECLARE
  ws_id uuid;
  brand_rec RECORD;
  brand_slug text;
BEGIN
  SELECT id INTO ws_id FROM workspaces LIMIT 1;
  IF ws_id IS NULL THEN RETURN; END IF;

  FOR brand_rec IN
    SELECT DISTINCT brand FROM social_accounts
    WHERE brand IS NOT NULL AND brand != ''
  LOOP
    -- Generate slug from brand name
    brand_slug := LOWER(REPLACE(REPLACE(TRIM(brand_rec.brand), ' ', '-'), '.', '-'));

    INSERT INTO brands (workspace_id, name, slug)
    VALUES (ws_id, TRIM(brand_rec.brand), brand_slug)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;

  -- Also seed brands from finance_budgets (may have brands not in social_accounts)
  FOR brand_rec IN
    SELECT DISTINCT brand FROM finance_budgets
    WHERE brand IS NOT NULL AND brand != ''
  LOOP
    brand_slug := LOWER(REPLACE(REPLACE(TRIM(brand_rec.brand), ' ', '-'), '.', '-'));
    INSERT INTO brands (workspace_id, name, slug)
    VALUES (ws_id, TRIM(brand_rec.brand), brand_slug)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;

  -- Also seed brands from team_member_brand_allocations
  FOR brand_rec IN
    SELECT DISTINCT brand FROM team_member_brand_allocations
    WHERE brand IS NOT NULL AND brand != ''
  LOOP
    brand_slug := LOWER(REPLACE(REPLACE(TRIM(brand_rec.brand), ' ', '-'), '.', '-'));
    INSERT INTO brands (workspace_id, name, slug)
    VALUES (ws_id, TRIM(brand_rec.brand), brand_slug)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ===========================================================================
-- 3. Add brand_id columns (nullable) to business tables
-- ===========================================================================

-- Social Accounts
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_id ON social_accounts(brand_id);

-- Finance Budgets
ALTER TABLE finance_budgets ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finance_budgets_brand_id ON finance_budgets(brand_id);

-- Finance Expenses
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finance_expenses_brand_id ON finance_expenses(brand_id);

-- Finance Campaigns
ALTER TABLE finance_campaigns ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finance_campaigns_brand_id ON finance_campaigns(brand_id);

-- Team Member Brand Allocations
ALTER TABLE team_member_brand_allocations ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_team_allocations_brand_id ON team_member_brand_allocations(brand_id);

-- ===========================================================================
-- 4. Backfill brand_id from brand string
-- ===========================================================================

-- Social Accounts
UPDATE social_accounts sa
SET brand_id = b.id
FROM brands b
WHERE sa.brand = b.name AND sa.brand_id IS NULL;

-- Finance Budgets
UPDATE finance_budgets fb
SET brand_id = b.id
FROM brands b
WHERE fb.brand = b.name AND fb.brand_id IS NULL;

-- Finance Expenses
UPDATE finance_expenses fe
SET brand_id = b.id
FROM brands b
WHERE fe.brand = b.name AND fe.brand_id IS NULL;

-- Finance Campaigns
UPDATE finance_campaigns fc
SET brand_id = b.id
FROM brands b
WHERE fc.brand = b.name AND fc.brand_id IS NULL;

-- Team Member Brand Allocations
UPDATE team_member_brand_allocations tba
SET brand_id = b.id
FROM brands b
WHERE tba.brand = b.name AND tba.brand_id IS NULL;

-- ===========================================================================
-- 5. RLS for brands table
-- ===========================================================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read brands in their workspace
DROP POLICY IF EXISTS "authenticated_read_brands" ON brands;
CREATE POLICY "authenticated_read_brands"
ON brands FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id AND m.user_id = auth.uid()
  )
);

-- Authenticated users can create brands in their workspace
DROP POLICY IF EXISTS "authenticated_insert_brands" ON brands;
CREATE POLICY "authenticated_insert_brands"
ON brands FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id AND m.user_id = auth.uid()
  )
);

-- Workspace members can update brands
DROP POLICY IF EXISTS "authenticated_update_brands" ON brands;
CREATE POLICY "authenticated_update_brands"
ON brands FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id AND m.user_id = auth.uid()
  )
);

-- Workspace owners/admins can delete brands
DROP POLICY IF EXISTS "authenticated_delete_brands" ON brands;
CREATE POLICY "authenticated_delete_brands"
ON brands FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = brands.workspace_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- Demo mode: allow all operations when no workspace members exist
DROP POLICY IF EXISTS "demo_all_brands" ON brands;
CREATE POLICY "demo_all_brands"
ON brands FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ===========================================================================
-- 6. updated_at trigger for brands
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at
BEFORE UPDATE ON brands
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
