import { NextResponse } from 'next/server';
import { getTeamMembers, createTeamMember } from '@/services/finance/team.service';
import { validateTeamMember } from '@/services/finance/team-validation';
import { withAuth } from '@/lib/route-auth';

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') ?? undefined;
    const members = await getTeamMembers(brand ?? undefined);
    return NextResponse.json({ members });
  } catch (err) {
    console.warn('[api/finance/team] GET error:', err);
    return NextResponse.json(
      { error: 'خطا در دریافت اطلاعات تیم.' },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const result = validateTeamMember(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'داده‌های ورودی نامعتبر است.', details: result.error.flatten() },
        { status: 400 },
      );
    }
    const member = await createTeamMember(result.data);
    if (!member) {
      return NextResponse.json(
        { error: 'ایجاد عضو تیم ناموفق بود.' },
        { status: 500 },
      );
    }
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    console.warn('[api/finance/team] POST error:', err);
    return NextResponse.json(
      { error: 'خطا در ایجاد عضو تیم.' },
      { status: 500 },
    );
  }
});
