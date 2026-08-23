/*
# Drop Projects and Operations

These have been replaced by the Todo/Task system (tasks table).
The tasks table has a foreign key to projects, so we need to handle
that before dropping. We'll set project_id to NULL in tasks first.
*/

-- Remove project_id references from tasks (they can be standalone now)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;
UPDATE tasks SET project_id = NULL WHERE project_id IS NOT NULL;

-- Drop dependent tables first (they have FK to projects)
DROP TABLE IF EXISTS analytics_reports CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS audience_segments CASCADE;
DROP TABLE IF EXISTS knowledge_items CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS operations CASCADE;

-- Drop projects table
DROP TABLE IF EXISTS projects CASCADE;

-- Drop enums that are no longer needed
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS campaign_status CASCADE;
DROP TYPE IF EXISTS media_asset_type CASCADE;
DROP TYPE IF EXISTS operation_type CASCADE;
DROP TYPE IF EXISTS operation_status CASCADE;
DROP TYPE IF EXISTS knowledge_item_type CASCADE;

-- Clean up activity items that reference projects
DELETE FROM activity_items WHERE project_id IS NOT NULL;
ALTER TABLE activity_items DROP COLUMN IF EXISTS project_id;
