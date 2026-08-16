/*
# Social data-quality reviews (PHASE 16 — human review state)

## Purpose
Phase 15 (`social-data-quality.service.ts`) detects data-quality issues
deterministically. The detector must stay deterministic and MUST NOT embed
human decisions, so the human review state ("reviewed" / "ignored") lives
in its own table. A review NEVER mutates `social_metrics` or
`social_accounts` — it is pure metadata about a detected issue.

## Identity
The unique identity of an issue is:

    (issue_type, account_id, metric_id, field)

PostgreSQL treats NULLs as distinct in a plain UNIQUE constraint, so two
rows with `metric_id IS NULL` (e.g. account-level issues) would both be
allowed. To make the identity behave correctly with NULLs, a single
COALESCE-based unique index is used (safe on any PostgreSQL version and
self-documenting):
- NULL account_id  → zero-uuid sentinel (orphan issues carry a dangling id)
- NULL metric_id   → 0 (identity sequences start at 1)
- NULL field       → '' (field is a metric-field key, never empty)

## References
- `metric_id` is a real FK to `social_metrics(id)` — metrics have stable
  ids and cascade cleanup is sensible.
- `account_id` is intentionally NOT a FK: orphan issues (defensive-only;
  the FK on `social_metrics.account_id` prevents them on real data) carry
  an account id that does not exist, so a FK would make reviews for those
  issues impossible. No fake foreign key is invented; the unique identity
  index is the integrity guard.

## RLS
Same permissive demo pattern as the rest of the schema (reads open to
anon+authenticated, writes open to anon+authenticated — the app writes
from the client with the anon key). Auth is still bypassed; nothing new.

Idempotent: re-running is safe.
*/

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_data_quality_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type text NOT NULL,
  account_id uuid,
  metric_id bigint REFERENCES social_metrics(id) ON DELETE CASCADE,
  field text,
  status text NOT NULL DEFAULT 'reviewed'
    CHECK (status IN ('reviewed', 'ignored')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    issue_type IN (
      'negative_metric',
      'invalid_engagement_rate',
      'future_metric',
      'stale_account',
      'temporal_gap',
      'orphan_metric',
      'duplicate_metric',
      'missing_optional_field',
      'account_without_metrics'
    )
  ),
  CHECK (
    field IS NULL OR field IN (
      'followers', 'following', 'posts', 'views', 'likes', 'comments',
      'shares', 'saves', 'reach', 'impressions', 'engagementRate',
      'storyViews', 'channelMembers', 'retweets', 'subscribers'
    )
  )
);

-- ===========================================================================
-- 2. Identity + lookup indexes
-- ===========================================================================

-- One review per logical issue, regardless of NULL columns (see header).
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_data_quality_reviews_identity
  ON social_data_quality_reviews (
    issue_type,
    COALESCE(account_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(metric_id, 0),
    COALESCE(field, '')
  );

CREATE INDEX IF NOT EXISTS idx_social_dq_reviews_account
  ON social_data_quality_reviews(account_id);
CREATE INDEX IF NOT EXISTS idx_social_dq_reviews_status
  ON social_data_quality_reviews(status);

-- ===========================================================================
-- 3. RLS (same demo pattern as social_metrics / social_sync_logs)
-- ===========================================================================
ALTER TABLE social_data_quality_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_data_quality_reviews"
  ON social_data_quality_reviews;
CREATE POLICY "public_read_social_data_quality_reviews"
ON social_data_quality_reviews FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "client_insert_social_data_quality_reviews"
  ON social_data_quality_reviews;
CREATE POLICY "client_insert_social_data_quality_reviews"
ON social_data_quality_reviews FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "client_update_social_data_quality_reviews"
  ON social_data_quality_reviews;
CREATE POLICY "client_update_social_data_quality_reviews"
ON social_data_quality_reviews FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "client_delete_social_data_quality_reviews"
  ON social_data_quality_reviews;
CREATE POLICY "client_delete_social_data_quality_reviews"
ON social_data_quality_reviews FOR DELETE
TO anon, authenticated
USING (true);

-- ===========================================================================
-- 4. updated_at trigger (reuses the existing set_updated_at() helper)
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_social_data_quality_reviews_updated_at
  ON social_data_quality_reviews;
CREATE TRIGGER trg_social_data_quality_reviews_updated_at
BEFORE UPDATE ON social_data_quality_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
