/*
  Add color and category columns to tasks table.
  - color: hex color string for visual identification
  - category: grouping category for organizing tasks
*/

-- Add color column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color text;

-- Add category column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text;

-- Create index for category-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- Create index for color-based queries (for grouping)
CREATE INDEX IF NOT EXISTS idx_tasks_color ON tasks(color);
