/*
# Add facebook to social_platform enum

The source Excel includes Facebook (فیسبوک) as a platform.
PostgreSQL allows adding new enum values without rewriting the type.
*/

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'facebook';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
