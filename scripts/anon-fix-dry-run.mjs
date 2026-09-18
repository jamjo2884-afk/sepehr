/**
 * Dry-run for 20260919130000_close_legacy_anon_read_policies.sql
 * Runs inside a transaction and ALWAYS rolls back. Simulates the `anon` and
 * `authenticated` roles via SET LOCAL ROLE to show before/after readability.
 *
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/anon-fix-dry-run.mjs
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const TABLES = [
  'activity_items', 'import_audit_log', 'import_rows', 'import_sessions',
  'social_accounts', 'social_data_quality_reviews', 'social_followers',
  'social_metric_edit_logs', 'social_metrics', 'social_sync_logs',
  'task_labels', 'tasks',
];

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function countAs(role, table) {
  try {
    await c.query(`SET LOCAL ROLE ${role}`);
    const r = await c.query(`SELECT count(*)::int AS n FROM "${table}"`);
    await c.query('RESET ROLE');
    return r.rows[0].n;
  } catch (e) {
    await c.query('RESET ROLE').catch(() => {});
    return `ERR:${e.message.slice(0, 40)}`;
  }
}

await c.connect();
await c.query('BEGIN');

const before = {};
for (const t of TABLES) before[t] = await countAs('anon', t);

await c.query(readFileSync('supabase/migrations/20260919130000_close_legacy_anon_read_policies.sql', 'utf8'));

console.log('table                          | anon BEFORE | anon AFTER | authenticated AFTER');
console.log('-------------------------------+-------------+------------+--------------------');
for (const t of TABLES) {
  const afterAnon = await countAs('anon', t);
  const afterAuth = await countAs('authenticated', t);
  console.log(
    `${t.padEnd(30)} | ${String(before[t]).padStart(11)} | ${String(afterAnon).padStart(10)} | ${String(afterAuth).padStart(18)}`,
  );
}

// Policy catalog diff
const p = await c.query(
  `SELECT tablename, count(*)::int AS n FROM pg_policies
   WHERE schemaname='public' AND tablename = ANY($1) AND 'anon' = ANY(roles)
   GROUP BY tablename`,
  [TABLES],
);
console.log(`\nanon policies remaining after fix: ${p.rows.length === 0 ? '0 (none — hole closed)' : JSON.stringify(p.rows)}`);

await c.query('ROLLBACK');
console.log('ROLLED BACK — nothing persisted.');
await c.end();
