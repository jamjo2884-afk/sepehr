/**
 * Focused check for the invite-link origin fix.
 *
 * Creates a REAL invitation through the HTTP route as a real owner and prints
 * only the resulting host (never the token), so the link's domain can be
 * confirmed without exposing the secret.
 *
 * Reads APP_ORIGIN from the environment: that is the value injected as
 * NEXT_PUBLIC_APP_URL into the dev server under test, so this exercises the
 * same code path production will use.
 *
 * Cleans up every account, workspace and invitation it creates.
 */

import fs from 'fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

function envFile(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...envFile('.env.local'), ...envFile('.env') };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3100';
// What the dev server under test was started with as NEXT_PUBLIC_APP_URL.
const APP_ORIGIN = process.env.APP_ORIGIN || '';

let base = env.DATABASE_URL || env.POSTGRES_URL || env.DIRECT_URL;
base = base.replace(/\?sslmode=[^&]*/, '');
const db = new pg.Client({
  connectionString: base + (base.includes('?') ? '&' : '?') + 'sslmode=no-verify',
});

const stamp = Date.now();
const ownerEmail = `linkcheck-${stamp}@example.com`;
const password = `Link-${stamp}-Aa1!`;
const inviteEmail = `linktarget-${stamp}@example.com`;

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

await db.connect();

try {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signUp, error: signUpErr } = await anon.auth.signUp({
    email: ownerEmail,
    password,
  });
  if (signUpErr) throw new Error(`signUp: ${signUpErr.message}`);
  const ownerId = signUp.user?.id;
  if (!ownerId) throw new Error('signUp returned no user');

  // The handle_new_user trigger provisions the owner's own workspace.
  const ws = await db.query(
    'select id from workspace_members where user_id = $1 limit 1',
    [ownerId],
  );
  const workspaceId = ws.rows[0]?.id;
  if (!workspaceId) throw new Error('trigger did not provision a workspace');

  const jar = {};
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar[name] = value;
      },
    },
  });
  const { error: signInErr } = await ssr.auth.signInWithPassword({
    email: ownerEmail,
    password,
  });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);
  const cookie = Object.entries(jar)
    .filter(([name]) => !name.includes('code-verifier'))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const res = await fetch(`${APP_URL}/api/workspace/invitations`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inviteEmail, role: 'member' }),
  });
  const body = await res.json().catch(() => null);

  console.log(`\n  POST /api/workspace/invitations -> ${res.status}`);

  if (APP_ORIGIN === '') {
    // Misconfigured mode: NEXT_PUBLIC_APP_URL is absent, so the service must
    // refuse loudly instead of emitting a link that goes nowhere.
    check('refuses with 501 not_configured', res.status === 501, `status=${res.status}`);
    check(
      'error names the missing variable',
      body?.errorCode === 'not_configured',
      `errorCode=${body?.errorCode}`,
    );
    const orphan = await db.query(
      'select count(*)::int as n from workspace_invitations where email = $1',
      [inviteEmail],
    );
    check(
      'no orphan invitation row was created',
      orphan.rows[0].n === 0,
      `rows=${orphan.rows[0].n}`,
    );
    console.log('\n=== RESULT: misconfigured mode behaves correctly ===');
    if (fail > 0) process.exitCode = 1;
  } else {
    check('invitation created', res.status === 201, `status=${res.status}`);

    const acceptUrl = body?.invitation?.acceptUrl ?? '';
    const host = acceptUrl ? new URL(acceptUrl).host : '(none)';

    check('acceptUrl is present and absolute', acceptUrl.startsWith('http'), acceptUrl);
    check(
      'acceptUrl host equals configured APP_ORIGIN',
      APP_ORIGIN !== '' && acceptUrl.startsWith(APP_ORIGIN),
      `APP_ORIGIN=${APP_ORIGIN} acceptUrl=${acceptUrl}`,
    );
    check(
      'acceptUrl host is NOT the serving dev host',
      acceptUrl !== `${APP_URL}/invite/anything`,
      `serving host=${APP_URL}`,
    );
    check(
      'path is /invite/<token>',
      /\/invite\/[A-Za-z0-9_-]{20,}$/.test(new URL(acceptUrl).pathname),
      acceptUrl,
    );

    // The list must hand back the same origin, since that is what the pending
    // invitation copy button uses.
    const listRes = await fetch(`${APP_URL}/api/workspace/invitations`, {
      headers: { Cookie: cookie },
    });
    const listBody = await listRes.json().catch(() => null);
    const listed = (listBody?.invitations ?? []).find((i) => i.email === inviteEmail);
    check(
      'pending invitation in the list uses the same host',
      listed?.acceptUrl && new URL(listed.acceptUrl).host === host,
      `listed=${listed?.acceptUrl}`,
    );

    console.log(`\n  GENERATED INVITE LINK`);
    console.log(`    host : ${host}`);
    console.log(`    path : ${new URL(acceptUrl).pathname.replace(/[^/]+$/, '<token>')}`);
    console.log(`    email: ${inviteEmail}`);

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    if (fail > 0) process.exitCode = 1;
  }
} finally {
  // Leave the database exactly as we found it.
  await db.query('delete from workspace_invitations where email = $1', [inviteEmail]);
  const owned = await db.query(
    `select wm.workspace_id from workspace_members wm
     join auth.users u on u.id = wm.user_id
     where u.email = $1`,
    [ownerEmail],
  );
  for (const row of owned.rows) {
    await db.query('delete from permission_audit where workspace_id = $1', [row.workspace_id]);
    await db.query('delete from workspace_members where workspace_id = $1', [row.workspace_id]);
    await db.query('delete from workspaces where id = $1', [row.workspace_id]);
  }
  await db.query(
    'delete from profiles where id in (select id from auth.users where email = $1)',
    [ownerEmail],
  );
  await db.query('delete from auth.users where email = $1', [ownerEmail]);
  console.log('  cleaned up test account, workspace and invitation');
  await db.end();
}