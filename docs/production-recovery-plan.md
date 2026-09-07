# Production Recovery Plan — Media Deck Phase 23 (Control Center)

Date: 2026-09-07 · Project ref `sksbltwbbiuweqeiypyo` ("sepehr") · Repo root: `project/`
Status: **Recovery prepared — reconciliation migration written, repo changes validated (typecheck/lint/341 tests/build green). Not yet applied to Production (apply step is the user's, via SQL Editor).**

---

## 1. Goal

Bring the Production database to the schema the current Media Deck application expects
(Phase 23: brands / finance / contents / audit_logs / notifications upgrade / flow_cards
links), with zero business-data loss, no destructive DDL, no RLS weakening, and no hidden
silent failures — then prove it with a verification script before declaring success.

## 2. Hard constraints (accepted)

- No `DROP TABLE`, `TRUNCATE`, or destructive `DELETE`.
- No dropping the legacy `brand` text columns yet (services still reference them and the
  `finalize_brand_id` migration is deliberately excluded from this recovery).
- Keep all legacy column data; only *add* nullable `brand_id` / `workspace_id` columns and
  backfill deterministically.
- Idempotent, re-runnable reconciliation. Report ambiguity instead of guessing.
- Do not weaken RLS. Replace the four open permissive `notifications` policies.
- Do not rewrite working Phase 23 application features.

## 3. Evidence gathered (live, read-only)

### 3.1 From the earlier SQL inspection (user-verified)

- Present: `workspaces`, `workspace_members`, `profiles`, `notifications`, `tasks`,
  `social_accounts`, `social_metrics`, `social_sync_logs`, `social_data_quality_reviews`,
  `social_metric_edit_logs`, and the Prisma-created `flow_*` tables.
- `flow_cards` has 16 base columns only — **no** `brand_id` / `content_id`.
- `notifications` = `id text, user_id text, title, description, read, created_at` with the
  four open policies `public_read_notifications`, `client_insert_notifications`,
  `client_update_notifications`, `client_delete_notifications` (PERMISSIVE, anon+authenticated).
- Missing: `brands`, `finance_budgets`, `finance_campaigns`, `finance_expenses`,
  `finance_expense_allocations`, `contents`, `audit_logs`.

### 3.2 From read-only PostgREST probes (this environment, anon key, 2026-09-07)

| Probe | Result | Meaning |
|---|---|---|
| `notifications?select=id,user_id,read&limit=1` | 200, 3 rows (`ntf-001`…) | anon can read; open policy confirmed live |
| `notifications?select=workspace_id` | 42703 | no `workspace_id` column yet |
| `social_accounts?select=brand,platform&limit=1` | 206, range `0-0/110` | **110 accounts**, legacy `brand` text present |
| `social_accounts?select=brand_id` | 42703 ("perhaps … brand") | no `brand_id` column yet |
| `contents` / `brands` / `finance_campaigns` | PGRST205 | tables absent |
| `team_members` / `user_settings` / `social_platform_settings` | PGRST205 | tables absent |
| `flow_cards` / `flow_boards` | 42501 permission denied | **FlowBoard RLS lockdown WAS applied** (anon/authenticated revoked) |
| `workspaces` / `workspace_members` | 200, zero rows | tables exist, RLS hides them from anon |
| `tasks` | 200 | anon-readable (todo tables are public posture) |

Environment note: direct Postgres (5432/6543 TLS) is **blocked from this shell**; psql /
Supabase CLI are not installed and no access token exists. All live facts above came from
HTTPS REST. The registry / policies / helpers / workspace count still need the snapshot SQL
(`tools/production_readonly_snapshot.sql`) run by the user in Supabase SQL Editor.

## 4. Two migration tracks (do not conflate)

1. **Supabase track** — `supabase/migrations/` (32 files). Applied to prod **selectively**:
   effectively everything up to 2026-08-23/24 (tasks exist), **nothing from Aug 27–31**
   (`user_settings`, finance, team, brands, isolation, finalize — all absent), then the
   **Sep 5/6 flowboard RLS lockdown file was applied on its own** (proven by 42501 above).
2. **Prisma track** — `prisma/migrations/20260903120000_create_flowboard_tables/`
   (`flow_*` tables, applied Sep 3, owner-only DB access via `DIRECT_URL`).

The recovery therefore cannot "replay pending migrations": the pending set depends on order
(several of the pending files would fail or partially apply against today's DB, e.g. the
`brands` migration reads `finance_budgets`/`team_member_brand_allocations`, and
`workspace_isolation` `ALTER`s them).

## 5. Migration classification (repo vs live Production)

| Migration | Repo | Prod today | Verdict |
|---|---|---|---|
| `20260719…` auth/workspace foundation + RLS fix | create workspaces/members/profiles, `is_workspace_member` (DEFINER) | applied (tables exist; anon-invisible) | ✅ applied |
| `20260813…08-24` social/tasks/import/settings-era files | social + tasks etc., anon-permissive policies | applied (tasks/social/notifications anon-readable; 110 accounts) | ✅ applied |
| `20260827100000_create_user_settings` | `user_settings` | **absent** (404) | ❌ missing |
| `20260828100000_create_finance_tables` | finance cluster (brand text, public policies) | **absent** (404) | ❌ missing — **recreate in final shape, not intermediate** (see §8) |
| `20260828100000_create_social_platform_settings` | `social_platform_settings` | **absent** (404) | ❌ missing |
| `20260828110000_create_team_tables` | `team_members`, allocations (brand text) | **absent** (404) | ❌ missing — create in final shape |
| `20260828120000_security_hardening_rls` | authenticated RLS for social/team | not applied (tables absent) | ❌ missing |
| `20260828130000_create_brands_table` | `brands` + `brand_id` backfill | **absent** (404) | ❌ missing — needs finance/team tables to exist first |
| `20260829100000_workspace_isolation` | `workspace_id` + member-scoped RLS | not applied | ❌ missing (cannot run before finance/team exist) |
| `20260829110000_finalize_brand_id` | drops legacy `brand` columns | not applied | ⛔ **do not apply** (services still write `brand`) |
| `20260905120000_flowboard_rls_lockdown` | revoke flow_* from anon/auth | **applied** (42501 probe) | ✅ applied — do not re-run destructively |
| `20260907_phase23_control_center` | contents/audit_logs/notifications upgrade/flow_cards links | not applied | ❌ pending — its FK `contents.brand_id → brands(id)` was the original failure cause |

## 6. Exact dependency chain (bottom-up) for Production

```
workspaces / workspace_members / profiles            ✅ (prod)   (workspace_members = RLS backplane)
        │
set_updated_at()   +   is_workspace_member()          ? (needs snapshot 6)
        │
social_accounts (110 rows, legacy brand text)        ✅ prod  →  ADD brand_id, workspace_id (backfill)
        │
finance cluster (brand_id/workspace_id final shape)  ❌ create  (empty — no backfill risk)
team_members + allocations (brand_id shape)          ❌ create
social_platform_settings / user_settings             ❌ create (idempotent, empty)
        │
brands (seeded from social_accounts.brand + finance/team if any)   ❌ create
        │
contents (FKs: workspaces, brands, finance_campaigns) + audit_logs ❌ create
notifications upgrade (workspace_id/type/link + policy replacement)  🔒 create-columns/replace-policies
flow_cards ADD brand_id/content_id (nullable FKs, SET NULL)          ➕ add columns only
```

## 7. CRITICAL finding: the RLS / access-model conflict

The service layer reads/writes Supabase through the **anon-key client**
(`src/lib/supabase.ts` singleton, consumed by `src/lib/db.ts` → every Phase 23 service).
Route-level auth exists (`withAuth`, `src/lib/supabase-server.ts`) but is **not** the client
the services use. Consequences, verified live:

- The only prod tables the current code can actually read/write are the **anon-permissive**
  ones (social/tasks/notifications today).
- Tables with **authenticated-only member policies** (as the repo's `workspace_isolation`
  and `phase23_control_center` migrations declare) are **invisible to the anon client**:
  PostgREST denies anon → service `catch` → silent in-memory/snapshot fallback. Phase 23
  would compile, tests would pass, and the pages would still show **empty/memory data**.
- `DEMO_MODE=true` in the local `.env` (server demo mode with real Supabase configured)
  makes this worse: route auth is bypassed while DB calls still go out as anon.

**Therefore a policy choice must be made before the reconciliation is written**
(see §11 — decision needed):

- **Model A — Authenticated & workspace-scoped (secure target).** Reconcile columns/tables,
  apply member-scoped policies (`TO authenticated`, `is_workspace_member(...)`), and **refactor
  server DB access so service calls carry the user's JWT** (per-request SSR client) plus the
  browser client for client-side calls. Real multi-tenant security; requires the bigger code
  change and an end-to-end persistence test.
- **Model B — Public/anon demo posture (matches today).** Give the new/upgraded tables the
  same anon-permissive policies as the working Aug-14–23 tables so the current service layer
  persists and displays real rows with **no refactor**. Not multi-tenant safe (anyone with the
  anon key reads/writes). Contradicts the security phases unless the app is moved off public
  anon later in one coordinated change.

Phase 7/9/10/11 as written imply **Model A**. If the user picks A, the service-layer refactor
is a required part of the work (it is *not* optional polish). If B, the reconciliation keeps
the current posture and the security migration becomes a separate, later phase together with
the refactor.

## 8. Reconciliation design (draft — finalize after decisions + snapshot)

One new self-contained, idempotent migration is planned:

`supabase/migrations/20260907_production_schema_reconciliation.sql`

Content sketch (exact DDL mirrors repo files; deviations listed):

1. **Ensure helpers:** `is_workspace_member(ws_id uuid)` (SECURITY INVOKER, workspace_members
   lookup — final repo definition) and `set_updated_at()` (existing if present).
2. **Create if missing (final, app-compatible shape):**
   - `finance_budgets`, `finance_campaigns`, `finance_expenses`, `finance_expense_allocations`
     with `workspace_id uuid FK workspaces`, `brand_id uuid FK brands`, **no `brand` text
     column**, unique on `(brand_id, period, period_label)` for budgets, status enum
     `finance_campaign_status`, indexes, `updated_at` triggers.
     *Deviation note:* repo's *original* create file has `brand text NOT NULL` (intermediate
     state). Creating in final shape is intentional: prod has **zero** finance rows, and the
     app inserts `brand_id` only — a `NOT NULL brand` column would reject every insert.
   - `team_members`, `team_member_brand_allocations` with `workspace_id` + `brand_id` only
     (same reasoning; app inserts `brand_id`, not `brand`).
   - `social_platform_settings`, `user_settings` per repo (idempotent).
