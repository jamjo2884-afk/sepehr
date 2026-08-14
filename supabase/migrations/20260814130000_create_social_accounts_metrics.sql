/*
# Social data model: accounts + metrics (normalized)

## Purpose
Separate static account info from time-series metrics so the social
architecture can grow beyond follower snapshots. `social_followers` keeps
the raw historical import untouched (it remains the source of the monthly
snapshot); the new tables become the canonical model the app reads going
forward.

## New Tables
- `social_accounts` — one row per brand × platform × username. Static info
  (display name, public URL, status) lives here, with a stable uuid PK and
  a natural UNIQUE(brand, platform, username).
- `social_metrics` — one row per account × period × period label. Holds the
  common metric set (followers … engagement_rate) plus platform-specific
  columns (story_views, channel_members, retweets, subscribers) as
  nullable bigints. `period` is an enum ('daily','weekly','monthly') and
  `period_label` is the display key ('1404-08' for the imported Jalali
  months, or an ISO date for daily/weekly going forward). Periods are
  extended by inserting new enum values — no schema rewrite.

## Migration
1. Creates enums + tables (idempotent).
2. Copies distinct (brand, platform, handle) rows into social_accounts.
3. Copies every social_followers row into social_metrics with
   period='monthly' and period_label=month (1156 rows).
4. `social_followers` is NOT dropped — the raw import stays as the audit
   trail. Rollback = drop the two new tables; data is still in
   social_followers.

## Security (RLS)
- SELECT open to `anon` + `authenticated` (public reporting data, same
  pattern as social_followers). Writes stay with the service role for now;
  narrow write policies can be added in the auth phase.
*/

-- ===========================================================================
-- 1. Enums
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE social_platform AS ENUM (
    'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
    'rubika', 'soroushplus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE social_metric_period AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE social_account_status AS ENUM ('active', 'inactive', 'archived', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. social_accounts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  platform social_platform NOT NULL,
  username text NOT NULL,
  display_name text,
  url text,
  status social_account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, platform, username)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand ON social_accounts(brand);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

-- ===========================================================================
-- 3. social_metrics
-- ===========================================================================
CREATE TABLE IF NOT EXISTS social_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  period social_metric_period NOT NULL DEFAULT 'monthly',
  period_label text NOT NULL,
  period_start date,
  period_end date,
  -- common metric set
  followers bigint NOT NULL DEFAULT 0,
  following bigint,
  posts bigint,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  reach bigint,
  impressions bigint,
  engagement_rate numeric(6, 3),
  -- platform-specific metrics (nullable)
  story_views bigint,
  channel_members bigint,
  retweets bigint,
  subscribers bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, period, period_label)
);

CREATE INDEX IF NOT EXISTS idx_social_metrics_account_id ON social_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_social_metrics_period ON social_metrics(period);

-- ===========================================================================
-- 4. RLS
-- ===========================================================================
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_accounts" ON social_accounts;
CREATE POLICY "public_read_social_accounts"
ON social_accounts FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "public_read_social_metrics" ON social_metrics;
CREATE POLICY "public_read_social_metrics"
ON social_metrics FOR SELECT
TO anon, authenticated
USING (true);

-- ===========================================================================
-- 5. Migrate data from social_followers (safe to re-run)
-- ===========================================================================

-- Accounts: distinct brand × platform × handle.
INSERT INTO social_accounts (brand, platform, username, display_name, url)
SELECT
  f.brand,
  f.platform::social_platform,
  COALESCE(f.handle, ''),
  MAX(f.handle),
  NULL
FROM social_followers f
GROUP BY f.brand, f.platform, COALESCE(f.handle, '')
ON CONFLICT (brand, platform, username) DO NOTHING;

-- Metrics: one row per follower snapshot, monthly period.
INSERT INTO social_metrics (
  account_id, period, period_label, followers
)
SELECT
  a.id,
  'monthly',
  f.month,
  f.followers
FROM social_followers f
JOIN social_accounts a
  ON a.brand = f.brand
 AND a.platform = f.platform::social_platform
 AND a.username = COALESCE(f.handle, '')
ON CONFLICT (account_id, period, period_label) DO NOTHING;

-- ===========================================================================
-- 6. updated_at trigger (same helper as the business schema)
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

DROP TRIGGER IF EXISTS trg_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER trg_social_accounts_updated_at
BEFORE UPDATE ON social_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_social_metrics_updated_at ON social_metrics;
CREATE TRIGGER trg_social_metrics_updated_at
BEFORE UPDATE ON social_metrics
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
