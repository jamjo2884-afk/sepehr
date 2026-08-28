import { NextRequest, NextResponse } from 'next/server';
import { updateTeamMember, deleteTeamMember } from '@/services/finance/team.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    // Partial validation — just check allocations if present
    if (body.allocations) {
      const total = body.allocations.reduce(
        (sum: number, a: { allocationPercentage: number }) => sum + a.allocationPercentage,
        0,
      );
      if (total > 100) {
        return NextResponse.json(
          { error: 'مجموع درصدهای تخصیص نمی‌تواند بیشتر از ۱۰۰٪ باشد.' },
          { status: 400 },
        );
      }
    }
    const member = await updateTeamMember(params.id, body);
    if (!member) {
      return NextResponse.json(
        { error: 'عضو تیم یافت نشد.' },
        { status: 404 },
      );
    }
    return NextResponse.json(member);
  } catch (err) {
    console.warn('[api/finance/team/[id]] PATCH error:', err);
    return NextResponse.json(
      { error: 'خطا در به‌روزرسانی عضو تیم.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ok = await deleteTeamMember(params.id);
    if (!ok) {
      return NextResponse.json(
        { error: 'حذف عضو تیم ناموفق بود.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.warn('[api/finance/team/[id]] DELETE error:', err);
    return NextResponse.json(
      { error: 'خطا در حذف عضو تیم.' },
      { status: 500 },
    );
  }
}
