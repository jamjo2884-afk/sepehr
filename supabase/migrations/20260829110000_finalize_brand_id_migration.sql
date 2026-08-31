-- Phase 24G: Finalize brand_id migration
-- Drop legacy brand TEXT columns and migrate constraints to brand_id
--
-- Safety: All application code has been migrated to use brand_id.
-- The brand TEXT columns are no longer needed for business logic.
-- Display names come from brands.name via brand_id → brands.id join.

BEGIN;

-- ============================================================
-- 1. Replace UNIQUE constraints: brand → brand_id
-- ============================================================

-- social_accounts: UNIQUE(brand, platform, username) → UNIQUE(brand_id, platform, username)
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_brand_platform_username_key;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_brand_id_platform_username_key
  UNIQUE (brand_id, platform, username);

-- finance_budgets: UNIQUE(brand, period, period_label) → UNIQUE(brand_id, period, period_label)
ALTER TABLE finance_budgets DROP CONSTRAINT IF EXISTS finance_budgets_brand_period_period_label_key;
ALTER TABLE finance_budgets ADD CONSTRAINT finance_budgets_brand_id_period_period_label_key
  UNIQUE (brand_id, period, period_label);

-- team_member_brand_allocations: unique(team_member_id, brand) → unique(team_member_id, brand_id)
ALTER TABLE team_member_brand_allocations DROP CONSTRAINT IF EXISTS team_member_brand_allocations_team_member_id_brand_key;
ALTER TABLE team_member_brand_allocations ADD CONSTRAINT team_member_brand_allocations_team_member_id_brand_id_key
  UNIQUE (team_member_id, brand_id);

-- ============================================================
-- 2. Drop legacy brand TEXT columns
-- ============================================================

ALTER TABLE social_accounts DROP COLUMN IF EXISTS brand;
ALTER TABLE finance_budgets DROP COLUMN IF EXISTS brand;
ALTER TABLE finance_expenses DROP COLUMN IF EXISTS brand;
ALTER TABLE finance_campaigns DROP COLUMN IF EXISTS brand;
ALTER TABLE team_member_brand_allocations DROP COLUMN IF EXISTS brand;

-- ============================================================
-- 3. Drop legacy brand indexes (brand_id indexes already exist)
-- ============================================================

DROP INDEX IF EXISTS idx_social_accounts_brand;
DROP INDEX IF EXISTS idx_finance_budgets_brand;
DROP INDEX IF EXISTS idx_finance_expenses_brand;
DROP INDEX IF EXISTS idx_finance_campaigns_brand;
DROP INDEX IF EXISTS idx_team_allocations_brand;

COMMIT;
