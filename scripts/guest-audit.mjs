/**
 * Read-only audit: does the demo/guest workspace have rows in the app database?
 *
 * Safe by construction: every statement is a SELECT (counts, id/policy-name
 * level only). No writes, no tenant names or metric values printed.
 *
 * Usage:
 *   node scripts/guest-audit.mjs            # .env (reachable DB)
 *   node scripts/guest-audit.mjs .env.production
 */
import pg from 'pg';
import dotenv from 'dotenv';

const envFile = process.argv[2] ?? '.env';
dotenv.config({ path: envFile, override: true });

const GUEST_WS = 'demo-workspace-000';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`No DATABASE_URL found in ${envFile}`);
  process.exit(1);
}

const ssl =
  url.includes('localhost') || url.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false };

const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 8000 });

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function q(label, sql, params) {
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } catch (err) {
    console.log(`${label}: ERROR — ${(err.message ?? '').split('\n')[0]}`);
    return null;
  }
}

try {
  await client.connect();
  const who = await q('db', 'select current_database() as db');
  console.log(`Connected (${envFile}) → db "${who?.[0]?.db}"`);

  // 1. Workspace survey (ids + slugs only — safe, non-tenant data).
  const ws = await q('workspaces', `select id::text, name, slug from workspaces order by created_at limit 20`);
  console.log('Workspaces:', JSON.stringify(ws));
  const demoWs = ws?.find((r) => r.id === GUEST_WS || r.slug === 'demo');

  // 2. Row counts per workspace-relevant table, scoped to demo ws (or total if none).
  const uuidScoped = ['brands', 'contents'];
  const totals = ['social_accounts', 'social_metrics', 'finance_campaigns', 'finance_budgets', 'tasks', 'notifications'];
  for (const t of uuidScoped) {
    if (demoWs) {
      const rows = await q(t, `select count(*)::int as n from ${t} where workspace_id = $1::uuid`, [demoWs.id]);
      console.log(`${t} (demo ws): ${rows?.[0]?.n ?? '?'}`);
    } else {
      console.log(`${t} (no demo ws): skipped`);
    }
    const all = await q(t, `select count(*)::int as n from ${t}`);
    console.log(`${t} (total): ${all?.[0]?.n ?? '?'}`);
  }
  for (const t of totals) {
    const all = await q(t, `select count(*)::int as n from ${t}`);
    console.log(`${t} (total): ${all?.[0]?.n ?? '?'}`);
  }

  // 3. RLS posture on the live DB: does anon have any SELECT policy on tenant tables?
  const pol = await q('policies', `
    select tablename, policyname, roles
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and ('anon' = any(roles))
    order by tablename`);
  console.log('Anon-readable tables (live DB):', JSON.stringify(pol ?? []));

  console.log('--- done (read-only, nothing written)');
} finally {
  await client.end().catch(() => {});
}
