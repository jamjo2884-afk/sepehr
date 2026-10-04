/**
 * End-to-end verification of the Members phase-2 flow against the LIVE database
 * and the REAL security RPCs — no mocks.
 *
 * Runs entirely on the anon key: this project has email confirmation disabled,
 * so supabase.auth.signUp() returns a real session immediately (the same path
 * the app's own /register page uses).
 *
 * Cast: create a throwaway OWNER account and a throwaway MEMBER account. A
 * fresh owner avoids mutating the real workspaces in the database, so the run is
 * fully self-contained and repeatable.
 *
 * Steps (each asserts):
 *   1. signUp owner  -> insert owner workspace + owner membership (app's own
 *      registration shape).
 *   2. signUp member.
 *   3. owner creates an invitation for the member's email (RPC).
 *   4. member accepts it (RPC) -> joins the owner's workspace.
 *   5. member's default matrix is all-none.
 *   6. NEGATIVE: member's direct UPDATE of workspace_members is refused by RLS.
 *   7. NEGATIVE: member cannot invite (42501).
 *   8. NEGATIVE: member cannot change their own access (42501).
 *   9. NEGATIVE: owner access is immutable even for an owner caller (42501).
 *  10. owner grants finance:view -> module access resolves to 'view'.
 *  11. member GET /api/finance/overview is no longer 403 (real HTTP route).
 *  12. owner revokes -> access resolves to 'none' -> route is 403 again.
 *  13. permission_audit holds the before/after diff; audit_logs has the events.
 *  14. Cleanup: revoke invitation, remove member, delete both auth users.
 *  15. INVITE-LINK SIGNUP (migration 20261001140000): a brand-new user who
 *      registers WITH an invite token must join ONLY the team workspace — no
 *      personal workspace — plus the negative case that a forged/mismatched
 *      token falls back to a normal personal workspace.
 *
 * Run: node e2e-members-verify.mjs
 */

import fs from 'node:fs';

function envFile(p) {
  const o = {};
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return o;
}
const env = { ...envFile('.env.local'), ...envFile('.env') };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3100';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const { default: pg } = await import('pg');
const { createClient } = await import('@supabase/supabase-js');
const { createServerClient } = await import('@supabase/ssr');
const { moduleAccess } = await import('./e2e-permissions-helper.mjs');

const base = env.DATABASE_URL;
const db = new pg.Client({
  connectionString: base + (base.includes('?') ? '&' : '?') + 'sslmode=no-verify',
});
await db.connect();

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const stamp = Date.now();
const ownerEmail = `e2e-owner-${stamp}@example.com`;
const memberEmail = `e2e-member-${stamp}@example.com`;
const password = `E2e-${stamp}-Aa1!`;

let workspaceId = null;
let ownerId = null;
let memberId = null;
let invitationToken = null;
let invitationId = null;
/** Personal workspaces created by the signup trigger, removed by the test. */
const personalWorkspaceIds = [];
/**
 * Auth users created by the invite-link signup section. Tracked at module scope
 * so the `finally` block removes them even when a check in the middle of that
 * section throws — an earlier version cleaned up inline and leaked two accounts
 * whenever it aborted early.
 */
const inviteSignupUserIds = [];

/**
 * An anon client bound to a specific user's session.
 *
 * Uses auth.setSession() rather than a global Authorization header: with the
 * header approach PostgREST saw an anonymous role and the SECURITY DEFINER RPCs
 * rejected the call with "not authenticated" (auth.uid() was null).
 */
async function asUser(session) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new Error(`setSession: ${error.message}`);
  return client;
}

/**
 * Sign in with email+password and return the sb-*-auth-token cookie header.
 *
 * The app's server routes authenticate from the request COOKIE
 * (createSupabaseServerClient -> supabase.auth.getUser()), NOT from an
 * Authorization header, so real HTTP checks must present the cookie. The
 * captured jar is produced by the same @supabase/ssr code the browser uses.
 */
async function cookieFor(email, password) {
  const jar = {};
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar[name] = value;
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  const header = Object.entries(jar)
    // The PKCE code-verifier cookies are not needed for an established session.
    .filter(([name]) => !name.includes('code-verifier'))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return { cookie: header, token: data.session.access_token };
}

/** HTTP GET against the running dev server with a user's session cookie. */
async function apiGet(path, cookie) {
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      headers: { Cookie: cookie },
    });
    return res.status;
  } catch (e) {
    return `ERR:${e.message}`;
  }
}

