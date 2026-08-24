/*
# Complete social data wipe

Truncates ALL social-related tables to start fresh.
Order matters: child tables first, then parents.

Tables wiped:
  1. social_data_quality_reviews
  2. social_metric_edit_logs
  3. social_metrics (cascades from social_accounts)
  4. social_sync_logs
  5. social_accounts
  6. social_followers
  7. import_audit_log
  8. import_rows
  9. import_sessions
*/

-- Disable triggers for speed
ALTER TABLE social_metrics DISABLE TRIGGER ALL;
ALTER TABLE social_accounts DISABLE TRIGGER ALL;

-- 1. Child tables first
TRUNCATE social_data_quality_reviews CASCADE;
TRUNCATE social_metric_edit_logs CASCADE;

-- 2. Metrics (has FK to social_accounts)
TRUNCATE social_metrics RESTART IDENTITY CASCADE;

-- 3. Sync logs
TRUNCATE social_sync_logs CASCADE;

-- 4. Accounts (parent)
TRUNCATE social_accounts CASCADE;

-- 5. Legacy raw import
TRUNCATE social_followers RESTART IDENTITY CASCADE;

-- 6. Import review center
TRUNCATE import_audit_log CASCADE;
TRUNCATE import_rows CASCADE;
TRUNCATE import_sessions CASCADE;

-- Re-enable triggers
ALTER TABLE social_metrics ENABLE TRIGGER ALL;
ALTER TABLE social_accounts ENABLE TRIGGER ALL;
