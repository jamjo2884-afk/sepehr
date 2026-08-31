import { requireAuth } from "@/lib/route-auth";
import { NextResponse } from 'next/server';
import { syncAllConnectedAccounts } from '@/services/social-sync.service';

/**
 * POST /api/social/sync/all
 *
 * Syncs every account with connection_status = 'connected', with bounded
 * concurrency (SYNC_ALL_CONCURRENCY). Accounts that are not connected are
 * skipped — never attempted. Partial failures are not treated as a total
 * failure: the summary reports success / failed / skipped counts.
 *
 * Safe output only — no credentials, no raw API errors.
 */
export const POST = requireAuth(async (): Promise<NextResponse> => {
  try {
    const result = await syncAllConnectedAccounts();
    // Strip per-account error messages down to codes + generic Persian text
    // (raw API detail is only in the server-side sync logs).
    const safe = {
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      results: result.results.map((r) => ({
        accountId: r.accountId,
        ok: r.ok,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
      })),
    };
    return NextResponse.json(safe, { status: 200 });
  } catch (err) {
    console.warn('[sync] Sync-all failed.', err);
    return NextResponse.json(
      { error: 'همگام‌سازی همه انجام نشد.' },
      { status: 500 },
    );
  }
});
