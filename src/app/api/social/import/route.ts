import { NextResponse } from 'next/server';
import { z } from 'zod';
import { importSocialMetricsRows } from '@/services/social-import/import.service';
import type { SocialMetricValues } from '@/types/social';

/**
 * POST /api/social/import
 *
 * Body: { rows: SocialMetricImportRow[] } — the VALIDATED rows from the
 * preview step. The server re-resolves every account and commits each row
 * through `recordSocialMetrics` (the same path as the manual form), so the
 * NULL-merge and duplicate-prevention behavior is identical to manual
 * entry. Rows that fail account matching are skipped and reported.
 *
 * The client never writes to Supabase directly — it only sends rows here.
 */

const valueSchema = z.object({
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
});

const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  platform: z.string(),
  accountIdentifier: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly']),
  periodLabel: z.string(),
  values: valueSchema,
  errors: z.array(z.string()),
  resolvedAccountId: z.string().nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).max(5000),
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
    return NextResponse.json(
      { error: 'دادهٔ ارسالی نامعتبر است.' },
      { status: 400 },
    );
  }

  const rows = parsed.data.rows.map((r) => ({
    rowNumber: r.rowNumber,
    platform: r.platform as never,
    accountIdentifier: r.accountIdentifier,
    period: r.period,
    periodLabel: r.periodLabel,
    values: r.values as SocialMetricValues,
    errors: r.errors,
    resolvedAccountId: r.resolvedAccountId ?? null,
  }));

  try {
    const summary = await importSocialMetricsRows(rows);
    return NextResponse.json(summary);
  } catch (err) {
    console.warn('[social-import] Import failed.', err);
    return NextResponse.json(
      { error: 'ثبت اطلاعات انجام نشد.' },
      { status: 500 },
    );
  }
}
