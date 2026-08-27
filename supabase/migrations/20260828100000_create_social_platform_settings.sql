/*
# Social Platform Settings

## Purpose
Global per-platform configuration — primarily the `enabled` flag that
controls whether a platform is active in the system. One row per platform.

## New Tables
1. `social_platform_settings`
   - `platform` (social_platform, PK)
   - `enabled` (boolean, NOT NULL, default true)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

## Seeding
All 18 known platforms are inserted with `enabled = true` by default.

## Security (RLS)
- Anyone can read (same pattern as social_accounts).
- Authenticated users can update (demo mode uses anon key).

## Notes
- This is a GLOBAL setting, not per-user.
- No workspace concept exists yet.
- The `enabled` flag does NOT yet affect sync execution (deferred).
*/

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_platform_settings (
  platform   social_platform PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. Auto-update updated_at
-- ===========================================================================
CREATE OR REPLACE FUNCTION update_social_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_platform_settings_updated_at ON social_platform_settings;
CREATE TRIGGER trg_social_platform_settings_updated_at
  BEFORE UPDATE ON social_platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_social_platform_settings_updated_at();

-- ===========================================================================
-- 3. Seed all 18 platforms (idempotent)
-- ===========================================================================
INSERT INTO social_platform_settings (platform, enabled) VALUES
  ('instagram', true),
  ('telegram', true),
  ('youtube', true),
  ('twitter', true),
  ('bale', true),
  ('eita', true),
  ('rubika', true),
  ('rubino', true),
  ('soroushplus', true),
  ('aparat', true),
  ('threads', true),
  ('clubhouse', true),
  ('shad', true),
  ('igap', true),
  ('site', true),
  ('gap', true),
  ('virasty', true),
  ('facebook', true)
ON CONFLICT (platform) DO NOTHING;

-- ===========================================================================
-- 4. Row-Level Security
-- ===========================================================================
ALTER TABLE social_platform_settings ENABLE ROW LEVEL SECURITY;

-- Read: anyone (same as social_accounts)
DROP POLICY IF EXISTS "public_read_social_platform_settings" ON social_platform_settings;
CREATE POLICY "public_read_social_platform_settings"
  ON social_platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Update: authenticated users (demo mode uses anon, so also allow anon)
DROP POLICY IF EXISTS "write_social_platform_settings" ON social_platform_settings;
CREATE POLICY "write_social_platform_settings"
  ON social_platform_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
