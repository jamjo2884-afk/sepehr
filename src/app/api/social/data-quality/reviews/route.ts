import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import {
  deleteSocialDataQualityReview,
  getSocialDataQualityReviews,
  SOCIAL_DATA_QUALITY_ISSUE_TYPES,
  upsertSocialDataQualityReview,
} from '@/services/social-data-quality-review.service';
import type { SocialDataQualityIssueType } from '@/types/social';
import type { SocialMetricFieldKey } from '@/constants/social-fields';

/**
 * GET/POST/DELETE /api/social/data-quality/reviews
 *
 * Human review state for detected data-quality issues. Reviews never touch
 * `social_metrics` / `social_accounts` — they only write the
 * `social_data_quality_reviews` table. An issue is identified by the
 * deterministic detector tuple (issue_type, account_id, metric_id, field).
 *
 * - POST  { issueType, accountId, metricId?, field?, status } → set state
 * - DELETE { issueType, accountId, metricId?, field? } → back to 'open'
 * - GET → every persisted review
 */

const issueTypeSchema = z.enum([...SOCIAL_DATA_QUALITY_ISSUE_TYPES] as [
  SocialDataQualityIssueType,
  ...SocialDataQualityIssueType[],
]);

const fieldSchema = z.enum(
  Object.keys(SOCIAL_METRIC_FIELDS) as [
    SocialMetricFieldKey,
    ...SocialMetricFieldKey[],
  ],
);

const identitySchema = z.object({
  issueType: issueTypeSchema,
  accountId: z.string().uuid().nullable(),
  metricId: z.number().int().positive().nullable().optional(),
  field: fieldSchema.nullable().optional(),
});

const upsertSchema = identitySchema.extend({
  status: z.enum(['reviewed', 'ignored']),
});

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const reviews = await getSocialDataQualityReviews();
    return NextResponse.json({ reviews });
  } catch (err) {
    console.warn('[social-data-quality] Could not read review states.', err);
    return NextResponse.json(
      { error: 'خواندن وضعیت بررسی انجام نشد.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'دادهٔ وضعیت بررسی نامعتبر است.' },
      { status: 400 },
    );
  }
  try {
    const review = await upsertSocialDataQualityReview(parsed.data);
    return NextResponse.json(review);
  } catch (err) {
    console.warn('[social-data-quality] Could not save the review state.', err);
    return NextResponse.json(
      { error: 'ثبت وضعیت بررسی انجام نشد.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }
  const parsed = identitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'دادهٔ وضعیت بررسی نامعتبر است.' },
      { status: 400 },
    );
  }
  try {
    const deleted = await deleteSocialDataQualityReview(parsed.data);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.warn(
      '[social-data-quality] Could not remove the review state.',
      err,
    );
    return NextResponse.json(
      { error: 'بازگرداندن وضعیت بررسی انجام نشد.' },
      { status: 500 },
    );
  }
}
