/*
# Invite-aware signup — no personal workspace when joining via an invite link

## Problem
`handle_new_user()` (migration 20260719155903) created a personal workspace
with the new user as OWNER for EVERY signup. A user who then accepted an
invitation ended up a member of two workspaces while still owning their
personal one, and `getCurrentWorkspace()` resolves `limit(1)` on the OLDEST
membership — so the workspace they were invited to was unreachable in practice.

## Decision (owner, 2026-10-04)
"Signup via an invite link must not create a personal workspace." A normal
signup still gets one; a signup carrying a valid invite token joins only that
workspace.

## Where the logic lives, and why the trigger
The token is passed through `auth.users.raw_user_meta_data` (the same channel
that already carries `full_name`), so the AFTER INSERT trigger on auth.users
can see it. The check stays HERE rather than in application code because:

1. Atomic — the membership exists the instant the account does. The
   application-level alternative (sign up, then call accept_*) leaves a window
   where the user owns a personal workspace and may fail halfway, leaving an
   orphan personal workspace behind.
2. No create-then-delete. Cascading a delete over a workspace the user might
   already have put data into is far worse than never creating it.
3. One owner for the "does this user get a personal workspace" invariant,
   instead of two code paths (trigger + API) that both provision workspaces.

## Security
`raw_user_meta_data` is client-controlled, so the token is UNTRUSTED input and
is fully re-validated here:
  - the invitation must exist, be 'pending', and not be expired;
  - `lower(NEW.email)` must equal the invited address.
The role and permission matrix granted are the ones STORED ON THE INVITATION
row (chosen by the owner) — never anything from the client. A user therefore
cannot join a workspace they were not invited to, cannot reuse someone else's
invite, and cannot escalate: the worst case is that an invalid token simply
falls through to the normal personal-workspace path.

Idempotent: CREATE OR REPLACE only; no table or policy changes.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  base_slug        text;
  unique_slug     text;
  slug_count      int;
  v_token         text;
  v_inv_id        uuid;
  v_inv_ws        uuid;
  v_inv_role      app_role;
  v_inv_perms     jsonb;
  v_inv_email     text;
BEGIN
  -- Untrusted client metadata: only a non-empty string is considered, and it
  -- is validated against the invitation row below before anything is granted.
  v_token := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF v_token IS NOT NULL THEN
    SELECT i.id, i.workspace_id, i.role, i.permissions, lower(i.email)
      INTO v_inv_id, v_inv_ws, v_inv_role, v_inv_perms, v_inv_email
    FROM workspace_invitations i
    WHERE i.token = v_token
      AND i.status = 'pending'
      AND i.expires_at > now()
      AND lower(i.email) = lower(COALESCE(NEW.email, ''));

    IF v_inv_id IS NOT NULL THEN
      -- ── Invite path: join ONLY the invited workspace ──────────────────
      INSERT INTO profiles (id, full_name, role, workspace_id)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        v_inv_role,
        v_inv_ws
      )
      ON CONFLICT (id) DO UPDATE
        SET workspace_id = v_inv_ws,
            role          = v_inv_role,
            full_name     = COALESCE(NEW.raw_user_meta_data->>'full_name', '');

      INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
      VALUES (v_inv_ws, NEW.id, v_inv_role, COALESCE(v_inv_perms, '{}'::jsonb))
      ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET role        = v_inv_role,
            permissions = COALESCE(v_inv_perms, '{}'::jsonb);

      UPDATE workspace_invitations
      SET status = 'accepted', accepted_at = now()
      WHERE id = v_inv_id;

      INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
      VALUES (
        v_inv_ws, NEW.id, 'member.joined', 'workspace_invitation', v_inv_id::text,
        jsonb_build_object('email', v_inv_email, 'role', v_inv_role, 'via', 'signup')
      );

      RETURN NEW;
    END IF;
    -- Invalid/expired/mismatched token → fall through to the normal path.
  END IF;

  -- ── Normal signup: personal workspace, user is its owner ────────────────
  base_slug := 'workspace-' || substr(NEW.id::text, 1, 8);
  unique_slug := base_slug;
  slug_count := 0;
  WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = unique_slug) LOOP
    slug_count := slug_count + 1;
    unique_slug := base_slug || '-' || slug_count::text;
  END LOOP;

  INSERT INTO workspaces (name, slug)
  VALUES ('فضای کاری من', unique_slug)
  RETURNING id INTO new_workspace_id;

  INSERT INTO profiles (id, full_name, role, workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'owner',
    new_workspace_id
  )
  ON CONFLICT (id) DO UPDATE
    SET workspace_id = new_workspace_id, role = 'owner';

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'owner';

  RETURN NEW;
END;
$$;
