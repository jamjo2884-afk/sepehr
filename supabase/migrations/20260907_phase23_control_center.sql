/*
# Phase 23 — Control Center Data Foundation

## Purpose
Foundation for the Media Deck Control Center:

1. `contents`       — content workflow entity
   (draft → review → approved → scheduled → published, with
   rejected / cancelled / failed terminal states).
   Linked to: brand (brand_id), campaign (campaign_id → finance_campaigns),
   creator (created_by), workspace (workspace_id).

2. `audit_logs`     — operational audit trail.
   Stores ONLY operational metadata (action, entity, user, minimal diff).
   Never stores tokens, passwords, secrets, cookies or credentials.
   Sensitive fields are redacted before writing (see services/audit.service.ts).

3. `notifications`  — NON-DESTRUCTIVE upgrade of the existing table:
   adds workspace_id / type / link, backfills workspace_id, and replaces the
   old open anon policies with workspace-scoped policies.

4. `flow_cards`     — nullable brand_id / content_id link columns
   (Task → Brand, Task → Content). Both FKs are ON DELETE SET NULL so
   deleting a brand or content never deletes a task/card.

## Safety
- Non-destructive: no DROP TABLE, TRUNCATE, or DELETE of business rows.
- Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
  DROP POLICY IF EXISTS everywhere.
- Workspace isolation via the existing `is_workspace_member()` helper
  (same pattern as 20260829100000_workspace_isolation.sql).
- No conflicts with prior migrations (new tables, additive columns,
  policy replacement only).
*/

-- =========================================================================
-- 1. contents
-- =========================================================================

CREATE TABLE IF NOT EXISTS contents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id     uuid REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id  text REFERENCES finance_campaigns(id) ON DELETE SET NULL,
  title        text NOT NULL,
  type         text NOT NULL DEFAULT 'post'
    CHECK (type IN ('post', 'reel', 'story', 'video', 'carousel', 'document', 'other')),
  status       text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'rejected', 'cancelled', 'failed')),
  body         text NOT NULL DEFAULT '',
  platform     text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contents_workspace_status ON contents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_contents_brand_id ON contents(brand_id);
CREATE INDEX IF NOT EXISTS idx_contents_campaign_id ON contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contents_scheduled_at ON contents(scheduled_at);

ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped policies (production): member can read/insert/update;
-- delete is restricted to owner/admin.
DROP POLICY IF EXISTS "workspace_read_contents" ON contents;
CREATE POLICY "workspace_read_contents"
ON contents FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_insert_contents" ON contents;
CREATE POLICY "workspace_insert_contents"
ON contents FOR INSERT
TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_update_contents" ON contents;
CREATE POLICY "workspace_update_contents"
ON contents FOR UPDATE
TO authenticated
USING (is_workspace_member(workspace_id))
WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_delete_contents" ON contents;
CREATE POLICY "workspace_delete_contents"
ON contents FOR DELETE
TO authenticated
USING (
  is_workspace_member(workspace_id)
  AND EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = contents.workspace_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- =========================================================================
-- 2. audit_logs
-- =========================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL DEFAULT '',
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_read_audit_logs" ON audit_logs;
CREATE POLICY "workspace_read_audit_logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id));

-- Inserts come from server-side services only; membership check keeps the
-- surface narrow while the service layer owns the real authorization.
DROP POLICY IF EXISTS "workspace_insert_audit_logs" ON audit_logs;
CREATE POLICY "workspace_insert_audit_logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_workspace_member(workspace_id));

-- =========================================================================
-- 3. notifications — non-destructive upgrade
-- =========================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);

-- Backfill workspace_id for pre-existing rows (default workspace).
DO $$ DECLARE
  default_ws uuid;
BEGIN
  SELECT id INTO default_ws FROM workspaces LIMIT 1;
  IF default_ws IS NULL THEN RETURN; END IF;
  UPDATE notifications SET workspace_id = default_ws WHERE workspace_id IS NULL;
END $$;

-- Replace the old open anon policies with workspace-scoped ones.
-- (Policy replacement only — no data is touched.)
DROP POLICY IF EXISTS "public_read_notifications" ON notifications;
DROP POLICY IF EXISTS "client_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "client_update_notifications" ON notifications;
DROP POLICY IF EXISTS "client_delete_notifications" ON notifications;

-- NOTE: notifications.user_id is `text` while auth.uid() is `uuid`, so the
-- per-user comparison casts auth.uid() to text.
DROP POLICY IF EXISTS "workspace_read_notifications" ON notifications;
CREATE POLICY "workspace_read_notifications"
ON notifications FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

DROP POLICY IF EXISTS "workspace_insert_notifications" ON notifications;
CREATE POLICY "workspace_insert_notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

DROP POLICY IF EXISTS "workspace_update_notifications" ON notifications;
CREATE POLICY "workspace_update_notifications"
ON notifications FOR UPDATE
TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text)
WITH CHECK (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

DROP POLICY IF EXISTS "workspace_delete_notifications" ON notifications;
CREATE POLICY "workspace_delete_notifications"
ON notifications FOR DELETE
TO authenticated
USING (is_workspace_member(workspace_id) OR user_id = auth.uid()::text);

-- =========================================================================
-- 4. flow_cards — Task → Brand / Task → Content links (nullable, SET NULL)
-- =========================================================================

DO $$ BEGIN
  ALTER TABLE flow_cards ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
  ALTER TABLE flow_cards ADD COLUMN IF NOT EXISTS content_id uuid REFERENCES contents(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_flow_cards_brand_id ON flow_cards(brand_id);
  CREATE INDEX IF NOT EXISTS idx_flow_cards_content_id ON flow_cards(content_id);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- =========================================================================
-- 5. updated_at trigger for contents
-- =========================================================================

DROP TRIGGER IF EXISTS trg_contents_updated_at ON contents;
CREATE TRIGGER trg_contents_updated_at
BEFORE UPDATE ON contents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();