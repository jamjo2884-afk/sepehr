import { NextResponse } from 'next/server';
import { getSocialDataQuality } from '@/services/social-data-quality.service';
import {
  getSocialDataQualityReviews,
  mergeReviewStatus,
} from '@/services/social-data-quality-review.service';

/**
 * GET /api/social/data-quality
 *
 * Read-only data-quality report over the real Supabase data
 * (`social_accounts` + `social_metrics`). Server-side only; no mock/fallback
 * data, no credentials exposed. Computes everything on the server and
 * returns only the summary + issue list (never the full metric history).
 *
 * The deterministic detector output is merged with human review state
 * (`social_data_quality_reviews`): each issue gains `reviewStatus`
 * ('open' | 'reviewed' | 'ignored') and the summary gains review counts.
 * Detection itself is never altered by reviews.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const [report, reviews] = await Promise.all([
      getSocialDataQuality(),
      getSocialDataQualityReviews(),
    ]);
    return NextResponse.json(mergeReviewStatus(report, reviews));
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