3. **`brands`** per repo (id/workspace_id/name/slug/status/logo_url/color, uniques). Seed
   brands from legacy strings **only if exactly one workspace exists** (else skip + report):
   `social_accounts.brand`, plus finance/team legacy sources if rows ever exist. Deterministic
   slug function, `ON CONFLICT DO NOTHING`, exact-match only; blank/ambiguous brands reported,
   never invented.
4. **`social_accounts` (existing, 110 rows):** add nullable `brand_id uuid FK brands
   ON DELETE SET NULL`, nullable `workspace_id uuid FK workspaces`, indexes; backfill
   `brand_id` from `brands.name`, backfill `workspace_id` from brands (single-workspace guard);
   relax `brand` to nullable + default `''` only if required by the chosen model; swap unique
   `(brand, platform, username)` → `(brand_id, platform, username)` **only when** the app no
   longer writes `brand` (Model A). Under Model B keep the current constraint semantics and
   keep writing `brand` alongside `brand_id`.
5. **`notifications` upgrade:** `ADD COLUMN IF NOT EXISTS workspace_id uuid`, `type text
   NOT NULL DEFAULT 'info'`, `link text`; indexes; backfill `workspace_id` **only if exactly
   one workspace** exists; **replace** the four open policies with workspace/user-scoped
   policies per the chosen model (A: authenticated, member OR own-user; B: anon read + auth
   member OR own-user). The policy `USING`/`WITH CHECK` must never be permissive through OR
   with `true`; `read` updates scoped by `workspace_id` + `user_id`.
