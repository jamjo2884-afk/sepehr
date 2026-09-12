# Media Deck — Project PRD & Technical Baseline

> **Status:** Source of Truth (project-level) · **Last updated:** 2026-09-12 · **Branch:** `main`
>
> This document is the Project PRD + Technical Project Charter + Current Architecture Baseline + Production Status for **Media Deck** (repository `jamjo2884-afk/sepehr`).
>
> ⚠️ **Precedence rule:** if this document ever disagrees with the actual repository state (code, Prisma schema, migrations, or production state), **the repository and production reality win** — see [Source of Truth Policy](#source-of-truth-policy).

---

## 1. Identity

| Item | Value |
|---|---|
| Product name | **Media Deck** |
| Technical / repository name | **Sepehr** |
| GitHub repository | `jamjo2884-afk/sepehr` |
| Primary branch | `main` |
| **Project Root (authoritative, single)** | `D:\New folder\project-bolt-sb1-pshfm5bv\project` |
| Production URL | `https://sepehr-phi.vercel.app` |
| Vercel project | `sepehr` |
| Current baseline commit | `afc4d60` |
| Current production deployment | `dpl_7mLWkzipAftLM3RoBHHEStsTPU9Y` (`sepehr-4ftorjkb3`) |

**Project Root policy:** `D:\New folder\project-bolt-sb1-pshfm5bv\project` is the **only** authoritative Project Root — it is simultaneously the repository working root and the application root. All internal paths in this document (`src/`, `prisma/`, `supabase/`, `package.json`, `.github/`, …) are **relative to this Project Root** and do not constitute independent project roots. No other root path is valid.

---

## 2. Product Vision

Media Deck is a **Media Operations Platform** — a management and operations platform for a portfolio of media brands. It is explicitly **not** a statistics dashboard: its goal is to combine the operational management of the following domains in one central workspace:

- Brands
- Social Media
- Content
- Campaigns
- Finance
- Tasks (FlowBoard)
- Team Operations
- Notifications
- Performance
- Intelligence
- Audit Logs
- Command Center

### 2.1 Target audience

- Holding manager (مدیر هلدینگ)
- Media manager (مدیر رسانه)
- Editor-in-chief / Editor (سردبیر)
- Content production team
- Operations team
- Campaign manager
- Finance manager

### 2.2 UI language & design baseline

- **Persian (fa)** UI, **RTL** layout
- **Dark theme** default (light theme toggle available in header)
- **Jalali (Persian) calendar** dates (`jalaali-js`, `react-day-picker`)
- Vazirmatn typeface, shadcn/ui component system, Tailwind CSS

---

## 3. Media Brands

The platform currently manages these brands (rows in the `brands` table):

1. جنگ با آرزوها
2. دیده‌بان دولت
3. رهبر سوم
4. روشنگری
5. سینه‌فیلیا
6. صد درجه
7. فصل 11
8. کبریت
9. کف خیابون
10. مردمک
11. نسیم آنلاین

**Architecture requirement:** adding a new brand must not require architectural change. Brands are data (rows), not code. All brand-related features (Content, Campaign, Task, Social, Finance, Performance) reference brands via `brand_id` foreign keys.

---

## 4. Social Platforms

The system is designed to manage these platforms (stored in a Postgres enum, extended over time by migrations such as `20260823100000_add_missing_platforms_to_enum.sql` and `20260824110000_add_facebook_to_enum.sql`):

- Instagram, Telegram, YouTube, X
- Bale, Eitaa, Rubika, Soroush Plus
- (also present in enum: Aparat, Facebook, Threads, Shad, iGap, Site, Gap, Virasty, Rubino, Clubhouse)

**Current strategy: Import-first.** Direct social connectors are *not* the priority in the current phase. Manual data entry and file import (XLSX-based, with preview → review → anomaly detection → commit workflow) are the valid, supported paths. Direct connectors and scheduled sync are future work (see [Roadmap Phase E](#phase-e--automation-planned)).

---

## 5. Tech Stack (verified against `package.json` at the Project Root)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.15 |
| UI library | React | 18.3.1 |
| Language | TypeScript | ^5.5.3 |
| Styling | Tailwind CSS | ^3.4.6 |
| Components | shadcn/ui (Radix primitives) | Radix ^1.x |
| Backend-as-a-Service | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | ^0.12.5 / ^2.45.0 |
| Database | PostgreSQL (Supabase) | — |
| ORM | Prisma + `@prisma/adapter-pg` | ^7.10.0 |
| State | Zustand, TanStack Query | ^4.5.4 / ^5.51.0 |
| Forms | react-hook-form + zod | ^7.52.0 / ^3.23.0 |
| Charts | Recharts | ^2.12.7 |
| Spreadsheets | xlsx | ^0.18.5 |
| Dates | jalaali-js, react-day-picker | ^2.0.0 / ^8.10.1 |
| Tests | Vitest (unit), Playwright (E2E) | ^4.1.10 / ^1.62.1 |
| Hosting | Vercel | — |
| CI | GitHub Actions | — |

Scripts (`package.json`): `build` = `prisma generate && next build`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `lint` = `next lint`, `test:e2e` = `playwright test`.

---

## 6. Database

- **Primary database:** Supabase PostgreSQL (`aws-0-ap-southeast-2.pooler.supabase.com`, Session Pooler, db `postgres`).
- **Single database for everything:** Media Deck (Supabase-managed tables) and FlowBoard (Prisma-managed `flow_*` tables) share the **same** database. FlowBoard has **no separate database**, by design.
- **Cardinal rule:** no feature may Reset, Drop, Truncate, or destroy existing data. Migrations are **versioned** and **non-destructive** (additive columns, `IF NOT EXISTS` / `IF EXISTS` patterns, policy replacement only).
- Migration locations:
  - `supabase/migrations/*.sql` — Media Deck tables (33 migrations, e.g. `20260719155903_create_auth_workspace_foundation.sql`, `20260828120000_security_hardening_rls.sql`, `20260829100000_workspace_isolation.sql`, `20260907_phase23_control_center.sql`, `20260907_production_schema_reconciliation.sql`)
  - `prisma/migrations/` — FlowBoard tables (`20260903120000_create_flowboard_tables`)

### 6.1 Key tables (Media Deck side)

- **Auth/workspace:** `profiles`, `workspaces`, `workspace_members` (+ `is_workspace_member()` SQL helper)
- **Brands:** `brands` (with `brand_id` referenced across the platform)
- **Social:** `social_accounts`, `social_metrics`, `social_followers`, `social_platform_settings`, `social_data_quality_reviews`, `social_metric_edit_logs`, import review tables
- **Content:** `contents` (Phase 23)
- **Finance:** `finance_campaigns`, finance budget/expense/team tables (created by `20260828100000_create_finance_tables.sql`, `20260828110000_create_team_tables.sql`)
- **Platform ops:** `notifications`, `audit_logs` (Phase 23), `user_settings`
- **FlowBoard (Prisma):** `flow_users`, `flow_workspaces`, `flow_workspace_members`, `flow_boards`, `flow_board_members`, `flow_lists`, `flow_cards`, `flow_card_members`, `flow_card_watchers`, `flow_labels`, `flow_board_labels`, `flow_card_labels`, `flow_checklists`, `flow_checklist_items`, `flow_comments`, `flow_attachments`, `flow_activities`, `flow_automation_rules`, `flow_board_templates`, `flow_card_templates`

---

## 7. Prisma

- **Version:** Prisma 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`)
- **Schema:** `prisma/schema.prisma` — generator `prisma-client`, output `../src/generated/prisma`, preview features `queryCompiler` + `driverAdapters`
- **Config:** `prisma.config.ts` loads `DATABASE_URL` via `dotenv/config` for CLI operations
- **Client instantiation:** `src/lib/flowboard/db.ts` — singleton `PrismaClient` with the **`PrismaPg` driver adapter** (`connectionString: process.env.DATABASE_URL`, `ssl: { rejectUnauthorized: false }`), dev-mode global caching

### 7.1 Architecture Decision — why PrismaPg (Wasm) and not the native engine

The original architecture used Prisma's **native query engine binary** (`rhel-openssl-3.0.x`). On Vercel Lambda, the 17MB `libquery_engine-rhel-openssl-3.0.x.so.node` was not reliably bundled into serverless output, producing `PrismaClientInitializationError: Query Engine not found` on every FlowBoard route (see [Incident 1](#incident-1--prisma-query-engine-not-found)).

**Decision (commit `5e422d0`):** migrate to **Prisma 7 + driver adapters**. The `queryCompiler` preview feature uses a Wasm query compiler with **no platform-specific binary**, and `@prisma/adapter-pg` connects through the `pg` npm library. This eliminated the engine-bundling failure class entirely.

Consequences worth remembering:
- TLS handling is delegated to `pg` → its `Object.assign({}, config, parse(connectionString))` merge means URL `sslmode=` params **override** any `ssl` object passed in code (see [Incident 4](#incident-4--tls-p1011)).
- `ssl: { rejectUnauthorized: false }` is set in `db.ts` as defense-in-depth, but the URL `sslmode=no-verify` is the authoritative setting in Production.

---

## 8. Workspace Architecture

The platform is **workspace-aware**. Every business row carries a `workspace_id` and all reads/writes are scoped to the caller's workspace.

### 8.1 Core entities

- `workspaces`
- `workspace_members` (`user_id`, `workspace_id`, `role`: owner / admin / member / viewer)
- `profiles` (per-user profile data)

### 8.2 Server-side helpers (verified real implementations)

| Helper | File | Purpose |
|---|---|---|
| `getAuthUser()` / `isDemoMode()` | `src/lib/auth.ts` | Resolve current Supabase session user; demo-mode detection |
| `getCurrentWorkspace()` | `src/lib/workspace.ts` | Resolve `{ userId, workspaceId, role }` from `workspace_members` (demo mode → synthetic `demo-workspace-000`) |
| `requireWorkspace()` | `src/lib/workspace.ts` | `getCurrentWorkspace()` + 403 NextResponse on failure |
| `isOwnedByWorkspace(recordWorkspaceId)` | `src/lib/workspace.ts` | IDOR guard — verifies a record belongs to caller's workspace |
| `withAuth(handler)` | `src/lib/route-auth.ts` | API route wrapper: 401 without session, 403 without workspace membership, injects `{ user, workspace }` |
| `requireAuth(handler)` | `src/lib/route-auth.ts` | Auth-only wrapper (no workspace requirement) |
| `requireRole(...roles)` | `src/lib/route-auth.ts` | Narrows `withAuth` by workspace role (server-enforced) |
| `is_workspace_member()` | SQL function (migration `20260829100000_workspace_isolation.sql`) | Database-level membership check used inside RLS policies |

FlowBoard has its **own parallel auth adapter** (`src/lib/flowboard/auth.ts`) bridging Media Deck auth to Prisma: `getCurrentUser()`, `requireAuth()`, `requireWorkspaceMember()`, `requireWorkspaceAdmin()`, `requireWorkspaceOwner()`, `requireBoardAccess()` — enforcing workspace and board membership server-side on every `flow_*` route.

---

## 9. Modules

> Status values: **Production Ready** (in production, verified working) · **Operational** (working, actively used) · **In Development** · **Partial** (exists with gaps) · **Planned** (not yet built)

### 9.1 Dashboard / Command Center — **Operational**

- **Purpose:** central executive view — brand performance, team workload, content status, scheduled content, notifications, campaigns, finance, operational alerts. Real aggregates only; honest zeros when there is no data (no mock fallback).
- **UI:** `/command-center`
- **API:** `GET /api/command-center` (via `withAuth`), plus `GET /api/team/workload`
- **Data:** `command-center.service.ts`, `team-workload.service.ts` — aggregates Brands, Content, FlowBoard tasks, Finance, Notifications, Audit
- **Tables:** reads across `brands`, `contents`, `flow_cards`, finance tables, `notifications`, `audit_logs`
- **Links to:** every module (aggregator)
- **Limitations:** read-only aggregation; no user-configurable widgets yet
- **Next:** alert rules, brand comparison views (Phase C refinement)

### 9.2 Brands — **Operational**

- **Purpose:** manage media brands as first-class entities; anchor for Content/Campaign/Task/Social/Finance/Performance.
- **UI:** `/brands`
- **API:** `GET/POST /api/brands`, `GET/PATCH /api/brands/[id]`, `GET /api/brands/summary`, `GET /api/brands/[id]/performance`
- **Tables:** `brands` (with soft-delete), `social_accounts.brand_id`, `contents.brand_id`, `flow_cards.brand_id`, finance tables `brand_id`
- **Status:** CRUD + soft-delete + summary + per-brand performance implemented; brand color system centralized
- **Limitations:** no brand-level settings page beyond basics
- **Next:** brand-level goals/targets

### 9.3 Social — **Operational (import-first)**

- **Purpose:** manage social accounts and per-period metrics; data quality review; bulk edit; import review center.
- **UI:** `/social` (+ account detail pages, audience, analytics dashboards), import review center
- **API:** `GET /api/social/analytics`, `/api/social/brand/[brand]`, `/api/social/data-quality/*`, `/api/social/import/*` (template, upload, preview, review sessions: validate/commit/rows/candidates/resolve/reject/anomalies), `/api/social/metrics/*` (bulk-edit, per-metric), `/api/social/sync/*` (overview, sync, sync/all)
- **Tables:** `social_accounts`, `social_metrics`, `social_followers`, `social_platform_settings`, `social_data_quality_reviews`, `social_metric_edit_logs`, import review session tables — all under workspace RLS
- **Status:** import pipeline (XLSX upload → preview → validation → anomaly detection → resolution → commit) is real and working; metric editing with edit logs; data quality scoring; sync infrastructure exists (service + endpoints) but no live connectors are enabled
- **Limitations:** direct platform connectors not implemented (intentional — see §4); sync currently relies on import/manual data
- **Next:** real connectors + scheduled sync (Phase E)

### 9.4 Content — **Operational**

- **Purpose:** content workflow entity with a real lifecycle: `draft → review → approved → scheduled → published` (+ terminal `rejected / cancelled / failed`).
- **UI:** `/content`
- **API:** `GET/POST /api/content`, `GET/PATCH/DELETE /api/content/[id]`, `POST /api/content/[id]/status`, `GET /api/content/[id]/tasks`, `GET /api/content/tasks-count`
- **Tables:** `contents` (brand_id → brands, campaign_id → finance_campaigns, created_by, workspace_id, schedule/publication fields)
- **Relations:** Brand ↔ Content ↔ Campaign ↔ Task (via FlowBoard `flow_cards.content_id`)
- **Status:** Phase 24 completed the operational workflow integration (Brand → Content → Task → Campaign → Cost); demo-persistence isolation fixed
- **Limitations:** no approval routing UI beyond status changes
- **Next:** editorial calendar improvements, publication tracking to social accounts

### 9.5 Campaigns — **Operational (as Finance Campaigns)**

- **Purpose:** campaigns are **finance campaigns** — a campaign's budget/expenses live in Finance, and Content links to campaigns via `contents.campaign_id → finance_campaigns.id`.
- **UI:** `/campaigns` (views backed by finance campaign data)
- **API:** `GET/POST /api/finance/campaigns`, `GET/PATCH /api/finance/campaigns/[id]`
- **Tables:** `finance_campaigns` (relations: Brand, Content, Budget, Expense, Allocation, Performance)
- **Status:** CRUD operational; content-campaign link live
- **Limitations:** no campaign-level performance dashboard beyond Finance analytics
- **Next:** campaign performance rollups (Phase C/D)

### 9.6 Finance — **Operational**

- **Purpose:** budgets, expenses, campaign finance, allocations, team/human costs.
- **UI:** `/finance`
- **API:** `/api/finance/analytics`, `/api/finance/budgets` (+ `[id]`), `/api/finance/campaigns` (+ `[id]`), `/api/finance/expenses` (+ `[id]`), `/api/finance/overview`, `/api/finance/team` (+ `[id]`)
- **Services:** `src/services/finance/` — `finance.service.ts`, `finance-analytics.service.ts`, `finance-validation.ts`, `team.service.ts`, `team-analytics.service.ts`, `team-validation.ts`
- **Tables:** finance tables from `20260828100000_create_finance_tables.sql` + `20260828110000_create_team_tables.sql`; **`Expense → Brand`** and **`Expense → Campaign`** relations exist (via `brand_id` / campaign linkage; Intelligence consumes them)
- **Status:** CRUD + analytics + team costs operational
- **Limitations:** no invoice/receipt attachments; allocation model minimal
- **Next:** cost allocation depth, forecasting

### 9.7 Tasks / FlowBoard — **Production Ready**

- **Purpose:** Trello-style operations management (boards, lists, cards) with full workspace + board-level authorization.
- **UI:** `/tasks` (redirect) → `/tasks/boards`, `/tasks/boards/[id]`, `/tasks/calendar`, `/tasks/table`, `/tasks/dashboard`, `/tasks/my-work`, `/tasks/templates`
- **API (48 routes under `/api/flowboard/*`):** auth session, workspaces (+ members, boards, archived, import, cards), boards (+ lists, cards, labels, export, archived), boards-list, cards (+ move, copy, archive, members, labels, checklists, comments, attachments, template, bulk), checklists (+ items), checklist-items, comments, lists (+ archive), search, users/me/cards, card-templates (+ use)
- **Schema:** 20 `flow_*` tables via Prisma (§6.1)
- **Implemented & working:** workspaces, boards, lists, cards, members, labels, checklists, comments, attachments, activity log, archive/restore (boards, lists, cards), copy, move, calendar view, table view, dashboard/my-work, board & card templates, bulk operations, export, search, card watchers, automation rules schema (minimal)
- **Integration:** `flow_cards.brand_id` and `flow_cards.content_id` (nullable, plain scalars, FKs `ON DELETE SET NULL`) — verified in `prisma/schema.prisma`. **No join table** is used for Task↔Brand/Content; direct nullable columns are the architecture. Deleting a brand or content never deletes a task.
- **Limitations:** automation rules are schema-only (no engine); watchers stored but no notification wiring beyond card-member assignment notifications
- **Security:** RLS lockdown on all `flow_*` tables (§10)

### 9.8 Notifications — **Operational**

- **Purpose:** real in-app notification center (mock data fully removed).
- **UI:** `/notifications` + header notification bell
- **API:** `GET /api/notifications` (list + unread count), `POST /api/notifications/read`
- **Table:** `notifications` — non-destructively upgraded by `20260907_phase23_control_center.sql` (added `workspace_id`, `type`, `link`; backfilled workspace; replaced open anon policies with workspace-scoped ones)
- **Service:** `notification.service.ts` — `createNotification`, `getNotifications`, `getUnreadCount`, `markRead`, `markAllRead`; demo-mode in-memory fallback; workspace-scoped
- **Real events currently wired:** FlowBoard card member assignment (creates a notification with a deep link `/tasks/boards/[boardId]?card=[id]`)
- **Limitations:** only one producer wired so far
- **Next:** wire notifications into more events (Phase B/E)

### 9.9 Audit Logs — **Operational**

- **Purpose:** operational audit trail — actor, action, entity, timestamp, minimal before/after diff. **Never** stores tokens, passwords, secrets, cookies, credentials (redaction is defense-in-depth in code *and* by contract).
- **Table:** `audit_logs` (Phase 23)
- **Service:** `audit.service.ts` — `recordAudit` (never throws — audit failure never breaks the primary operation), `sanitizeAuditMetadata` (redacts sensitive keys + token-looking values, caps value length/depth), `getAuditLogs`; demo-mode in-memory ring buffer
- **Producers:** content service writes audit events; pattern available for all modules
- **Limitations:** not every module emits audit events yet
- **Next:** broader event coverage

### 9.10 Intelligence — **Operational (v1)**

- **Purpose:** cross-domain analytics combining Finance + Social + Team costs into brand-level ROI/efficiency metrics.
- **UI:** `/intelligence`
- **API:** `GET /api/intelligence` (via `withAuth`)
- **Consumes:** expenses, budgets, human/team costs by brand, social accounts + monthly metrics (follower counts over time)
- **Output:** per-brand `BrandIntelligence` — totalSpend, totalBudget, budgetUtilization, totalFollowers, followerGrowth, growthRate, costPerFollower, costPerNewFollower, operationalCost, humanCost, totalCost — sorted by cost efficiency
- **Planned (not yet built):** trend analysis, anomaly detection, recommendations engine

### 9.11 Other areas — **Partial / Planned**

| Area | UI | Status | Notes |
|---|---|---|---|
| Assets | `/assets` + API | Partial | basic asset listing; deeper integration planned |
| Audience | `/audience` | Partial | audience views on social data |
| Analytics | `/analytics` | Operational | social-focused analytics dashboards |
| Campaigns (dedicated UI) | `/campaigns` | Partial | finance-backed views; richer campaign management planned |
| Distribution | `/distribution` | Planned | placeholder feature area |
| Automation | `/automation` | Planned | placeholder; FlowBoard automation rules schema exists |
| Knowledge | `/knowledge` | Planned | placeholder |
| Settings | `/settings` + API | Operational | user settings persisted in Supabase; social platform enable/disable |
| Profile | `/profile` + API | Operational | account settings |
| Auth pages | `/login`, `/register`, `/forgot-password`, `/reset-password` | Operational | Supabase SSR auth (`@supabase/ssr`), demo-mode fallback for unconfigured envs |
| ERP/Demo placeholders | `src/features/{projects,operations,mock-data,…}` | Legacy | older todo-era feature folders; superseded by FlowBoard |

---

## 10. FlowBoard Security (RLS Lockdown)

Migration `supabase/migrations/20260905120000_flowboard_rls_lockdown.sql` (verified):

- **Problem it solves:** `flow_*` tables were created via Prisma and therefore had **no Row Level Security** — any client holding the public anon key could read/modify every workspace's data through Supabase REST (PostgREST), bypassing all application authorization.
- **Mechanism (owner-safe lockdown):**
  1. `ENABLE ROW LEVEL SECURITY` on **all 20** `flow_*` tables — with no policies, PostgREST-facing roles (`anon`, `authenticated`) are denied every row.
  2. `REVOKE ALL` on those tables from `anon` and `authenticated` — the REST surface itself is closed.
- **Why no `FORCE ROW LEVEL SECURITY`:** FlowBoard accesses the DB exclusively server-side through Prisma as the table owner (`postgres` role via `DATABASE_URL`); owners bypass RLS by default, which is exactly what Prisma needs. FORCE would break FlowBoard's own access.
- **Properties:** idempotent, non-destructive.
- Media Deck tables use the complementary pattern: `is_workspace_member()`-based RLS policies (migration `20260829100000_workspace_isolation.sql`, hardened by `20260828120000_security_hardening_rls.sql`).

---

## 11. Production Architecture

- **Hosting:** Vercel (Hobby plan, region `iad1` — Washington D.C. East)
- **Project:** `sepehr` (org `jamjo2884-afks-projects`, project id `prj_mnl22GIkrqRfaRVRwppnQeClOAEu`)
- **Production alias:** `https://sepehr-phi.vercel.app` (also `sepehr-jamjo2884-afks-projects.vercel.app`)
- **Build:** Vercel runs `npm run build` → `prisma generate && next build` (Prisma config loaded from `prisma.config.ts`)
- **Environment variables (Production):** `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all stored as Secrets; never committed to the repo, never printed in logs or docs)
- **Runtime model:** Next.js App Router serverless functions; FlowBoard Prisma client runs server-side only (never exposed to browser)
- **Middleware:** `src/middleware.ts` — Supabase SSR session refresh + route guarding

---

## 12. CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`, verified):

- **Triggers:** push + PR to `main`; concurrency cancels superseded runs
- **Steps:** `actions/checkout@v4` → `setup-node@v4` (Node 20, npm cache) → **`npm ci`** → **`npx prisma generate`** (before checks because typecheck/lint/tests import the generated client) → **`npm run typecheck`** → **`npm run lint`** → **`npm test`** (Vitest, 23 files / 341 tests as of baseline)

Production deployment is performed via the Vercel CLI/Git integration (`vercel --prod`). Playwright E2E (`test:e2e`) exists but is **not** in CI yet.

---

## 13. Production Incident History

A permanent record of the production stabilization chain (Sept 2026). Each incident's root cause is **proven from production logs**, not guessed.

### Incident 1 — Prisma Query Engine not found

- **Error:** `PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"` (searched `/var/task/.next/server/chunks`, `src/generated`, `.prisma/client`, `/tmp/prisma-engines`) → Node process `exit status: 128`, all FlowBoard API routes crashed.
- **Root cause:** Vercel serverless bundling did not include the 17MB native engine binary (`libquery_engine-rhel-openssl-3.0.x.so.node`) that Prisma's native runtime requires.
- **Fix:** commit `5e422d0` — upgrade **Prisma 6.19.3 → 7.10.0**, adopt the **Wasm query compiler** (`queryCompiler` + `driverAdapters` preview features) with **`@prisma/adapter-pg`**, remove `binaryTargets`/`outputFileTracingIncludes`. No native binary needed at all.

### Incident 2 — Database authentication failed (P1000)

- **Error:** `P1000: Authentication failed against the database server, the provided database credentials for 'postgres' are not valid` in `prisma.flowUser.findUnique()` (`clientVersion: '7.10.0'` — confirming Incident 1's fix was live).
- **Root cause:** stale/incorrect `DATABASE_URL` credential in Vercel Production (last updated 4 days before the incident).
- **Fix:** corrected the Production environment variable in Vercel (value never displayed; structure verified as `postgresql://postgres.<project-ref>:****@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require`) + production redeploy.

### Incident 3 — DATABASE_URL newline corruption (P1001)

- **Error:** `P1001: Can't reach database server at base` — note the nonsensical host **"base"**, and the `vercel env update` CLI warning `! Value contains newlines`.
- **Root cause:** the environment-variable update flow introduced a corrupted value (newlines), so `pg`/PrismaPg parsed a garbage hostname.
- **Fix:** `vercel env rm DATABASE_URL production` then re-`add` the clean value via stdin (128 bytes, verified zero `0x0A`/`0x0D` bytes) + redeploy. Local `pg.Pool` test confirmed the clean URL executed a real query successfully.

### Incident 4 — TLS (P1011)

- **Error:** `P1011: Error opening a TLS connection: self-signed certificate in certificate chain` (`driverAdapterError: TlsConnectionError`) at `flowUser.findUnique() → PrismaPg → pg.Pool → TLS handshake`.
- **Root cause (proven by local reproduction):** `@prisma/adapter-pg` passes its config straight to `new pg.Pool(config)`, and `pg`'s `ConnectionParameters` merges with **`Object.assign({}, config, parse(config.connectionString))`** — so the URL's **`sslmode=require`** (which parses to a truthy `ssl: {}` with strict verification semantics) **overwrites** the `ssl: { rejectUnauthorized: false }` object set in `db.ts`. Supabase Pooler presents a certificate chain under a private CA not in Node's default trust store → strict verification rejects it.
- **Local proof:** with `sslmode=no-verify` in the URL, `parse()` yields `{ rejectUnauthorized: false }` which survives the merge; a real `pg.Pool` query against Supabase returned `{"current_user":"postgres","current_database":"postgres"}`.
- **Fix:** swap only the query param in the Production `DATABASE_URL`: **`sslmode=require` → `sslmode=no-verify`** (username/password/host/port/database untouched) + production redeploy. `ssl: { rejectUnauthorized: false }` remains in `db.ts` as defense-in-depth for URLs without a `sslmode` param.

### Final Production Fix & Deployment (baseline)

- **Commit:** `afc4d60` — `fix(flowboard): disable TLS certificate verification for Supabase Session Pooler` (single line added to `src/lib/flowboard/db.ts`)
- **Deployment:** `dpl_7mLWkzipAftLM3RoBHHEStsTPU9Y` (`https://sepehr-4ftorjkb3-...vercel.app`), aliased to `sepehr-phi.vercel.app`, **Ready**
- **DATABASE_URL:** corrected as described above; **no secret values are recorded anywhere in this document**

### Final Verification — FlowBoard Production **FINAL PASS** ✅

| Check | Result |
|---|---|
| Authenticated `GET /api/flowboard/auth/session` | **PASS** |
| Authenticated `GET /api/flowboard/boards-list` | **PASS** |
| `/tasks/boards` page | **PASS** |
| Board operations (open board, card ops) | **PASS** |
| Real PostgreSQL query execution | **PASS** |
| Authentication | **PASS** |
| Database connectivity | **PASS** |
| Prisma runtime (7.10.0 + PrismaPg) | **PASS** |
| Production deployment | **PASS** (Ready + aliased) |

---

## 14. Current Status Matrix

> Extracted from the repository, not guessed.

| Module | Status |
|---|---|
| Auth (Supabase SSR + demo fallback) | Production Ready |
| Workspace Architecture (workspace resolver, helpers) | Production Ready |
| FlowBoard (Tasks) — core + security | **Production Ready** (FINAL PASS) |
| Brands | Operational |
| Social (import-first: metrics, import review, data quality, bulk edit) | Operational |
| Content (Phase 23/24 workflow) | Operational |
| Campaigns (Finance Campaigns) | Operational |
| Finance (budgets/expenses/team/analytics) | Operational |
| Notifications (real API/UI, workspace-scoped) | Operational |
| Audit Logs (redaction + non-throwing writes) | Operational |
| Command Center (real KPI aggregation) | Operational |
| Intelligence (v1 cross-domain ROI) | Operational |
| Analytics / Audience dashboards | Operational |
| Settings & Profile | Operational |
| Assets | Partial |
| Campaigns dedicated UI | Partial |
| Automation rules (FlowBoard engine) | Planned |
| Social direct connectors & scheduled sync | Planned |
| Distribution | Planned |
| Knowledge | Planned |
| Intelligence v2 (trends, anomalies, recommendations) | Planned |

---

## 15. Architecture Decision Records

1. **ADR-001 — Prisma 7 + PrismaPg (Wasm query compiler).** Native query engine binaries are unreliable on Vercel Lambda. Driver adapters remove the binary entirely. Consequence: TLS is handled by `pg`, whose connection-string merge overrides code-level `ssl` objects — URL `sslmode` is authoritative.
2. **ADR-002 — Supabase PostgreSQL as the single database.** One database for Media Deck and FlowBoard; no parallel database, ever.
3. **ADR-003 — Workspace isolation.** Every business row carries `workspace_id`; all APIs resolve the caller's workspace server-side (`withAuth` → `getCurrentWorkspace`) and filter by it.
4. **ADR-004 — RLS everywhere.** Media Deck tables use `is_workspace_member()` policies; FlowBoard tables use owner-safe RLS lockdown + REST privilege revocation. Database-level security is a core layer, not an optional extra.
5. **ADR-005 — FlowBoard inside the same database.** FlowBoard's Prisma-managed `flow_*` tables live in the shared Supabase database; Prisma connects as owner, bypassing RLS (deliberately, without FORCE).
6. **ADR-006 — Content as an independent entity.** `contents` has its own lifecycle (draft → review → approved → scheduled → published) and links to brands and campaigns; it is not a sub-resource of either.
7. **ADR-007 — Campaigns as Finance Campaigns.** Campaign budget/expenses belong to Finance (`finance_campaigns`); Content references campaigns via `campaign_id`. No duplicate campaign system.
8. **ADR-008 — Task↔Business links are direct columns.** `flow_cards.brand_id` and `flow_cards.content_id` are nullable plain scalars with `ON DELETE SET NULL`. **No join tables** for these relations.
9. **ADR-009 — Social is Import-first.** Manual entry and XLSX import (with review/anomaly/commit pipeline) are the supported data paths; direct connectors are deferred.
10. **ADR-010 — Vercel Production.** Serverless hosting, production alias `sepehr-phi.vercel.app`, environment variables as Vercel Secrets.
11. **ADR-011 — Non-destructive database migrations.** Versioned, additive, idempotent migrations only; no resets/truncates/drops of business data in any environment.

---

## 16. Security

- **Authentication:** Supabase SSR (`@supabase/ssr`) with cookie-based sessions; middleware refreshes sessions; demo mode only when Supabase is unconfigured (never in Production).
- **Authorization:** every API route wrapped in `requireAuth` / `withAuth` / `requireRole`; FlowBoard routes additionally enforce workspace/board membership via `requireWorkspaceMember` / `requireBoardAccess`. The UI is never trusted.
- **Workspace isolation:** enforced at application layer (workspace context in every query) **and** database layer (RLS).
- **RLS:** enabled on all business tables and all `flow_*` tables; PostgREST surface for `flow_*` is revoked from `anon`/`authenticated` entirely.
- **Server-side checks:** all privileged operations run in API routes/services; the browser only ever talks to our API routes.
- **Secrets hygiene:** no secrets in the repo (`.env*` gitignored); no secrets in documentation; no secrets printed in logs (`audit.service.ts` redacts sensitive keys/token-shaped values before persisting; connector services sanitize error messages).
- **Environment variables:** managed in Vercel (Secrets) and local `.env` (never committed).
- **Audit logging:** operational events recorded per workspace with redaction-by-default.
- **Rate limiting:** `src/lib/rate-limit.ts` applied to sensitive routes (e.g., social sync).

---

## 17. Development Rules

1. **Check the repository first** before any architectural change — this document may lag reality.
2. **Check the Prisma schema and migrations before writing a migration** — avoid conflicting with existing columns/policies.
3. **Never reset the database in Production.** No `prisma migrate reset`, no truncate/drop of business data, anywhere.
4. **Every new feature must be workspace-aware** — resolve `workspaceId` server-side and scope all reads/writes.
5. **Every API endpoint must have authorization** — use `withAuth` / `requireAuth` / `requireRole` (or FlowBoard's auth adapters). No bare route handlers touching data.
6. **Add RLS when tables are introduced** — new tables get workspace-scoped policies (or the FlowBoard owner-safe lockdown pattern for Prisma-owned tables).
7. **Run the full gate before every commit:** `npm run typecheck` && `npm run lint` && `npm test` && `npm run build` (build includes `prisma generate`).
8. **Run a production smoke test after significant changes** — at minimum: authenticated `GET /api/flowboard/auth/session`, `/tasks/boards`, one board operation; check Vercel runtime logs for error-level entries.
9. **Keep commits atomic** — no unrelated changes in the same commit.
10. **Do not duplicate architecture** — reuse `getCurrentWorkspace`, `withAuth`, the audit/notification services, and existing helpers instead of writing parallel ones.
11. **Never print secrets** — not in documentation, not in chat, not in logs. Redact by default.

---

## 18. Definition of Done (per feature)

- [ ] **UI** implemented (Persian, RTL, dark-theme compatible, Jalali dates where applicable)
- [ ] **API** implemented with authorization wrapper
- [ ] **Database** schema complete (tables/columns/indexes)
- [ ] **Migration** written — versioned, non-destructive, idempotent
- [ ] **Authorization** enforced server-side (auth + role checks where needed)
- [ ] **Workspace isolation** — all queries scoped to the caller's workspace
- [ ] **RLS** policies added/updated
- [ ] **Typecheck** passes (`npm run typecheck`)
- [ ] **Lint** passes (`npm run lint`)
- [ ] **Tests** pass (`npm test`)
- [ ] **Build** succeeds (`npm run build`)
- [ ] **Production deployment** completed and aliased
- [ ] **Smoke test** executed against Production (authenticated endpoints + error-log check)

---

## 19. Roadmap

### Phase A — Production Stabilization ✅ **Completed** (Sept 2026)

Prisma 7 + PrismaPg migration, `DATABASE_URL` restoration, newline-corruption fix, TLS fix. FlowBoard Production **FINAL PASS**. (See §13.)

### Phase B — Operational Core *(current focus)*

Deepen and complete the operational modules: **Content** (publication tracking, approval flow), **Tasks/FlowBoard** (wire more notification producers, automation rule engine), **Brands** (goals/targets), **Campaign** (performance rollups), **Finance** (allocations depth, forecasting), **Notifications** (broader event coverage), **Audit** (coverage across all modules).

### Phase C — Command Center

Executive dashboard refinement: **brand comparison**, **team workload** expansion, **upcoming content** timeline, **operational alerts** (threshold-based, workspace-scoped).

### Phase D — Intelligence

Trend analysis, performance analysis over time, **anomaly detection**, and a **recommendations** engine building on the existing `BrandIntelligence` pipeline.

### Phase E — Automation

**Social connectors** (direct platform APIs), **scheduled sync** (cron-driven sync/all), **automated reports**, **automated notifications**. Builds on the existing sync infrastructure (`social-sync.service.ts`, `/api/social/sync/*`).

---

## 20. Source of Truth Policy

`PROJECT-PRD.md` is the project-level reference document (PRD + charter + architecture baseline + production status).

**However:** if this document conflicts with the actual repository — code, Prisma schema, migrations, CI configuration, or live production state — then **the actual code, schema, migrations, and production reality take precedence over this document**, always.

- Every significant architectural change must be recorded here **afterwards** (new ADR, updated status matrix, updated baseline commit/deployment).
- The status matrix (§14) and incident history (§13) must be refreshed when production reality changes.
- This document contains **no secrets** — connection strings, tokens, passwords, and cookies must never be added here.

---

*Baseline captured at commit `afc4d60`, deployment `dpl_7mLWkzipAftLM3RoBHHEStsTPU9Y`, 2026-09-12.*
