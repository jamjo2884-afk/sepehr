/**
 * Guest seed dry-run: executes the seed migration inside a transaction and
 * ALWAYS rolls back. Prints the row counts that WOULD exist. No data is
 * persisted. Read-only from the database's point of view.
 *
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/guest-seed-dry-run.mjs
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const GUEST_UUID = 'deb00d00-0000-4000-8000-deb00d000001';
const migrationPath = 'supabase/migrations/20260919120010_guest_mode_seed.sql';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query('BEGIN');
  const sql = readFileSync(migrationPath, 'utf8');
  await client.query(sql);

  const counts = {};
  for (const [label, q] of Object.entries({
    workspaces: `SELECT count(*)::int AS n FROM workspaces WHERE id = '${GUEST_UUID}'::uuid`,
    brands: `SELECT count(*)::int AS n FROM brands WHERE workspace_id = '${GUEST_UUID}'::uuid`,
    contents: `SELECT count(*)::int AS n FROM contents WHERE workspace_id = '${GUEST_UUID}'::uuid`,
  })) {
    const r = await client.query(q);
    counts[label] = r.rows[0].n;
  }
  console.log('DRY-RUN OK — rows that WOULD exist in the guest workspace:');
  console.log(JSON.stringify(counts, null, 2));

  const sample = await client.query(
    `SELECT b.name, b.status, count(c.id)::int AS contents
     FROM brands b LEFT JOIN contents c ON c.brand_id = b.id
     WHERE b.workspace_id = '${GUEST_UUID}'::uuid
     GROUP BY b.id, b.name, b.status ORDER BY b.name LIMIT 10`,
  );
  console.log('Sample brands:', sample.rows.map(r => `${r.name}(${r.status},${r.contents})`).join(' | '));
} finally {
  await client.query('ROLLBACK');
  console.log('ROLLED BACK — nothing persisted.');
  await client.end();
}
