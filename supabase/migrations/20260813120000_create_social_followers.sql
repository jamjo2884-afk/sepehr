/*
# Social media follower snapshots

## Purpose
Back the social dashboard (`/social`) with real data. One row holds a single
monthly follower snapshot for one brand × platform × handle. The app fetches
all rows and rebuilds the same nested brand tree the dashboard consumes, so
no UI changes are required.

## New Table
`social_followers`
- `id` (bigint, PK)
- `brand` (text, not null) — brand / channel owner name, e.g. «کبریت»
- `platform` (text, not null) — one of the 8 supported platforms
- `handle` (text, nullable) — account handle on that platform
- `month` (text, not null) — Jalali month `YYYY-MM`, e.g. `1404-08`
- `followers` (integer, not null, >= 0) — snapshot value for that month
- `created_at` / `updated_at` (timestamptz)
- Unique on (brand, platform, handle, month)

## Security (RLS)
- SELECT is open to `anon` + `authenticated` — follower counts on this
  dashboard are public reporting data and the app reads with the anon key.
- No INSERT/UPDATE/DELETE policies are granted to anon/authenticated. Writes
  happen from the seed/import script using the service role, which bypasses
  RLS. This keeps the public read path simple without opening write access.

## Notes
- Re-running is safe: CREATE TABLE IF NOT EXISTS, policies dropped first.
*/

-- ===========================================================================
-- 1. Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_followers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand text NOT NULL,
  platform text NOT NULL CHECK (
    platform IN ('instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita', 'rubika', 'soroushplus')
  ),
  handle text,
  month text NOT NULL CHECK (month ~ '^14[0-9]{2}-(0[1-9]|1[0-2])$'),
  followers integer NOT NULL CHECK (followers >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, platform, handle, month)
);

-- ===========================================================================
-- 2. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_social_followers_brand
  ON social_followers(brand);
CREATE INDEX IF NOT EXISTS idx_social_followers_platform
  ON social_followers(platform);

-- ===========================================================================
-- 3. RLS
-- ===========================================================================
ALTER TABLE social_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_followers" ON social_followers;
CREATE POLICY "public_read_social_followers"
ON social_followers FOR SELECT
TO anon, authenticated
USING (true);

-- Writes: no anon/authenticated policies. The service role (seed/import
-- scripts) bypasses RLS and is the only write path.
