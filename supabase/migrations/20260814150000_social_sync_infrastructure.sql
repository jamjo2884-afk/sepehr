/*
# Social sync infrastructure: connection state + sync history

## Purpose
Track how each `social_account` connects to its platform API and what the
automatic sync pipeline has done, so the UI can show "last successful sync",
"sync status", and every sync run is traceable.

## New
1. `social_accounts` gains connection columns (kept separate from the
   existing `status` lifecycle column, which stays active/inactive/...):
   - `connection_status`  — connected / disconnected / error / pending
   - `last_sync_at`       — when the last sync attempt finished
   - `last_sync_status`   — success / error / running
   - `last_successful_sync_at` — when the last SUCCESS finished
2. `social_sync_logs` — one row per sync run:
   - id, social_account_id (FK cascade), platform
   - started_at / finished_at
   - status: running / success / error
   - records_fetched / records_written
   - error_code, error_message (sanitized — never contains tokens/secrets)

## Security
- Same RLS stance as the rest of the demo schema: reads open to
  anon+authenticated, writes open to anon+authenticated (the sync runs from
  a server route with the same anon client the app uses).
- `error_message` must never contain credentials — enforced by the sync
  service (sanitizer), not by the schema.

Idempotent: re-running is safe.
*/

-- ===========================================================================
-- 1. Connection columns on social_accounts
-- ===========================================================================
ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'disconnected';

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS last_sync_status text;

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz;

-- ===========================================================================
-- 2. social_sync_logs
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_sync_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  social_account_id uuid NOT NULL
    REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'error')),
  records_fetched integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_sync_logs_account
  ON social_sync_logs(social_account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_sync_logs_status
  ON social_sync_logs(status);

-- ===========================================================================
-- 3. RLS
-- ===========================================================================
ALTER TABLE social_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_sync_logs" ON social_sync_logs;
CREATE POLICY "public_read_social_sync_logs"
ON social_sync_logs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "client_insert_social_sync_logs" ON social_sync_logs;
CREATE POLICY "client_insert_social_sync_logs"
ON social_sync_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "client_update_social_sync_logs" ON social_sync_logs;
CREATE POLICY "client_update_social_sync_logs"
ON social_sync_logs FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);