6. **`contents` + `audit_logs`:** repo definitions with workspace-scoped RLS
   (contents delete = owner/admin), `updated_at` trigger on contents.
7. **`flow_cards`:** `ADD COLUMN IF NOT EXISTS brand_id uuid`, `content_id uuid` with FKs to
   `brands`/`contents` `ON DELETE SET NULL`, indexes. Prisma schema already declares
   `brandId`/`contentId`; no Prisma migration file is added (Supabase owns these two columns;
   a later `prisma migrate dev` diff should be no-op for them since DB+schema agree).
8. **RLS posture per chosen model** for every table above; never weaker than today; drop only
   the four open notification policies by name; leave other pre-existing policies untouched
   unless Model A is chosen (then a separate, reviewed isolation pass over existing tables —
   outside the Phase-23 recovery unless requested).
9. **No legacy `brand` column drops anywhere.** `20260829110000_finalize_brand_id` remains
   un-applied (Phase 24).

## 9. Code changes required (repo side)

- **Model A only:** rework server-side DB access to carry the authenticated session
  (per-request SSR client in services called from API routes; browser client in client code)
  and remove/adjust `isTableAvailable` silent-fallback risk with explicit observability.
- Any insert/update that writes `brand` text must be decided per model (A: remove writes;
  B: keep). Today: `finance.service.ts` `updateBudget/updateExpense/updateCampaign` write
  `brand`; `team.service.ts` allocation writes use `brand_id` only; `social-import` writes
  `brand_id` only — these drive the §8 column decisions.
