import { NextResponse } from 'next/server';
import { getSyncOverview } from '@/services/social-sync.service';
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_BRAND,
} from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import { PLATFORM_METRIC_FIELDS } from '@/constants/social-fields';

/**
 * GET /api/settings/social
 *
 * Returns per-platform status information for the Social Settings page.
 * Reuses the existing sync overview infrastructure — no duplicate logic.
 *
 * Response shape:
 * {
 *   ok: true,
 *   platforms: [
 *     {
 *       id, label, color, brandName,
 *       accountCount, connectedCount, errorCount, disconnectedCount,
 *       credentialConfigured, credentialStatus,
 *       lastSyncAt, lastSyncStatus, metricCount
 *     }
 *   ]
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const overview = await getSyncOverview();

    // Build a map of last sync info per platform from the latest logs
    const lastSyncByPlatform = new Map<
      SocialPlatform,
      { at: string | null; status: string | null }
    >();
    for (const log of overview.recent) {
      const existing = lastSyncByPlatform.get(log.platform);
      if (!existing || (log.startedAt && (!existing.at || log.startedAt > existing.at))) {
        lastSyncByPlatform.set(log.platform, {
          at: log.startedAt,
          status: log.status,
        });
      }
    }

    // All 18 platforms — even those with 0 accounts
    const ALL_PLATFORMS: SocialPlatform[] = [
      'instagram', 'telegram', 'youtube', 'twitter', 'bale', 'eita',
      'rubika', 'rubino', 'soroushplus', 'aparat', 'threads', 'clubhouse',
      'shad', 'igap', 'site', 'gap', 'virasty', 'facebook',
    ];

    const platformsData = ALL_PLATFORMS.map((platform) => {
      const syncInfo = overview.platforms.find((p) => p.platform === platform);
      const lastSync = lastSyncByPlatform.get(platform);
      const brand = SOCIAL_PLATFORM_BRAND[platform];
      const metrics = PLATFORM_METRIC_FIELDS[platform];

      const accountCount = syncInfo?.accounts ?? 0;
      const credentialConfigured = syncInfo?.credentialConfigured ?? false;

      // Determine credential status text
      let credentialStatus: string;
      if (credentialConfigured) {
        credentialStatus = 'متصل';
      } else if (accountCount > 0) {
        credentialStatus = 'تنظیم نشده';
      } else {
        credentialStatus = 'بدون حساب';
      }

      return {
        id: platform,
        label: SOCIAL_PLATFORM_LABELS[platform],
        color: brand.color,
        brandName: brand.name,
        accountCount,
        connectedCount: syncInfo?.connected ?? 0,
        errorCount: syncInfo?.error ?? 0,
        disconnectedCount:
          (syncInfo?.disconnected ?? 0) + (syncInfo?.pending ?? 0),
        credentialConfigured,
        credentialStatus,
        lastSyncAt: lastSync?.at ?? null,
        lastSyncStatus: lastSync?.status ?? null,
        metricCount: metrics.length,
      };
    });

    // Sort: platforms with accounts first, then alphabetically
    platformsData.sort((a, b) => {
      if (a.accountCount > 0 && b.accountCount === 0) return -1;
      if (a.accountCount === 0 && b.accountCount > 0) return 1;
      return a.label.localeCompare(b.label, 'fa');
    });

    return NextResponse.json({ ok: true, platforms: platformsData });
  } catch (err) {
    console.error('[api/settings/social] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'fetch_failed',
        errorMessage: 'خطا در دریافت اطلاعات شبکه‌های اجتماعی.',
      },
      { status: 500 },
    );
  }
}
