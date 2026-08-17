/*
# Social metric edit logs (PHASE 17 — bulk editing audit trail)

## Purpose
Bulk editing changes real `social_metrics` rows, so every applied change
must be traceable: which metric, which field, the old value, the new value,
when, and (once auth exists) who. One row per CHANGED FIELD — a bulk
operation that changes 3 fields of one metric writes 3 rows. Rows are only
written when the stored value actually changes (10 → 10 writes nothing).

## Identity & denormalization
- `metric_id` is a real FK to `social_metrics(id)` with ON DELETE CASCADE
  (metrics have stable ids; the row's lifecycle follows the metric).
- `account_id`, `period`, `period_label` are denormalized so the log stays
  self-contained even if the metric row is ever removed.
- `old_value` / `new_value` are JSONB so NULL is preserved explicitly as
  JSON null (never 0 or empty string) and mixed numeric types (bigint
  counts + numeric engagement_rate) round-trip exactly.

## Security
Same permissive demo pattern as the rest of the schema (reads open to
anon+authenticated, writes open to anon+authenticated — the app writes
from the server route with the anon client). `edited_by` stays NULL while
auth is bypassed; the column exists so authorization can be added later
without a schema change.

Idempotent: re-running is safe.
*/

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_metric_edit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_id bigint NOT NULL REFERENCES social_metrics(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  period social_metric_period NOT NULL,
  period_label text NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  edited_by uuid,
  edited_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'bulk_edit',
  CHECK (
    field IN (
      'followers', 'following', 'posts', 'views', 'likes', 'comments',
      'shares', 'saves', 'reach', 'impressions', 'engagementRate',
      'storyViews', 'channelMembers', 'retweets', 'subscribers'
    )
  )
);

-- ===========================================================================
-- 2. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_social_metric_edit_logs_metric
  ON social_metric_edit_logs(metric_id);
CREATE INDEX IF NOT EXISTS idx_social_metric_edit_logs_account_time
  ON social_metric_edit_logs(account_id, edited_at DESC);

-- ===========================================================================
-- 3. RLS (same demo pattern as social_metrics / social_sync_logs)
-- ===========================================================================
ALTER TABLE social_metric_edit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_metric_edit_logs"
  ON social_metric_edit_logs;
CREATE POLICY "public_read_social_metric_edit_logs"
ON social_metric_edit_logs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "client_insert_social_metric_edit_logs"
  ON social_metric_edit_logs;
CREATE POLICY "client_insert_social_metric_edit_logs"
ON social_metric_edit_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);
