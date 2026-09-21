/**
 * Apply the guest-mode app_settings migration (idempotent, additive).
 *
 * Usage: node scripts/guest-mode-apply-migration.mjs
 * (Connection string comes from DATABASE_URL in .env; SSL is no-verify to
 * work around pg v9 verify-full aliasing on Supabase endpoints.)
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATION =
  'supabase/migrations/20260921120000_guest_mode_app_settings.sql';

const connectionString = `${process.env.DATABASE_URL}${
  process.env.DATABASE_URL.includes('?') ? '&' : '?'
}sslmode=no-verify`;

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const before = await client.query(
    "SELECT to_regclass('public.app_settings') AS t",
  );
  console.log('app_settings before:', before.rows[0].t ?? '(missing)');

  const sql = readFileSync(MIGRATION, 'utf8');
  await client.query(sql);
  console.log('Migration applied OK.');

  const after = await client.query(
    'SELECT guest_mode_enabled, changed_at FROM app_settings WHERE id = 1',
  );
  console.log('Singleton row:', JSON.stringify(after.rows[0]));
} catch (err) {
  console.error('MIGRATION FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
