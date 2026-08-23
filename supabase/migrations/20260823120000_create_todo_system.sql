/*
# Todo/Task Management System

Combines Projects + Operations into a single, powerful task system
inspired by Todoist, Linear, and Things 3.

## Features:
- Tasks with subtasks (parent_id)
- Priority levels (none, low, medium, high, urgent)
- Status workflow (backlog → todo → in_progress → done/cancelled)
- Labels/Tags
- Due dates (shamsi calendar)
- Sort order for manual ordering
- Projects as containers (optional - tasks can be standalone)

## Design Inspiration:
- Todoist: Projects, Labels, Priority, Quick Add
- Linear: Cycles, Sub-issues, Estimates
- Things 3: Areas, Headings, Today/Upcoming views
*/

-- ===========================================================================
-- 1. Enums
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. Labels table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS task_labels (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 3. Tasks table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  parent_id text REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'none',
  due_date text,  -- shamsi date string like '1405-05-31'
  labels text[] NOT NULL DEFAULT '{}',
  assignee_id text,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 4. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_labels ON tasks USING GIN(labels);

-- ===========================================================================
-- 5. RLS
-- ===========================================================================
ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['task_labels', 'tasks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "public_read_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "client_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "client_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ===========================================================================
-- 6. updated_at triggers
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===========================================================================
-- 7. Seed default labels
-- ===========================================================================
INSERT INTO task_labels (id, name, color) VALUES
  ('lbl-urgent', 'فوری', '#ef4444'),
  ('lbl-review', 'نیاز به بررسی', '#f59e0b'),
  ('lbl-content', 'محتوا', '#3b82f6'),
  ('lbl-design', 'طراحی', '#8b5cf6'),
  ('lbl-dev', 'توسعه', '#10b981'),
  ('lbl-social', 'شبکه اجتماعی', '#ec4899'),
  ('lbl-meeting', 'جلسه', '#6366f1'),
  ('lbl-research', 'تحقیق', '#14b8a6')
ON CONFLICT (name) DO NOTHING;
