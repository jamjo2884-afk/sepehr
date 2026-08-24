/*
# Add rubino and clubhouse to social_platform enum

The source Excel includes:
- روبینو (Rubino) — a separate platform from روبیکا (Rubika)
- کلاب هاوس (Clubhouse) — a separate platform from تردز (Threads)

PostgreSQL allows adding new enum values without rewriting the type.
*/

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'rubino';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'clubhouse';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
