begin;

-- ============================================================
-- Phase Finance 2: Team & Human Resource Cost
-- ============================================================

-- Team Members
create table if not exists team_members (
  id            text primary key,
  name          text not null,
  employment_type text not null check (employment_type in ('full_time','part_time','project','intern')),
  monthly_cost  numeric not null check (monthly_cost >= 0),
  start_date    date not null default current_date,
  end_date      date,
  status        text not null default 'active' check (status in ('active','inactive')),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Team Member Brand Allocations
create table if not exists team_member_brand_allocations (
  id                     text primary key,
  team_member_id         text not null references team_members(id) on delete cascade,
  brand                  text not null,
  allocation_percentage  numeric not null check (allocation_percentage >= 0 and allocation_percentage <= 100),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique(team_member_id, brand)
);

-- Indexes
create index if not exists idx_team_members_status on team_members(status);
create index if not exists idx_team_members_start_date on team_members(start_date);
create index if not exists idx_team_allocations_member on team_member_brand_allocations(team_member_id);
create index if not exists idx_team_allocations_brand on team_member_brand_allocations(brand);

-- RLS
alter table team_members enable row level security;
alter table team_member_brand_allocations enable row level security;

-- Public read/write (matches Finance 1 pattern for demo mode)
create policy "team_members_select" on team_members for select using (true);
create policy "team_members_insert" on team_members for insert with check (true);
create policy "team_members_update" on team_members for update using (true);
create policy "team_members_delete" on team_members for delete using (true);

create policy "team_allocations_select" on team_member_brand_allocations for select using (true);
create policy "team_allocations_insert" on team_member_brand_allocations for insert with check (true);
create policy "team_allocations_update" on team_member_brand_allocations for update using (true);
create policy "team_allocations_delete" on team_member_brand_allocations for delete using (true);

-- Updated_at trigger
create or replace function update_team_members_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger team_members_updated_at
  before update on team_members
  for each row execute function update_team_members_updated_at();

create trigger team_allocations_updated_at
  before update on team_member_brand_allocations
  for each row execute function update_team_members_updated_at();

commit;
