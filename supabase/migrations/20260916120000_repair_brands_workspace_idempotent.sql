-- =============================================================================
-- 20260916120000_repair_brands_workspace_idempotent.sql
-- =============================================================================
-- Purpose:
--   Every workspace owner must see the platform's standard brand catalog
--   (the 13 brands in `brands`). Rows were seeded only into the newest
--   workspace (LIMIT-1 default-workspace fallback in createBrand), so other
--   owners (e.g. workspaces 354fe6a4 / 88781318 / ddc01ee7) have no brands of
--   their own and their /brands pages come up empty while social cards show.
--
-- Non-destructive by design (PRD Dev Rule 3 / ADR-011):
--   * UPDATE-only backfills of NULL brand_id; never overwrites non-NULL ids.
--   * INSERT ... ON CONFLICT (workspace_id, name) DO NOTHING — re-running is
--     a no-op.
--   * No DELETE, no DROP, no TRUNCATE, no reset anywhere.
--
-- Scope guard: only rows whose workspace has an OWNER in workspace_members
-- are populated (membership-driven, no hardcoding).
-- =============================================================================

-- 1) Replicate each missing brand into every owner's workspace ---------------
INSERT INTO brands (workspace_id, name, slug, status)
SELECT
  wm.workspace_id,
  src.name,
  src.slug,
  'active'
FROM brands src
JOIN workspace_members wm
  ON wm.role = 'owner'
JOIN workspaces w
  ON w.id = wm.workspace_id
WHERE src.workspace_id = (
  -- reference catalog = the workspace holding the most brand rows
  SELECT b.workspace_id
  FROM brands b
  GROUP BY b.workspace_id
  ORDER BY count(*) DESC, b.workspace_id
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM brands tgt
  WHERE tgt.workspace_id = wm.workspace_id
    AND tgt.name = src.name
)
ON CONFLICT (workspace_id, name) DO NOTHING;

-- 2) Backfill social_accounts.brand_id (column added if absent, safely) ------
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS brand_id uuid
  REFERENCES brands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_id
  ON social_accounts(brand_id);

-- Match by name within the SAME workspace first (strictest).
UPDATE social_accounts sa
SET brand_id = b.id
FROM brands b
WHERE sa.brand_id IS NULL
  AND sa.brand = b.name
  AND EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = b.workspace_id
      AND w.created_at <= COALESCE(sa.created_at, now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM brands b2
    WHERE b2.workspace_id = b.workspace_id
      AND b2.name = sa.brand
      AND b2.created_at > b.created_at
  );

-- Names not covered above (shared catalog): fall back to the newest active
-- brand row with that name (deterministic).
UPDATE social_accounts sa
SET brand_id = b.id
FROM (
  SELECT DISTINCT ON (name) id, name
  FROM brands
  WHERE status = 'active'
  ORDER BY name, created_at DESC
) b
WHERE sa.brand_id IS NULL
  AND sa.brand = b.name;

-- 3) Backfill finance_* .brand_id the same way (never overwriting non-NULL) --
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['finance_budgets','finance_expenses','finance_campaigns'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'brand_id'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = t AND column_name = 'brand'
      ) THEN
        EXECUTE format($f$
          UPDATE %I sa
          SET brand_id = b.id
          FROM (SELECT DISTINCT ON (name) id, name FROM brands
                WHERE status = 'active' ORDER BY name, created_at DESC) b
          WHERE sa.brand_id IS NULL AND sa.brand = b.name
        $f$, t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 4) Post-conditions (visible in output when run via psql) --------------------
DO $$
DECLARE
  per_ws bigint; zero_ws bigint; total bigint;
BEGIN
  SELECT count(DISTINCT workspace_id) INTO per_ws FROM brands;
  SELECT count(*) INTO zero_ws FROM workspace_members wm
   WHERE wm.role = 'owner'
     AND NOT EXISTS (SELECT 1 FROM brands b WHERE b.workspace_id = wm.workspace_id);
  SELECT count(*) INTO total FROM brands;
  RAISE NOTICE 'brands total=%, workspaces covered=%, owner workspaces still empty=%',
    total, per_ws, zero_ws;
END $$;
