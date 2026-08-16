import { NextResponse } from 'next/server';
import { getSocialDataQuality } from '@/services/social-data-quality.service';

/**
 * GET /api/social/data-quality
 *
 * Read-only data-quality report over the real Supabase data
 * (`social_accounts` + `social_metrics`). Server-side only; no mock/fallback
 * data, no credentials exposed. Computes everything on the server and
 * returns only the summary + issue list (never the full metric history).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const report = await getSocialDataQuality();
    return NextResponse.json(report);
  } catch (err) {
    console.warn(
      '[social-data-quality] Could not read the data-quality report.',
      err,
    );
    return NextResponse.json(
      { error: 'خواندن گزارش کیفیت داده انجام نشد.' },
      { status: 500 },
    );
  }
}
