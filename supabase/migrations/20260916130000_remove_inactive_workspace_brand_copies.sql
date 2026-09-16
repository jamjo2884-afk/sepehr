-- Remove the catalog copies introduced by 20260916120000 only from the two
-- inactive owner workspaces. The two active workspaces are intentionally out
-- of scope.
--
-- Safety:
--   * Accounts are unlinked, never deleted.
--   * Only accounts created on 2026-08-24 UTC and currently linked through a
--     target-workspace brand are changed.
--   * Only the 13 standard catalog names are deleted, preserving any custom
--     brands in those workspaces.

WITH unlinked AS (
  UPDATE social_accounts sa
  SET brand_id = NULL
  FROM brands b
  WHERE sa.brand_id = b.id
    AND b.workspace_id IN (
      '354fe6a4-d14d-448c-8dfa-768f85c65b24'::uuid,
      '88781318-4e80-40e3-89a0-7a65dd0f40b9'::uuid
    )
    AND (sa.created_at AT TIME ZONE 'UTC')::date = DATE '2026-08-24'
  RETURNING sa.id
), deleted AS (
  DELETE FROM brands
  WHERE workspace_id IN (
      '354fe6a4-d14d-448c-8dfa-768f85c65b24'::uuid,
      '88781318-4e80-40e3-89a0-7a65dd0f40b9'::uuid
    )
    AND name IN (
      'ازما', 'جنگ با ارزو ها', 'دیده بان دولت', 'رهبر سوم', 'روشنگری',
      'سینه فیلیا', 'صد درجه', 'فصل 11', 'کبریت', 'کف خیابون', 'مردمک',
      'نسیم آنلاین', 'نود اقتصادی'
    )
  RETURNING id
)
SELECT
  (SELECT count(*) FROM unlinked) AS social_accounts_unlinked,
  (SELECT count(*) FROM deleted) AS brands_deleted;