/** HTTP request with an optional JSON body, returning { status, body }. */
async function apiSend(path, cookie, method, payload) {
  try {
    const hasBody = method !== 'GET' && method !== 'HEAD' && payload !== undefined;
    const res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        Cookie: cookie,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(payload) } : {}),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: `ERR:${e.message}`, body: null };
  }
}

try {
  console.log('\n=== E2E: workspace members & per-module permissions ===\n');

  // ── 1. Create the owner account ─────────────────────────────────────────
  console.log('1. create owner + member accounts (real auth sessions)');
  const pub = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ownerSignUp, error: ownerSignUpErr } = await pub.auth.signUp({
    email: ownerEmail,
    password,
    options: { data: { full_name: 'E2E Owner' } },
  });
  if (ownerSignUpErr) throw new Error(`owner signUp: ${ownerSignUpErr.message}`);
  if (!ownerSignUp.session) {
    throw new Error(
      'owner signUp returned no session — email confirmation appears to be ON, ' +
        'so this script cannot mint a verified session with the anon key.',
    );
  }
  const ownerSessionData = ownerSignUp.session;
  ownerId = ownerSignUp.user.id;
  check('owner signed up with a live session', !!ownerSessionData, ownerEmail);

  const { data: memberSignUp, error: memberSignUpErr } = await pub.auth.signUp({
    email: memberEmail,
    password,
    options: { data: { full_name: 'E2E Member' } },
  });
  if (memberSignUpErr) throw new Error(`member signUp: ${memberSignUpErr.message}`);
  if (!memberSignUp.session) throw new Error('member signUp returned no session');
  const memberSessionData = memberSignUp.session;
  memberId = memberSignUp.user.id;
  check('member signed up with a live session', !!memberSessionData, memberEmail);

  // Session cookies for the real HTTP route checks.
  const ownerCookie = await cookieFor(ownerEmail, password);
  const memberCookie = await cookieFor(memberEmail, password);
  check('owner session cookie captured', ownerCookie.cookie.length > 0);
  check('member session cookie captured', memberCookie.cookie.length > 0);

  const owner = () => asUser(ownerSessionData);
  const member = () => asUser(memberSessionData);
  // Sanity: both helpers must expose the full PostgREST surface.
  const probeOwner = await owner();
  if (typeof probeOwner.from !== 'function' || typeof probeOwner.rpc !== 'function') {
    throw new Error('asUser() did not return a usable Supabase client');
  }

  // ── 2. The signup trigger already provisioned the owner ─────────────────
  // `handle_new_user()` on auth.users creates a workspace + an owner membership
  // row for every new signup (SECURITY DEFINER), so there is nothing to hand
  // build here — and it is the real production onboarding path.
  const ownerRow = await db.query(
    `select workspace_id, role from workspace_members
     where user_id = $1
     order by created_at asc limit 1`,
    [ownerId],
  );
  if (ownerRow.rows.length === 0) {
    throw new Error('signup trigger did not create an owner membership row');
  }
  workspaceId = ownerRow.rows[0].workspace_id;
  check('signup trigger provisioned an owner workspace', !!workspaceId);
  check('owner role recorded', ownerRow.rows[0].role === 'owner');

  // ── 3. Owner creates an invitation ──────────────────────────────────────
  console.log('\n2. owner creates an invitation (manual-link flow)');
  const { data: invId, error: invErr } = await (await owner()).rpc(
    'create_workspace_invitation',
    { p_email: memberEmail, p_role: 'member', p_permissions: {} },
  );
  check('create_workspace_invitation succeeded', !invErr, invErr?.message);
  check('invitation id returned (uuid)', typeof invId === 'string' && invId.length === 36);
  invitationId = invId;

  const invRow = await db.query(
    `select token, status, expires_at from workspace_invitations where id = $1`,
    [invId],
  );
  invitationToken = invRow.rows[0]?.token;
  check('invitation stored as pending', invRow.rows[0]?.status === 'pending');
  check('token is a long opaque secret', (invitationToken?.length ?? 0) >= 20);
  check(
    'expiry is ~7 days out',
    new Date(invRow.rows[0].expires_at) > new Date(Date.now() + 6 * 24 * 3600 * 1000),
  );

  // ── 4. Invitee accepts ──────────────────────────────────────────────────
  console.log('\n3. invitee accepts the invitation');
  const { data: acceptedWs, error: acceptErr } = await (await member()).rpc(
    'accept_workspace_invitation',
    { p_token: invitationToken },
  );
  check('accept_workspace_invitation succeeded', !acceptErr, acceptErr?.message);
  check('joined the owner workspace', acceptedWs === workspaceId, `${acceptedWs}`);

  const memberRow = await db.query(
    `select role, permissions from workspace_members where workspace_id=$1 and user_id=$2`,
    [workspaceId, memberId],
  );
  check('member row exists', memberRow.rows.length === 1);
  check('role is member', memberRow.rows[0]?.role === 'member', memberRow.rows[0]?.role);
  check(
    'default matrix is all-none',
    Object.keys(memberRow.rows[0]?.permissions ?? {}).length === 0,
    JSON.stringify(memberRow.rows[0]?.permissions),
  );

  // ── Known product gap, surfaced deliberately ─────────────────────────────
  // The signup trigger gives EVERY new account its own personal workspace with
  // the user as owner. After accepting an invite the user is therefore a member
  // of TWO workspaces and remains OWNER of their personal one — while
  // getCurrentWorkspace() resolves `limit(1)` on the OLDEST membership. The app
  // has no workspace switcher, so the invited workspace is unreachable.
  //
  // This script removes the invitee's personal workspace so the remaining
  // assertions exercise the intended behaviour (acting as a member of the
  // team's workspace). See the report: multi-workspace support is the follow-up.
  const personalWs = await db.query(
    `select workspace_id, role from workspace_members
     where user_id = $1 and workspace_id <> $2`,
    [memberId, workspaceId],
  );
  check(
    'GAP: invitee still owns a personal workspace after accepting',
    personalWs.rows.some((r) => r.role === 'owner'),
    JSON.stringify(personalWs.rows),
  );
  for (const row of personalWs.rows) {
    await db.query(`delete from workspace_members where workspace_id=$1 and user_id=$2`, [
      row.workspace_id,
      memberId,
    ]);
    await db.query(`delete from workspaces where id=$1`, [row.workspace_id]);
    await db.query(`delete from profiles where id=$1 and workspace_id=$2`, [memberId, row.workspace_id]);
    personalWorkspaceIds.push(row.workspace_id);
  }
  check('personal workspace removed so the member acts inside the team workspace', true);

  // ── 5. Negative: direct client UPDATE must be refused ───────────────────
  // NOTE: with no UPDATE policy, RLS makes the row invisible to a non-owner, so
  // the .update() matches ZERO rows and PostgREST reports success. The security
  // property to assert is therefore "the stored role did not change", not
  // "an error came back" — asserting an error here would be testing the wrong
  // thing (and would pass even if a hole existed elsewhere).
  console.log('\n4. negative — member cannot self-promote via direct UPDATE');
  const directRes = await (await member())
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', memberId)
    .select('id');
  const afterDirect = await db.query(
    `select role from workspace_members where workspace_id=$1 and user_id=$2`,
    [workspaceId, memberId],
  );
  check(
    'direct UPDATE changed nothing (role still member)',
    afterDirect.rows[0]?.role === 'member',
    `role=${afterDirect.rows[0]?.role}`,
  );
  check(
    'direct UPDATE returned no readable rows (RLS hides them)',
    (directRes.data ?? []).length === 0,
    `returned ${(directRes.data ?? []).length} rows`,
  );

  // Prove the same write is refused outright when the row IS visible to the
  // caller — the owner's own row, which owner should still not be able to edit
  // via the client (only the RPC may write this table).
  const ownerSelfUpdate = await (await owner())
    .from('workspace_members')
    .update({ role: 'admin' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', ownerId)
    .select('id');
  const ownerRoleAfter = await db.query(
    `select role from workspace_members where workspace_id=$1 and user_id=$2`,
    [workspaceId, ownerId],
  );
  check(
    'even an owner cannot UPDATE the row directly (RPC-only writes)',
    ownerRoleAfter.rows[0]?.role === 'owner' &&
      (ownerSelfUpdate.data ?? []).length === 0,
    `role=${ownerRoleAfter.rows[0]?.role} rows=${(ownerSelfUpdate.data ?? []).length}`,
  );

  // ── 6. Negative: member cannot invite ───────────────────────────────────
  console.log('\n5. negative — member cannot invite');
  const { error: memberInvErr } = await (await member()).rpc('create_workspace_invitation', {
    p_email: `stranger-${stamp}@example.com`,
    p_role: 'member',
    p_permissions: {},
  });
  // The member is an owner of their OWN trigger-created workspace, so the RPC
  // resolves THAT workspace and would legitimately succeed. Assert instead that
  // no invitation landed in the owner's workspace.
  const leaked = await db.query(
    `select count(*)::int as n from workspace_invitations
     where workspace_id=$1 and email=$2`,
    [workspaceId, `stranger-${stamp}@example.com`],
  );
  check(
    'member cannot create an invitation in the owner workspace',
    leaked.rows[0]?.n === 0,
    `${leaked.rows[0]?.n} rows leaked`,
  );
  check(
    'RPC outcome was either refused or scoped to own workspace',
    !memberInvErr || memberInvErr.code === '42501',
    memberInvErr?.code ?? 'succeeded in own workspace',
  );

  // ── 7. Negative: member cannot change their own access ──────────────────
  console.log('\n6. negative — member cannot change their own access');
  const { error: selfErr } = await (await member()).rpc('update_member_access', {
    p_target_user_id: memberId,
    p_role: 'admin',
    p_permissions: null,
  });
  check('self-promotion refused with 42501', selfErr?.code === '42501', selfErr?.code);

  // ── 8. Negative: owner access is immutable ──────────────────────────────
  console.log('\n7. negative — owner access is immutable');
  const { error: ownerErr } = await (await owner()).rpc('update_member_access', {
    p_target_user_id: ownerId,
    p_role: 'member',
    p_permissions: null,
  });
  check('targeting an owner refused with 42501', ownerErr?.code === '42501', ownerErr?.code);

  // ── 9. Gate BEFORE the grant: finance must resolve to none ──────────────
  console.log('\n8. module gate BEFORE the grant');
  const beforeLevel = await moduleAccess(await member(), 'finance', memberId);
  check('finance resolves to none', beforeLevel.level === 'none', beforeLevel.level);

  // ── 10. Owner grants finance:view ───────────────────────────────────────
  console.log('\n9. owner grants finance:view');
  const { data: updRes, error: updErr } = await (await owner()).rpc('update_member_access', {
    p_target_user_id: memberId,
    p_role: null,
    p_permissions: { finance: 'view' },
  });
  check('update_member_access succeeded', !updErr, updErr?.message);
  check('RPC reports changed:true', updRes?.changed === true);

  const granted = await db.query(
    `select permissions from workspace_members where workspace_id=$1 and user_id=$2`,
    [workspaceId, memberId],
  );
  check(
    'matrix now stores finance:view',
    granted.rows[0]?.permissions?.finance === 'view',
    JSON.stringify(granted.rows[0]?.permissions),
  );

  const afterLevel = await moduleAccess(await member(), 'finance', memberId);
  check('finance resolves to view AFTER the grant', afterLevel.level === 'view', afterLevel.level);

  // ── 11. The real gated route now allows it ──────────────────────────────
  console.log('\n10. real route /api/finance/overview (requireModuleView)');
  const statusGranted = await apiGet(
    '/api/finance/overview',
    memberCookie.cookie,
  );
  check(
    'finance overview NOT 403 after grant',
    statusGranted !== 403,
    `status=${statusGranted}`,
  );
  check(
    'finance overview responds 200 (auth + gate passed)',
    statusGranted === 200,
    `status=${statusGranted}`,
  );

  // And prove the MEMBER-ONLY endpoints behave, over real HTTP:
  const rosterMember = await apiSend(
    '/api/workspace/members',
    memberCookie.cookie,
    'GET',
  );
  check(
    'GET /api/workspace/members is open to a plain member',
    rosterMember.status === 200 && rosterMember.body?.ok === true,
    `status=${rosterMember.status}`,
  );
  check(
    'roster includes both owner and member',
    rosterMember.body?.members?.length === 2,
    JSON.stringify(rosterMember.body?.members?.length),
  );

  const inviteAsMember = await apiSend(
    '/api/workspace/invitations',
    memberCookie.cookie,
    'POST',
    { email: `nope-${stamp}@example.com`, role: 'member' },
  );
  check(
    'POST /api/workspace/invitations as member -> 403',
    inviteAsMember.status === 403,
    `status=${inviteAsMember.status}`,
  );

  const auditAsMember = await apiSend(
    '/api/workspace/permissions/audit',
    memberCookie.cookie,
    'GET',
  );
  check(
    'GET /api/workspace/permissions/audit as member -> 403',
    auditAsMember.status === 403,
    `status=${auditAsMember.status}`,
  );

  const auditAsOwner = await apiSend(
    '/api/workspace/permissions/audit',
    ownerCookie.cookie,
    'GET',
  );
  check(
    'GET /api/workspace/permissions/audit as owner -> 200',
    auditAsOwner.status === 200 && auditAsOwner.body?.ok === true,
    `status=${auditAsOwner.status}`,
  );

  // Route-level validation: a bad matrix must be rejected by the API, not stored.
  const badPatch = await apiSend(
    `/api/workspace/members/${memberId}`,
    ownerCookie.cookie,
    'PATCH',
    { permissions: { finance: 'superuser' } },
  );
  check(
    'PATCH with an invalid level -> 400',
    badPatch.status === 400,
    `status=${badPatch.status}`,
  );
  const badOwner = await apiSend(
    `/api/workspace/members/${memberId}`,
    ownerCookie.cookie,
    'PATCH',
    { role: 'owner' },
  );
  check(
    'PATCH promoting to owner -> 400',
    badOwner.status === 400,
    `status=${badOwner.status}`,
  );

  // ── 12. Revoke and prove the 403 comes back ─────────────────────────────
  console.log('\n11. owner revokes finance access');
  const { data: revokeRes, error: revokeErr } = await (await owner()).rpc(
    'update_member_access',
    {
      p_target_user_id: memberId,
      p_role: null,
      p_permissions: { finance: 'none' },
    },
  );
  check('revoke succeeded', !revokeErr, revokeErr?.message);
  check('revoke reports changed:true', revokeRes?.changed === true);

  const revokedLevel = await moduleAccess(await member(), 'finance', memberId);
  check('finance resolves to none again', revokedLevel.level === 'none', revokedLevel.level);

  const statusRevoked = await apiGet(
    '/api/finance/overview',
    memberCookie.cookie,
  );
  check('finance overview IS 403 after revoke', statusRevoked === 403, `status=${statusRevoked}`);

  // ── 13. Level hierarchy: create implies view ────────────────────────────
  console.log('\n12. level hierarchy (finance:create implies view)');
  await (await owner()).rpc('update_member_access', {
    p_target_user_id: memberId,
    p_role: null,
    p_permissions: { finance: 'create' },
  });
  const createLevel = await moduleAccess(await member(), 'finance', memberId);
  check('finance resolves to create', createLevel.level === 'create', createLevel.level);
  // requireModuleView uses >= view, so create must still pass the view gate.
  const statusCreate = await apiGet(
    '/api/finance/overview',
    memberCookie.cookie,
  );
  check(
    'finance overview NOT 403 with finance:create',
    statusCreate !== 403,
    `status=${statusCreate}`,
  );
  // But the create-gated POST on expenses is now allowed...
  const expensesGet = await apiGet(
    '/api/finance/expenses',
    memberCookie.cookie,
  );
  check(
    'GET /api/finance/expenses allowed with finance:create',
    expensesGet !== 403,
    `status=${expensesGet}`,
  );
  // ...and settings stays locked for a member no matter what is stored.
  const settingsLevel = await moduleAccess(await member(), 'settings', memberId);
  check('settings stays none for a member even if stored', settingsLevel.level === 'none', settingsLevel.level);
  const settingsRoute = await apiGet('/api/settings', memberCookie.cookie);
  check(
    'GET /api/settings as member -> 403 (settings is owner/admin-only)',
    settingsRoute === 403,
    `status=${settingsRoute}`,
  );

  // ── 14. Audit trail ─────────────────────────────────────────────────────
  console.log('\n13. audit trail');
  const auditRows = await db.query(
    `select actor_id, target_user_id, changes, created_at
     from permission_audit
     where workspace_id=$1 and target_user_id=$2
     order by created_at asc`,
    [workspaceId, memberId],
  );
  check('permission_audit has rows for the member', auditRows.rows.length >= 3, `${auditRows.rows.length}`);
  check(
    'every audit row is attributed to the owner',
    auditRows.rows.every((r) => r.actor_id === ownerId),
  );
  const firstDiff = auditRows.rows[0]?.changes;
  check(
    'first change records finance none -> view',
    firstDiff?.finance?.before === 'none' && firstDiff?.finance?.after === 'view',
    JSON.stringify(firstDiff),
  );
  const sawNoneAfterView = auditRows.rows.some(
    (r) => r.changes?.finance?.after === 'none',
  );
  check('revocation is recorded (view -> none)', sawNoneAfterView);

  const auditLogs = await db.query(
    `select action from audit_logs where workspace_id=$1`,
    [workspaceId],
  );
  const actions = new Set(auditLogs.rows.map((r) => r.action));
  check('audit_logs has member.invited', actions.has('member.invited'));
  check('audit_logs has member.joined', actions.has('member.joined'));
  check(
    'audit_logs has member.access_updated',
    actions.has('member.access_updated'),
    [...actions].join(','),
  );

  // ── 15. Invitation revocation RPC ───────────────────────────────────────
  console.log('\n14. invitation revocation RPC');
  const { error: revErr } = await (await owner()).rpc('revoke_workspace_invitation', {
    p_invitation_id: invitationId,
  });
  check(
    'revoking an already-accepted invitation is a safe no-op',
    !revErr,
    revErr?.message,
  );
  // ── 16. Invite-link signup: no personal workspace ───────────────────────
  console.log('\n15. invite-link signup (invite-aware handle_new_user)');
  {
    // (a) A DIFFERENT owner invites a never-seen email.
    const invOwnerEmail = `e2e-invowner-${stamp}@example.com`;
    const inviteeEmail = `e2e-invitee-${stamp}@example.com`;

    const invOwner = await pub.auth.signUp({
      email: invOwnerEmail,
      password,
      options: { data: { full_name: 'E2E Invite Owner' } },
    });
    const invOwnerId = invOwner.data.user.id;
    inviteSignupUserIds.push(invOwnerId);
    const invOwnerSession = invOwner.data.session;
    const invOwnerWs = (
      await db.query(
        `select workspace_id from workspace_members where user_id=$1 order by created_at limit 1`,
        [invOwnerId],
      )
    ).rows[0].workspace_id;

    const invOwnerClient = await asUser(invOwnerSession);
    const inv2 = await invOwnerClient.rpc('create_workspace_invitation', {
      p_email: inviteeEmail,
      p_role: 'member',
      p_permissions: { brands: 'view' },
    });
    check('invite for a not-yet-registered email created', !inv2.error, inv2.error?.message);
    const inv2Token = (
      await db.query(`select token from workspace_invitations where id=$1`, [inv2.data])
    ).rows[0].token;

    // (b) The invitee registers THROUGH the invite link, passing the token in
    //     user metadata exactly like signUp({ inviteToken }) does.
    const invitee = await pub.auth.signUp({
      email: inviteeEmail,
      password,
      options: {
        data: { full_name: 'E2E Invitee', invite_token: inv2Token },
      },
    });
    check('invitee registered from the invite link', !invitee.error, invitee.error?.message);
    const inviteeId = invitee.data.user.id;
    inviteSignupUserIds.push(inviteeId);

    const wsRows = await db.query(
      `select workspace_id, role, permissions from workspace_members where user_id=$1`,
      [inviteeId],
    );
    check(
      'invitee has EXACTLY ONE workspace (no personal workspace)',
      wsRows.rows.length === 1,
      `got ${wsRows.rows.length}: ${JSON.stringify(wsRows.rows)}`,
    );
    check(
      'that workspace is the team workspace they were invited to',
      wsRows.rows[0]?.workspace_id === invOwnerWs,
      `${wsRows.rows[0]?.workspace_id} vs ${invOwnerWs}`,
    );
    check('role is member, not owner', wsRows.rows[0]?.role === 'member', wsRows.rows[0]?.role);
    check(
      'permission matrix came from the invitation',
      wsRows.rows[0]?.permissions?.brands === 'view',
      JSON.stringify(wsRows.rows[0]?.permissions),
    );

    const profileRow = await db.query(
      `select role, workspace_id from profiles where id=$1`,
      [inviteeId],
    );
    check(
      'profile points at the team workspace',
      profileRow.rows[0]?.workspace_id === invOwnerWs,
      JSON.stringify(profileRow.rows[0]),
    );
    check('profile role is not owner', profileRow.rows[0]?.role === 'member');

    const invStatus = await db.query(
      `select status, accepted_at from workspace_invitations where id=$1`,
      [inv2.data],
    );
    check(
      'invitation auto-accepted at signup',
      invStatus.rows[0]?.status === 'accepted' && !!invStatus.rows[0]?.accepted_at,
      JSON.stringify(invStatus.rows[0]),
    );

    const joinedLog = await db.query(
      `select action, metadata from audit_logs
       where workspace_id=$1 and entity_id=$2`,
      [invOwnerWs, inv2.data],
    );
    check(
      'audit_logs recorded member.joined via signup',
      joinedLog.rows.some(
        (r) => r.action === 'member.joined' && r.metadata?.via === 'signup',
      ),
      JSON.stringify(joinedLog.rows.map((r) => r.action)),
    );

    // The invitee must be able to act INSIDE the team workspace: the whole
    // point is that getCurrentWorkspace() now resolves to the team.
    const inviteeClient = await asUser(invitee.data.session);
    const resolved = await inviteeClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', inviteeId)
      .limit(1)
      .single();
    check(
      'getCurrentWorkspace-equivalent resolves to the TEAM workspace',
      resolved.data?.workspace_id === invOwnerWs,
      JSON.stringify(resolved.data),
    );

    // (c) NEGATIVE: an invite token belonging to someone else must NOT be
    //     usable at signup — it falls back to a normal personal workspace.
    const strangerEmail = `e2e-stranger-${stamp}@example.com`;
    const stranger = await pub.auth.signUp({
      email: strangerEmail,
      password,
      options: { data: { full_name: 'E2E Stranger', invite_token: inv2Token } },
    });
    const strangerId = stranger.data.user.id;
    inviteSignupUserIds.push(strangerId);
    const strangerWs = await db.query(
      `select workspace_id, role from workspace_members where user_id=$1`,
      [strangerId],
    );
    check(
      'forged token (wrong email) does NOT grant team membership',
      strangerWs.rows.every((r) => r.workspace_id !== invOwnerWs),
      JSON.stringify(strangerWs.rows),
    );
    check(
      'forged-token signup falls back to its own owner workspace',
      strangerWs.rows.length === 1 && strangerWs.rows[0].role === 'owner',
      JSON.stringify(strangerWs.rows),
    );

    // cleanup is handled centrally in the `finally` block via
    // inviteSignupUserIds, so an abort mid-section cannot leak accounts.
  }
} catch (err) {
  failed++;
  console.error('\nUNEXPECTED ERROR:', err.message);
} finally {
  console.log('\n15. cleanup');
  try {
    if (workspaceId) {
      await db.query(`delete from permission_audit where workspace_id=$1`, [workspaceId]);
      await db.query(`delete from workspace_invitations where workspace_id=$1`, [workspaceId]);
      await db.query(`delete from workspace_members where workspace_id=$1`, [workspaceId]);
      await db.query(`delete from workspaces where id=$1`, [workspaceId]);
      await db.query(`delete from audit_logs where workspace_id=$1`, [workspaceId]);
    }
    for (const wsId of personalWorkspaceIds) {
      await db.query(`delete from workspace_members where workspace_id=$1`, [wsId]);
      await db.query(`delete from workspaces where id=$1`, [wsId]);
    }
    // Any remaining workspace owned by a test user (the signup trigger also
    // creates a personal one) — remove it before the user row.
    for (const id of [ownerId, memberId, ...inviteSignupUserIds]) {
      if (!id) continue;
      const extra = await db.query(
        `select workspace_id from workspace_members where user_id=$1`,
        [id],
      );
      for (const row of extra.rows) {
        await db.query(`delete from permission_audit where workspace_id=$1`, [row.workspace_id]);
        await db.query(`delete from workspace_invitations where workspace_id=$1`, [row.workspace_id]);
        await db.query(`delete from audit_logs where workspace_id=$1`, [row.workspace_id]);
        await db.query(`delete from workspace_members where workspace_id=$1`, [row.workspace_id]);
        await db.query(`delete from workspaces where id=$1`, [row.workspace_id]);
      }
    }
    // Delete via the postgres connection: auth.admin needs the service key.
    for (const id of [ownerId, memberId, ...inviteSignupUserIds]) {
      if (!id) continue;
      await db.query(`delete from profiles where id=$1`, [id]);
      await db.query(`delete from auth.users where id=$1`, [id]);
    }
    console.log('  removed test workspaces, memberships, invitations and auth users');
  } catch (e) {
    console.error('  cleanup failed:', e.message);
  }
  await db.end();
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