- No `any`, no `@ts-ignore`; typecheck/lint/vitest (341) must stay green; CI unchanged.

## 10. Required pre-checks before writing the final migration (user action)

1. Run `tools/production_readonly_snapshot.sql` in Supabase SQL Editor and paste the output.
   It answers: migration registry contents, workspace/member counts, helper functions,
   per-table policies with roles, legacy brand duplicates/blank counts, and partial-apply
   signals (e.g. whether `social_accounts`/`notifications` have partial columns).
2. Confirm the number of workspaces (backfill guard).
3. Decide the access model (§7) — see open decisions below.

## 11. Open decisions (stop conditions)

- **D1 – Access/RLS model**: Model A (authenticated, member-scoped, + service refactor) vs
  Model B (anon public posture, no refactor). Phases 7/9/10/11 as written require A.
- **D2 – Workspace count** on Production: single (safe default backfill) vs multiple
  (backfills paused and per-workspace mapping required).
- **D3 – Scope of tightening**: notifications + newly created tables only, or also the
  existing permissive tables (social/tasks/import/settings) → Model A isolation pass.
- **D4 – User_settings / social_platform_settings**: create (they are absent; app reads them)
  — confirm no objection.

## 12. Sequence after decisions

1. User runs snapshot SQL → paste output.
2. Finalize `20260907_production_schema_reconciliation.sql` (DDL + guarded backfills +
   policy sets per model).
3. Local validation: typecheck, lint, `vitest` (341+), add reconciliation-focused unit tests
   if logic is extracted into TS; `npm run build`.
4. User applies the reconciliation file to Production (SQL Editor or `supabase db push`
   with the single file after a CLI link; **not** a blind replay of all pending files).
5. Run `tools/production_verify.sql` → all checks pass (incl. notifications NULL-workspace=0
   if single workspace, policy counts, FKs, RLS flags).
6. If Model A: commit service-layer refactor → push `origin/main` → CI green → Vercel deploy →
   Vercel redeploy (table-availability cache per serverless instance) → end-to-end persistence
   test (create content → refresh → persists; status change → notification → persists;
   command-center shows DB rows; brands/finance/social/FlowBoard pages healthy).
7. Only then report Production fixed.

## 13. Decision log & implementation (2026-09-07)

**User decisions (authoritative):**
- **D1 — Model A**: authenticated + workspace-scoped RLS for reconciled tables, and server DB
  access moved to the authenticated (cookie) client.
