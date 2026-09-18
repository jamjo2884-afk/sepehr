/**
 * Read-only security audit: anon grants, RLS status, policies, row counts.
 * Prints catalog metadata and counts only — never row data or secrets.
 *
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/anon-exposure-audit.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await c.connect();

// 1. Every public table: RLS on? anon grant? anon SELECT policy?
const tables = await c.query(`
  SELECT c.relname,
         c.relrowsecurity AS rls,
         EXISTS (
           SELECT 1 FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = c.relname
             AND g.grantee = 'anon' AND g.privilege_type = 'SELECT'
         ) AS anon_grant,
         EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = c.relname
             AND p.cmd = 'SELECT' AND p.roles::text LIKE '%anon%'
         ) AS anon_read_policy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
`);

console.log('== ALL PUBLIC TABLES (rls | anonGrant | anonReadPolicy | name)');
for (const t of tables.rows) {
  const flag = t.rls && t.anon_grant && t.anon_read_policy ? ' <-- EXPOSED' : '';
  console.log(`   ${t.rls ? 'rls' : 'NO-RLS'} | ${t.anon_grant ? 'grant' : '-    '} | ${t.anon_read_policy ? 'policy' : '-     '} | ${t.relname}${flag}`);
}

// 2. Row counts for tables with an anon READ policy
const policyTables = tables.rows.filter((t) => t.anon_read_policy).map((t) => t.relname);
console.log(`\n== ROW COUNTS for anon-readable tables (${policyTables.length})`);
for (const name of policyTables) {
  const r = await c.query(`SELECT count(*)::int AS n FROM "${name}"`);
  console.log(`   ${name}: ${r.rows[0].n} rows`);
}

// 3. ALL policies on those tables (to know what authenticated access survives a drop)
console.log('\n== ALL POLICIES on anon-readable tables');
for (const name of policyTables) {
  const p = await c.query(
    `SELECT policyname, cmd, roles FROM pg_policies
     WHERE schemaname = 'public' AND tablename = $1 ORDER BY policyname`,
    [name],
  );
  console.log(`   ${name}:`);
  for (const row of p.rows) {
    console.log(`     ${row.policyname} ${row.cmd} TO ${String(row.roles)}`);
  }
}

// 4. The intentionally-global reference table, for the record
const sps = await c.query(
  `SELECT policyname, cmd, roles FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'social_platform_settings'
   ORDER BY policyname`,
);
console.log('\n== social_platform_settings (global reference) policies:');
for (const row of sps.rows) console.log(`   ${row.policyname} ${row.cmd} TO ${String(row.roles)}`);

await c.end();
console.log('\nAudit complete (read-only).');
