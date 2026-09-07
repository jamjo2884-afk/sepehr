-- =============================================================================
-- BRAND/WORKSPACE MAPPING REPORT (read-only)
-- Project: Media Deck / sepehr — Date: 2026-09-07
--
-- Production has 3 workspaces / 3 members. The 110 legacy social_accounts rows
-- were created before the workspace concept, so NO workspace→brand mapping is
-- provable from the data. Per the recovery rules nothing is auto-assigned.
--
-- Run this in Supabase SQL Editor to produce the manual mapping list:
--  1. see every workspace (assign target)
--  2. see every distinct legacy brand string with its account count
--  3. see blank/ambiguous brand accounts (cannot be mapped automatically)
--  4. apply the assignments in a LATER, separate migration (never guessed here)
-- =============================================================================

-- 1. Workspaces (mapping targets)
SELECT '1. workspaces' AS section;
SELECT id, name, slug, created_at
FROM workspaces
ORDER BY created_at;

-- 2. Workspace memberships (who can act in which workspace)
SELECT '2. memberships' AS section;
SELECT wm.workspace_id, w.name AS workspace_name, wm.user_id, wm.role
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
ORDER BY wm.workspace_id;

-- 3. Distinct legacy brand values from social_accounts (the only legacy brand
--    source with data today) + account counts. These are the candidates that a
--    future mapping migration will assign to a workspace + create brands rows.
SELECT '3. legacy brand candidates (brand -> account count)' AS section;
SELECT brand, count(*) AS accounts,
       count(DISTINCT platform) AS platforms
FROM social_accounts
WHERE brand IS NOT NULL AND brand <> ''
GROUP BY brand
ORDER BY accounts DESC, brand;

-- 4. Ambiguous: blank brand values cannot be mapped automatically.
SELECT '4. blank/ambiguous brand accounts' AS section;
SELECT count(*) AS total_blank_brand_accounts
FROM social_accounts
WHERE brand IS NULL OR brand = '';

SELECT '5. sample of blank-brand accounts' AS section;
SELECT id, platform, username, display_name, url
FROM social_accounts
WHERE brand IS NULL OR brand = ''
ORDER BY created_at
LIMIT 25;

-- 6. Per-platform spread of each brand (helps choose a workspace target).
SELECT '6. brand x platform spread' AS section;
SELECT brand, platform, count(*) AS accounts
FROM social_accounts
WHERE brand IS NOT NULL AND brand <> ''
GROUP BY brand, platform
ORDER BY brand, platform;

-- =============================================================================
-- NEXT STEP (NOT executable here — belongs in a future, separate migration once
-- the assignments above are decided):
--   INSERT INTO brands (workspace_id, name, slug) VALUES (...) ON CONFLICT DO NOTHING;
--   ALTER TABLE social_accounts ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
--   UPDATE social_accounts sa SET brand_id = b.id FROM brands b
--     WHERE sa.brand = b.name AND sa.brand_id IS NULL AND b.workspace_id = <assigned>;
--   ... plus the matching workspace_id backfill and unique-constraint swap.
-- No such migration is written yet: assignments must come from a human first.
-- =============================================================================