- **D2 — Multiple workspaces**: Production has **3 workspaces / 3 members / 3 users** → NO
  default-workspace backfill, NO guessed distribution, NO synthetic brands/workspaces/members.
  Rows without a provable mapping stay NULL and are reported.
- **D3 — Scope**: only `notifications` + the newly created tables are tightened;
  existing open tables (`social_accounts`, `tasks`, import, legacy settings-era tables)
  keep their current policies untouched for now.

**Delivered artifacts:**
- `supabase/migrations/20260907_production_schema_reconciliation.sql` — new, self-contained,
  idempotent reconciliation (Model A). Creates final-shape finance/team tables, an **empty**
  `brands` table (no seeding — mapping pending), `contents`, `audit_logs`, `user_settings`,
  `social_platform_settings`; upgrades `notifications` (columns + policy replacement); adds
  `flow_cards.brand_id/content_id`. No backfills are performed (multi-workspace rule).
  Legacy `brand` columns are preserved; `20260829110000_finalize_brand_id` is NOT applied.
- `tools/production_readonly_snapshot.sql` — read-only live snapshot (user runs first).
- `tools/production_verify.sql` — post-apply verification checks.
- `tools/brand_workspace_mapping_report.sql` — read-only mapping report + future-step template
  for the human-driven brand/workspace assignment.

**Code changes (Model A access layer, validated locally):**
- `src/lib/db.ts` — `getSupabase()` returns an authenticated client where possible: browser
  session client in the browser, cookie-backed SSR client on the server (via the registry),
  anon client only as fallback (tests/build/non-request scope).
- `src/lib/supabase-registry.ts` (new, client-safe) + `src/lib/supabase-server.ts` registers
  its factory at module load — keeps `next/headers` out of client bundles.
- `src/services/finance/finance.service.ts` — writes no legacy `brand` text column anymore;
  `brand` updates resolve to `brand_id`; inserts set `workspace_id` (from the caller's
  workspace via RLS).
- `src/services/finance/team.service.ts` — `team_members` and allocations inserts set
  `workspace_id`.
- `src/services/settings/*.ts` — DB access via `getSupabase()` (authenticated) instead of the
  bare anon client.

**Verified:** `npm run typecheck` 0 errors · `npm run lint` exit 0 · `npm test` 341/341 ·
`npm run build` succeeds.

**This supersedes the earlier sketch in §8 where relevant:** brands are NOT seeded (empty
until human mapping), and `social_accounts` is NOT altered by this reconciliation (its legacy
read path keeps working; brand_id/workspace_id + constraint swap move to the future,
mapping-driven migration sketched in the mapping-report tool).

## 14. Remaining steps (require the user's SQL Editor / deploy)

1. User runs `tools/production_readonly_snapshot.sql` (optional now — most facts confirmed),
   then `supabase/migrations/20260907_production_schema_reconciliation.sql` on Production.
2. User runs `tools/production_verify.sql` → all checks pass (notifications NULL-workspace
   count expected = 3 pre-mapping; no anon policies on the new tables; FKs present).
3. Commit + push to `origin/main` → CI green → Vercel deploy → Vercel redeploy after the DB
   migration (per-instance table cache).
4. End-to-end persistence test (create content → persists; status change → notification →
   persists; command-center/brands/finance show real DB rows for the authenticated user).
5. Manual brand/workspace mapping via `tools/brand_workspace_mapping_report.sql`, then a
   separate future migration to seed `brands` + backfill `social_accounts.brand_id`.

## 15. Remaining risks

- Migrations were applied out of band (registry may not match reality) — snapshot §1.
- Two files share the timestamp prefix `20260828100000` (finance vs social_platform_settings);
  lexicographic order applies them finance-first — fine, but do not reorder.
- RLS posture flip could silently move features to memory fallback (the §7 conflict) — must be decided, not defaulted.
- FlowBoard tables are Prisma-owned; the two new `flow_cards` columns are Supabase-owned —
  future Prisma diffs must account for them (schema.prisma already does).
- `brand` text columns must stay until Phase 24 finalize is prepared with a code sweep.
