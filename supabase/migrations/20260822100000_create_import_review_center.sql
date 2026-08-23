/*
# Import Review Center: sessions, rows, audit log

## Purpose
Track every bulk-import attempt through a full lifecycle:
Upload → Parse → Validate → Review → Resolve/Reject → Commit → History.

Three new tables:
- `import_sessions` — one per file upload, tracks overall state.
- `import_rows` — one per Excel/CSV row, tracks per-row state + matching.
- `import_audit_log` — immutable log of every manual action on a row.

## Security (RLS)
Same pattern as social_data_quality_reviews: anon + authenticated can
SELECT; writes use service role (or the server-side API routes).
*/

-- ===========================================================================
-- 1. Enum: row status
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE import_row_status AS ENUM (
    'pending',    -- parsed, not yet validated
    'valid',      -- exact match, no issues
    'error',      -- problem found (account not found, invalid data, …)
    'ambiguous',  -- multiple candidates, needs user decision
    'resolved',   -- user fixed the issue
    'rejected',   -- user chose to skip this row
    'imported'    -- successfully written to Supabase
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. Enum: session status
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE import_session_status AS ENUM (
    'draft',            -- file uploaded, not yet processed
    'validating',       -- server-side parse + match in progress
    'review_required',  -- rows need human review
    'ready',            -- all rows valid/resolved, ready to commit
    'importing',        -- commit in progress
    'completed',        -- all rows imported
    'cancelled',        -- user cancelled
    'failed'            -- commit failed
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 3. import_sessions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS import_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text NOT NULL,
  file_type     text NOT NULL DEFAULT 'xlsx',  -- xlsx / csv
  total_rows    integer NOT NULL DEFAULT 0,
  valid_rows    integer NOT NULL DEFAULT 0,
  error_rows    integer NOT NULL DEFAULT 0,
  ambiguous_rows integer NOT NULL DEFAULT 0,
  resolved_rows integer NOT NULL DEFAULT 0,
  rejected_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status        import_session_status NOT NULL DEFAULT 'draft',
  created_by    uuid,                           -- nullable: auth user id
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created ON import_sessions(created_at DESC);

-- ===========================================================================
-- 4. import_rows
-- ===========================================================================
CREATE TABLE IF NOT EXISTS import_rows (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  row_number          integer NOT NULL,
  raw_data            jsonb NOT NULL,            -- original Excel cell values
  normalized_data     jsonb NOT NULL,            -- parsed + normalized values
  platform            text,                      -- normalized platform
  account_identifier  text,                      -- raw identifier from file
  username            text,                      -- normalized username
  display_name        text,                      -- from file if available
  brand               text,                      -- from file if available
  period              text,                      -- daily / weekly / monthly
  period_label        text,                      -- e.g. '1405-05'
  matched_account_id  uuid,                      -- FK to social_accounts (nullable)
  status              import_row_status NOT NULL DEFAULT 'pending',
  error_type          text,                      -- e.g. ACCOUNT_NOT_FOUND
  error_message       text,                      -- human-readable Persian message
  resolution_type     text,                      -- match_existing / create_account / edit / none
  resolution_data     jsonb,                     -- details of the resolution
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_import_rows_session ON import_rows(session_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_rows(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_error ON import_rows(error_type) WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_rows_platform ON import_rows(platform);

-- ===========================================================================
-- 5. import_audit_log
-- ===========================================================================
CREATE TABLE IF NOT EXISTS import_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  row_id      uuid NOT NULL REFERENCES import_rows(id) ON DELETE CASCADE,
  action      text NOT NULL,                    -- match_existing / reject / edit / create_account / revalidate
  old_value   jsonb,                            -- previous state
  new_value   jsonb,                            -- new state
  user_id     uuid,                             -- nullable
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_audit_session ON import_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_row ON import_audit_log(row_id);

-- ===========================================================================
-- 6. RLS
-- ===========================================================================
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_audit_log ENABLE ROW LEVEL SECURITY;

-- Read policies
DROP POLICY IF EXISTS "public_read_import_sessions" ON import_sessions;
CREATE POLICY "public_read_import_sessions"
ON import_sessions FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "public_read_import_rows" ON import_rows;
CREATE POLICY "public_read_import_rows"
ON import_rows FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "public_read_import_audit_log" ON import_audit_log;
CREATE POLICY "public_read_import_audit_log"
ON import_audit_log FOR SELECT
TO anon, authenticated
USING (true);

-- Write policies (anon + authenticated, same pattern as social writes)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['import_sessions', 'import_rows', 'import_audit_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ===========================================================================
-- 7. updated_at triggers
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_import_sessions_updated_at ON import_sessions;
CREATE TRIGGER trg_import_sessions_updated_at
BEFORE UPDATE ON import_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_import_rows_updated_at ON import_rows;
CREATE TRIGGER trg_import_rows_updated_at
BEFORE UPDATE ON import_rows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
