/*
# Finance Module — Budgets, Expenses, Allocations, Campaigns

## Purpose
Track brand-level budgets, expenses (with platform allocations), and
campaigns. Connects to social_metrics for growth analytics — but never
stores follower counts or growth rates itself.

## Tables
1. `finance_budgets` — per-brand, per-period budget targets
2. `finance_expenses` — individual expense records
3. `finance_expense_allocations` — per-platform distribution of an expense
4. `finance_campaigns` — campaign records linked to brands

## Security (RLS)
- Public read/write for the demo workspace (same pattern as social/todo).
- In production, restrict by workspace_id when multi-tenant auth is ready.
*/

-- ===========================================================================
-- 1. Enums
-- ===========================================================================
DO $$ BEGIN
  CREATE TYPE finance_campaign_status AS ENUM ('planned', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================
-- 2. Budgets
-- ===========================================================================
CREATE TABLE IF NOT EXISTS finance_budgets (
  id            text PRIMARY KEY,
  brand         text NOT NULL,
  period        text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  period_label  text NOT NULL,
  amount        numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, period, period_label)
);

-- ===========================================================================
-- 3. Campaigns
-- ===========================================================================
CREATE TABLE IF NOT EXISTS finance_campaigns (
  id            text PRIMARY KEY,
  brand         text NOT NULL,
  name          text NOT NULL,
  start_date    text NOT NULL,
  end_date      text,
  budget        numeric(18,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  status        finance_campaign_status NOT NULL DEFAULT 'planned',
  description   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 4. Expenses
-- ===========================================================================
CREATE TABLE IF NOT EXISTS finance_expenses (
  id            text PRIMARY KEY,
  brand         text NOT NULL,
  expense_date  text NOT NULL,
  amount        numeric(18,2) NOT NULL CHECK (amount > 0),
  category      text NOT NULL DEFAULT 'other',
  campaign_id   text REFERENCES finance_campaigns(id) ON DELETE SET NULL,
  description   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 5. Expense Allocations (platform distribution)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS finance_expense_allocations (
  id                text PRIMARY KEY,
  expense_id        text NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  platform          text NOT NULL,
  social_account_id text,
  amount            numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  percentage        numeric(6,3),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 6. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_finance_budgets_brand ON finance_budgets(brand);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_period ON finance_budgets(period, period_label);

CREATE INDEX IF NOT EXISTS idx_finance_campaigns_brand ON finance_campaigns(brand);
CREATE INDEX IF NOT EXISTS idx_finance_campaigns_status ON finance_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_brand ON finance_expenses(brand);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_campaign ON finance_expenses(campaign_id);

CREATE INDEX IF NOT EXISTS idx_finance_allocations_expense ON finance_expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_finance_allocations_platform ON finance_expense_allocations(platform);

-- ===========================================================================
-- 7. RLS
-- ===========================================================================
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expense_allocations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_budgets', 'finance_campaigns', 'finance_expenses', 'finance_expense_allocations'] LOOP
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
-- 8. updated_at triggers
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_finance_budgets_updated_at ON finance_budgets;
CREATE TRIGGER trg_finance_budgets_updated_at BEFORE UPDATE ON finance_budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_campaigns_updated_at ON finance_campaigns;
CREATE TRIGGER trg_finance_campaigns_updated_at BEFORE UPDATE ON finance_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_expenses_updated_at ON finance_expenses;
CREATE TRIGGER trg_finance_expenses_updated_at BEFORE UPDATE ON finance_expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
