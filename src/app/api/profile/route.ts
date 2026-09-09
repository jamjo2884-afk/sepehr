import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/route-auth';
import { getSupabase, isTableAvailable } from '@/lib/db';

/**
 * GET /api/profile
 *
 * Returns the authenticated user's full profile including workspace info.
 * The user ID always comes from the session — never from the client.
 */
export const GET = withAuth(async (_req, auth) => {
  try {
    const supabase = await getSupabase();

    if (!(await isTableAvailable('profiles'))) {
      // Demo mode — return a synthetic profile.
      return NextResponse.json({
        ok: true,
        profile: {
          id: auth.user.id,
          fullName: auth.user.email?.split('@')[0] ?? 'کاربر',
          email: auth.user.email ?? '',
          avatarUrl: null,
          role: auth.workspace.role,
          workspaceId: auth.workspace.workspaceId,
          workspaceName: 'Media Deck',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Fetch profile row
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, workspace_id, created_at, updated_at')
      .eq('id', auth.user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { ok: false, error: 'پروفایل یافت نشد.' },
        { status: 404 },
      );
    }

    // Fetch workspace name
    let workspaceName = '';
    if (profile.workspace_id) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', profile.workspace_id)
        .single();
      workspaceName = ws?.name ?? '';
    }

    return NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: auth.user.email ?? '',
        avatarUrl: profile.avatar_url,
        role: profile.role,
        workspaceId: profile.workspace_id,
        workspaceName,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'خطا در دریافت پروفایل.' },
      { status: 500 },
    );
  }
});

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'نام و نام خانوادگی الزامی است.')
    .max(80, 'نام نمی‌تواند بیش از ۸۰ کاراکتر باشد.')
    .optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

/**
 * PATCH /api/profile
 *
 * Updates the authenticated user's profile.
 * Only fullName and avatarUrl are editable by the user.
 * The user ID comes from the session — never from the client body.
 */
export const PATCH = withAuth(async (req, auth) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'داده نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, message: 'تغییری اعمال نشد.' });
  }

  try {
    const supabase = await getSupabase();

    if (!(await isTableAvailable('profiles'))) {
      // Demo mode — accept silently.
      return NextResponse.json({ ok: true, message: 'پروفایل به‌روزرسانی شد.' });
    }

    const row: Record<string, unknown> = {};
    if (updates.fullName !== undefined) row.full_name = updates.fullName.trim();
    if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', auth.user.id);

    if (error) {
      console.warn('[api/profile] Update failed:', error);
      return NextResponse.json(
        { ok: false, error: 'خطا در به‌روزرسانی پروفایل.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: 'پروفایل به‌روزرسانی شد.' });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'خطا در به‌روزرسانی پروفایل.' },
      { status: 500 },
    );
  }
});
