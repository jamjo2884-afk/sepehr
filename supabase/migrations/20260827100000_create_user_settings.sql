/*
# User Settings

## Purpose
Persist per-user settings (workspace name, theme, timezone, etc.) in the
database. Each authenticated user gets exactly one row.

## New Tables
1. `user_settings`
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → auth.users, UNIQUE, cascade delete)
   - `workspace_name` (text, not null, default 'Media Deck')
   - `timezone` (text, not null, default 'Asia/Tehran')
   - `date_format` (text, not null, default 'jalali')
   - `theme` (text, not null, default 'dark')
   - `density` (text, not null, default 'comfortable')
   - `notifications` (jsonb, not null, default '{}')
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())

## Security (RLS)
- Users can SELECT/INSERT/UPDATE only their own row.
- DELETE is not allowed (settings are never deleted, only updated).

## Notes
- `updated_at` is auto-set via a trigger.
- The table is idempotent (IF NOT EXISTS).
*/

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_name text NOT NULL DEFAULT 'Media Deck',
  timezone      text NOT NULL DEFAULT 'Asia/Tehran',
  date_format   text NOT NULL DEFAULT 'jalali' CHECK (date_format IN ('jalali', 'gregorian', 'auto')),
  theme         text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  density       text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  notifications jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. Auto-update updated_at
-- ===========================================================================
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- ===========================================================================
-- 3. Index
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);

-- ===========================================================================
-- 4. Row-Level Security
-- ===========================================================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings
DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own settings
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy — settings are never deleted
