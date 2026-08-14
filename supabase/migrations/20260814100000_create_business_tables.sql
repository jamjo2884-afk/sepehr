/*
# Business schema (projects, campaigns, media, operations, ...)

## Purpose
Back the mediaOS dashboard with real Supabase data. Mirrors the domain
types in `src/types/domain.ts` and the mock data in
`src/features/mock-data/index.ts` so every module can move from static
snapshots to the database.

## New Tables
- `projects`          — top-level media projects (per workspace)
- `campaigns`         — coordinated media efforts within a project
- `media_assets`      — media files owned by a project
- `operations`        — units of operational work within a project
- `knowledge_items`   — knowledge-base entries (article, note, playbook, ...)
- `audience_segments` — audience segments targeted by campaigns
- `automations`       — automation rules (trigger -> action)
- `analytics_reports` — generated analytics reports
- `notifications`     — in-app notifications for a user
- `activity_items`    — recent activity feed entries

## Enums
Each column uses a Postgres enum mirroring the TS string unions so the
client can map values 1:1.

## Security (RLS)
- SELECT is open to `anon` + `authenticated` so the dashboard reads with
  the anon key (same pattern as `social_followers` — preview mode has no
  login yet).
- No INSERT/UPDATE/DELETE policies are granted to anon. Writes happen via
  the service role (seed/import scripts), which bypasses RLS. This keeps
  the public read path simple without opening write access.

## Notes
- Re-running is safe: CREATE TABLE IF NOT EXISTS, enums in DO blocks,
  policies dropped before create.
*/

-- ===========================================================================
-- 1. Enums
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_asset_type AS ENUM ('image', 'video', 'audio', 'document', 'archive', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operation_type AS ENUM ('planning', 'production', 'review', 'distribution', 'monitoring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operation_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE knowledge_item_type AS ENUM ('article', 'note', 'playbook', 'reference');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. Tables
-- ===========================================================================
CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL DEFAULT 'demo',
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  status project_status NOT NULL DEFAULT 'planning',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  thumbnail_url text,
  owner_id text NOT NULL DEFAULT 'demo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status campaign_status NOT NULL DEFAULT 'draft',
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type media_asset_type NOT NULL DEFAULT 'other',
  url text NOT NULL DEFAULT '',
  thumbnail_url text,
  size_bytes bigint NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type operation_type NOT NULL DEFAULT 'planning',
  status operation_status NOT NULL DEFAULT 'todo',
  assignee_id text,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type knowledge_item_type NOT NULL DEFAULT 'note',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audience_segments (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  size integer NOT NULL DEFAULT 0,
  criteria text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automations (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  trigger text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_reports (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  period text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL DEFAULT 'demo',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  project_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_operations_project_id ON operations(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_project_id ON knowledge_items(project_id);
CREATE INDEX IF NOT EXISTS idx_audience_segments_project_id ON audience_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_automations_project_id ON automations(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_project_id ON analytics_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_items_created_at ON activity_items(created_at DESC);

-- ===========================================================================
-- 4. RLS
-- ===========================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_items ENABLE ROW LEVEL SECURITY;

-- Public read (anon + authenticated) — same pattern as social_followers.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['projects','campaigns','media_assets','operations',
    'knowledge_items','audience_segments','automations','analytics_reports',
    'notifications','activity_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "public_read_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- Writes: no anon/authenticated policies. The service role (seed/import
-- scripts) bypasses RLS and is the only write path for now.

-- ===========================================================================
-- 5. updated_at triggers
-- ===========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['projects','campaigns','media_assets','operations',
    'knowledge_items','audience_segments','automations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
