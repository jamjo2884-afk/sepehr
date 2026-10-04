import { NextResponse } from 'next/server';
import { requireModuleCreate } from '@/lib/permissions';
import { z } from 'zod';
import { importSocialMetricsRows } from '@/services/social-import/import.service';
import type { SocialMetricValues } from '@/types/social';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/social/import
 *
 * Uses SSE (Server-Sent Events) to stream real-time progress to the client.
 * Each event is a JSON line: { type: 'progress' | 'done' | 'error', ... }
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
  brand: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  sourceStatus: z.string().nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).max(5000),
});

export const POST = requireModuleCreate('social')(
  async (req: Request): Promise<NextResponse> => {
    // Rate limit: 5 imports per 5 minutes
  const ip = getClientIp(req);
  const limit = checkRateLimit(`import:${ip}`, RATE_LIMITS.import);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'درخواست بیش از حد مجاز است.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'دادهٔ ارسالی نامعتبر است.' }, { status: 400 });
  }

  const rows = parsed.data.rows.map((r) => ({
    rowNumber: r.rowNumber,
    platform: r.platform as never,
    accountIdentifier: r.accountIdentifier,
    period: r.period,
    periodLabel: r.periodLabel,
    values: r.values as SocialMetricValues,
    errors: r.errors,
    resolvedAccountId: r.resolvedAccountId ?? undefined,
    brand: r.brand ?? undefined,
    link: r.link ?? undefined,
    sourceStatus: r.sourceStatus ?? undefined,
  }));

  // Use SSE streaming for real-time progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const summary = await importSocialMetricsRows(rows, {
          onProgress: (progress) => {
            send({ type: 'progress', ...progress });
          },
        });
        send({ type: 'done', summary });
        controller.close();
      } catch (err) {
        console.warn('[social-import] Import failed.', err);
        send({ type: 'error', error: 'ثبت اطلاعات انجام نشد.' });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
