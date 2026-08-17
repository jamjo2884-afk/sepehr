import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  bulkEditSocialMetrics,
  SOCIAL_BULK_EDIT_MAX_RECORDS,
} from '@/services/social-bulk-edit.service';
import type { SocialMetricPeriod } from '@/types/social';

/**
 * POST /api/social/metrics/bulk-edit
 *
 * Body: {
 *   period, periodLabel,           // the (account, period, period_label) row key
 *   targets: [{ accountId, expectedUpdatedAt }],  // ≤ 500
 *   values: { field: number | null, ... }          // absent = no change,
 *                                                  // number = set,
 *                                                  // null = clear
 * }
 *
 * Edits EXISTING `social_metrics` rows only — never creates rows. The
 * server resolves the concrete rows by id from the database, re-validates
 * every field against the account's platform (PLATFORM_METRIC_FIELDS) and
 * the shared value validator, and commits each row through the canonical
 * `updateSocialMetric` with optimistic concurrency (expected updated_at).
 * Every row reports its own outcome; partial failures are never hidden.
 *
 * Future authorization hooks in here (auth is bypassed in the demo).
 */
export const dynamic = 'force-dynamic';

const valueSchema = z
  .object({
    followers: z.number().nullable().optional(),
    following: z.number().nullable().optional(),
    posts: z.number().nullable().optional(),
    views: z.number().nullable().optional(),
    likes: z.number().nullable().optional(),
    comments: z.number().nullable().optional(),
    shares: z.number().nullable().optional(),
    saves: z.number().nullable().optional(),
    reach: z.number().nullable().optional(),
    impressions: z.number().nullable().optional(),
    engagementRate: z.number().nullable().optional(),
    storyViews: z.number().nullable().optional(),
    channelMembers: z.number().nullable().optional(),
    retweets: z.number().nullable().optional(),
    subscribers: z.number().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'حداقل یک فیلد را برای تغییر انتخاب کنید.',
  });

const targetSchema = z.object({
  accountId: z.string().uuid(),
  /** `updated_at` read at preview time — optimistic concurrency lock. */
  expectedUpdatedAt: z.string().min(1),
});

const bodySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  periodLabel: z.string().min(1),
  targets: z
    .array(targetSchema)
    .min(1, { message: 'حداقل یک رکورد انتخاب کنید.' })
    .max(SOCIAL_BULK_EDIT_MAX_RECORDS, {
      message: `حداکثر ${SOCIAL_BULK_EDIT_MAX_RECORDS} رکورد در هر عملیات مجاز است.`,
    }),
  values: valueSchema,
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'دادهٔ ارسالی نامعتبر است.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { period, periodLabel, targets, values } = parsed.data;

  try {
    const summary = await bulkEditSocialMetrics({
      period: period as SocialMetricPeriod,
      periodLabel,
      targets,
      values,
    });
    return NextResponse.json(summary);
  } catch (err) {
    console.warn('[social-bulk-edit] Bulk edit failed.', err);
    return NextResponse.json(
      { error: 'ویرایش انبوه انجام نشد.' },
      { status: 500 },
    );
  }
}
