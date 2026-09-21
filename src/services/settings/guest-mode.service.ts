/**
 * Guest-mode settings service.
 *
 * Reads the singleton app_settings row (guest_mode_enabled) and toggles it
 * through the SECURITY DEFINER set_guest_mode() RPC. The client NEVER writes
 * the row directly — there is no UPDATE policy on app_settings; the RPC is
 * the only write route and it re-checks owner/admin membership inside the
 * database. Every successful toggle is logged by the RPC itself into
 * audit_logs (who + when) and stamps changed_by/changed_at on the row.
 *
 * Demo mode (no Supabase config): in-memory fallback so local runs still
 * exercise the UI, without pretending a flag was persisted.
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import {
  GUEST_MODE_TTL_MS,
  resetGuestModeCacheForTests,
} from '@/lib/guest-mode';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuestModeState {
  enabled: boolean;
  /** ISO timestamp of the last toggle (null when unknown). */
  changedAt: string | null;
  /** auth.users id of the last actor (null when unknown). */
  changedBy: string | null;
  /** Where the value came from — surfaced for ops/debugging in the API. */
  source: 'db' | 'env' | 'demo' | 'default';
}

export type GuestModeResult =
  | { ok: true; state: GuestModeState }
  | { ok: false; errorCode: string; errorMessage: string };

// ─── Demo fallback ───────────────────────────────────────────────────────────

let _demoEnabled = false;

/** Reset the in-memory demo flag (test isolation only). */
export function resetGuestModeDemoStateForTests(): void {
  _demoEnabled = false;
}

function demoState(): GuestModeState {
  return {
    enabled: _demoEnabled,
    changedAt: null,
    changedBy: null,
    source: 'demo',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToState(
  row: {
    guest_mode_enabled: boolean;
    changed_at: string | null;
    changed_by: string | null;
  } | null,
): GuestModeState | null {
  if (!row) return null;
  return {
    enabled: row.guest_mode_enabled === true,
    changedAt: row.changed_at ?? null,
    changedBy: row.changed_by ?? null,
    source: 'db',
  };
}

/**
 * Clear the process-wide flag cache after a successful toggle so the next
 * isGuestModeEnabled() call on THIS instance reflects the change immediately.
 * Other instances pick it up within GUEST_MODE_TTL_MS — hence the UI notice
 * "تغییر تا ۱۰ ثانیه دیگر اعمال می‌شود".
 */
function invalidateFlagCache(): void {
  resetGuestModeCacheForTests();
}

// ─── API ─────────────────────────────────────────────────────────────────────

/** Read the current guest-mode state (DB → env → default OFF). */
export async function getGuestModeState(): Promise<GuestModeResult> {
  // Demo mode: no backend, serve the in-memory flag.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
      'https://placeholder.supabase.co' ||
    process.env.DEMO_MODE === 'true'
  ) {
    return { ok: true, state: demoState() };
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('app_settings')
      .select('guest_mode_enabled, changed_at, changed_by')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    const state = rowToState(
      data as {
        guest_mode_enabled: boolean;
        changed_at: string | null;
        changed_by: string | null;
      } | null,
    );
    if (state) return { ok: true, state };

    // Row missing (migration not applied yet) → env fallback.
    return {
      ok: true,
      state: {
        enabled: process.env.GUEST_MODE_ENABLED === 'true',
        changedAt: null,
        changedBy: null,
        source: 'env',
      },
    };
  } catch (err) {
    console.warn('[guest-mode] Failed to read app_settings:', err);
    return {
      ok: true,
      state: {
        enabled: process.env.GUEST_MODE_ENABLED === 'true',
        changedAt: null,
        changedBy: null,
        source: 'env',
      },
    };
  }
}

/**
 * Toggle guest mode. Validation happens before the RPC; the RPC re-checks
 * owner/admin membership inside the database (SECURITY DEFINER).
 */
export async function setGuestMode(enabled: unknown): Promise<GuestModeResult> {
  if (typeof enabled !== 'boolean') {
    return {
      ok: false,
      errorCode: 'invalid_value',
      errorMessage: 'مقدار فعال/غیرفعال نامعتبر است.',
    };
  }

  // Demo mode: flip the in-memory flag (never presented as persisted state).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
      'https://placeholder.supabase.co' ||
    process.env.DEMO_MODE === 'true'
  ) {
    _demoEnabled = enabled;
    invalidateFlagCache();
    return { ok: true, state: demoState() };
  }

  try {
    const supabase = await getSupabase();

    // The RPC exists only after the migration; probing first turns a missing
    // migration into a clean, actionable error instead of a PostgREST 404.
    if (!(await isTableAvailable('app_settings'))) {
      return {
        ok: false,
        errorCode: 'not_configured',
        errorMessage:
          'جدول تنظیمات یافت نشد — ابتدا مایگریشن guest_mode_app_settings را اجرا کنید.',
      };
    }

    const { data, error } = await supabase.rpc('set_guest_mode', {
      p_enabled: enabled,
    });

    if (error) {
      // 42501 = insufficient_privilege raised by the RPC's owner/admin gate.
      const denied =
        error.code === '42501' ||
        /only workspace owners\/admins/i.test(error.message ?? '');
      if (denied) {
        return {
          ok: false,
          errorCode: 'forbidden',
          errorMessage:
            'فقط مالک یا مدیر فضای کاری می‌تواند حالت مهمان را تغییر دهد.',
        };
      }
      throw error;
    }

    invalidateFlagCache();

    return {
      ok: true,
      state: {
        enabled: data === true,
        changedAt: new Date().toISOString(),
        changedBy: null, // the RPC knows the actor; re-read if the UI needs it
        source: 'db',
      },
    };
  } catch (err) {
    console.warn('[guest-mode] Failed to set guest mode:', err);
    return {
      ok: false,
      errorCode: 'update_failed',
      errorMessage: 'خطا در ذخیره تغییرات.',
    };
  }
}

/** TTL used by the API response so the UI can show the same notice. */
export const GUEST_MODE_PROPAGATION_MS = GUEST_MODE_TTL_MS;
