/*
# Add missing platforms to social_platform enum

The TypeScript `SocialPlatform` type supports 15 platforms but the
Supabase enum only had 8. Six platforms used in the import pipeline
(aparat, threads, shad, igap, site, gap, virasty) caused the enum
validation to reject them, making it impossible to store or query
accounts for those platforms.

This migration adds all 7 missing values. PostgreSQL allows adding
new enum values without rewriting existing rows or indexes.
*/

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'aparat';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'threads';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'shad';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'igap';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'site';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'gap';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'virasty';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
