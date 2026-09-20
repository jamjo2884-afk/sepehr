import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBrandById } from '@/services/brand.service';
import {
  getBrandStatusProfile,
  upsertBrandStatusProfile,
} from '@/services/brand-status.service';
import { getSocialAccounts, getSocialMetrics } from '@/services/social.service';
import { buildBrandSocialStatus } from '@/services/brand-status.service';
import { requireAuth } from '@/lib/auth';
import { getCurrentWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * All profile fields are optional free-form strings (managerial notes).
 * Empty string clears a field; an absent key leaves it untouched.
 */
const profileFieldSchema = z.string().max(2000);

const putBodySchema = z
  .object({
    brandDefinition: profileFieldSchema.optional(),
    brandMission: profileFieldSchema.optional(),
    brandAudience: profileFieldSchema.optional(),
    brandPosition: profileFieldSchema.optional(),
    brandStrengths: profileFieldSchema.optional(),
    brandWeaknesses: profileFieldSchema.optional(),
    contentStatus: profileFieldSchema.optional(),
    contentFormats: profileFieldSchema.optional(),
    contentWeaknesses: profileFieldSchema.optional(),
    contentNeeds: profileFieldSchema.optional(),
    contentStaffingNeeds: profileFieldSchema.optional(),
    publishingStatus: profileFieldSchema.optional(),
    publishingDiscipline: profileFieldSchema.optional(),
    publishingChannels: profileFieldSchema.optional(),
    distributionIssues: profileFieldSchema.optional(),
    distributionOpportunities: profileFieldSchema.optional(),
    monetizationTopics: profileFieldSchema.optional(),
    adCapacity: profileFieldSchema.optional(),
    activeCampaigns: profileFieldSchema.optional(),
    adOpportunities: profileFieldSchema.optional(),
    adNeeds: profileFieldSchema.optional(),
    topNeed: profileFieldSchema.optional(),
    urgentNeeds: profileFieldSchema.optional(),
    midtermNeeds: profileFieldSchema.optional(),
    managementSuggestions: profileFieldSchema.optional(),
  })
  .strict();

/**
 * GET /api/brands/[id]/status
 *
 * Everything the brand detail page needs in one call:
 * - brand base info (from `brands`)
 * - saved status profile (from `brand_status_profiles`), or null
 * - per-platform social status + summary (derived live from
 *   `social_accounts` + `social_metrics` — never stored, never invented)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  try {
    const brand = await getBrandById(params.id);
    // Workspace isolation (IDOR): the brand must belong to the caller's
    // workspace. RLS is the second layer of defense.
    if (!brand || brand.workspaceId !== ws.workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'برند یافت نشد.' },
        { status: 404 },
      );
    }

    const [profile, accounts, metrics] = await Promise.all([
      // NOTE: the resolved brand.id — NOT the raw URL segment. The segment may
      // be a legacy name link (resolved by getBrandById's name fallback);
      // feeding a name into the brand_id query throws 22P02 → 500.
      getBrandStatusProfile(brand.id),
      getSocialAccounts(),
      getSocialMetrics(undefined, 'monthly'),
    ]);

    // Only this brand's accounts feed the snapshot.
    const brandAccounts = accounts.filter(
      (a) => (a.brandId && a.brandId === brand.id) || a.brand === brand.name,
    );
    const brandAccountIds = new Set(brandAccounts.map((a) => a.id));
    const brandMetrics = metrics.filter((m) =>
      brandAccountIds.has(m.accountId),
    );

    const { socialPlatforms, socialSummary } = buildBrandSocialStatus(
      brandAccounts,
      brandMetrics,
    );

    return NextResponse.json({
      ok: true,
      brand: {
        id: brand.id,
        workspaceId: brand.workspaceId,
        name: brand.name,
        slug: brand.slug,
        status: brand.status,
        logoUrl: brand.logoUrl,
        color: brand.color,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      },
      profile,
      socialPlatforms,
      socialSummary,
    });
  } catch (err) {
    console.warn('[api/brands/status] GET error:', err);
    return NextResponse.json(
      { ok: false, error: 'دریافت اطلاعات با خطا مواجه شد.' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/brands/[id]/status
 *
 * Create or update the brand's status profile (upsert on brand_id).
 * Returns the saved profile.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const ws = await getCurrentWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: 'فضای کاری یافت نشد.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'داده ارسالی نامعتبر است.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'هیچ داده‌ای برای ذخیره ارسال نشده است.' },
      { status: 400 },
    );
  }

  try {
    const brand = await getBrandById(params.id);
    if (!brand || brand.workspaceId !== ws.workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'برند یافت نشد.' },
        { status: 404 },
      );
    }

    const profile = await upsertBrandStatusProfile(
      brand.id,
      ws.workspaceId,
      parsed.data,
    );
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: 'ذخیره‌سازی ناموفق بود.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.warn('[api/brands/status] PUT error:', err);
    return NextResponse.json(
      { ok: false, error: 'ذخیره‌سازی با خطا مواجه شد.' },
      { status: 500 },
    );
  }
}
