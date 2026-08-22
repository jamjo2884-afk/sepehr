import type { SocialAccount } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricImportRow } from '@/services/social-import/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountMatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'empty';

export type AccountMatchResult =
  | { status: 'matched'; accountId: string; account: SocialAccount }
  | { status: 'ambiguous'; candidates: SocialAccount[] }
  | { status: 'unmatched'; normalizedIdentifier: string }
  | { status: 'empty' };

// ─── URL Patterns ────────────────────────────────────────────────────────────

/** Known URL patterns per platform → slug extraction regex. */
const PLATFORM_URL_PATTERNS: Array<{
  pattern: RegExp;
  platforms?: SocialPlatform[];
}> = [
  // Instagram
  { pattern: /(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/i, platforms: ['instagram'] },
  // Telegram
  { pattern: /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)\/?/i, platforms: ['telegram'] },
  // YouTube
  { pattern: /(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)([a-zA-Z0-9._-]+)\/?/i, platforms: ['youtube'] },
  // Twitter / X
  { pattern: /(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/i, platforms: ['twitter'] },
  // Bale
  { pattern: /(?:ble\.ir|bale\.ai)\/([a-zA-Z0-9._-]+)\/?/i, platforms: ['bale'] },
  // Aparat
  { pattern: /(?:www\.)?aparat\.com\/([a-zA-Z0-9._-]+)\/?/i, platforms: ['aparat'] },
  // Eitaa
  { pattern: /(?:eitaa\.com)\/([a-zA-Z0-9._-]+)\/?/i, platforms: ['eita'] },
  // Rubika
  { pattern: /(?:rubika\.ir)\/([a-zA-Z0-9._-]+)\/?/i, platforms: ['rubika'] },
  // SoroushPlus
  { pattern: /(?:sapp\.ir)\/([a-zA-Z0-9._-]+)\/?/i, platforms: ['soroushplus'] },
  // Generic fallback: extract last path segment from any URL
  { pattern: /https?:\/\/[^/]+\/([a-zA-Z0-9._-]+)\/?/ },
];

// ─── Normalizer ──────────────────────────────────────────────────────────────

export interface NormalizedIdentifier {
  /** The cleaned identifier ready for matching. */
  identifier: string;
  /** How the identifier was derived. */
  sourceType: 'raw' | 'url' | 'id';
}

/**
 * Normalize a social account identifier from an Excel/CSV cell.
 *
 * Steps:
 * 1. Trim whitespace
 * 2. Strip leading `@`
 * 3. Strip query string (`?...`) and fragment (`#...`)
 * 4. If it looks like a URL, extract the username/slug from known patterns
 * 5. Lowercase for comparison
 */
export function normalizeSocialIdentifier(
  raw: string,
  platform?: SocialPlatform,
): NormalizedIdentifier {
  let value = raw.trim();
  if (value === '') return { identifier: '', sourceType: 'raw' };

  // Strip query and fragment
  value = value.split('?')[0]!.split('#')[0]!;

  // Strip leading @
  value = value.replace(/^@/, '');

  // If it looks like a URL, try to extract slug
  if (/^https?:\/\//i.test(value)) {
    for (const { pattern, platforms } of PLATFORM_URL_PATTERNS) {
      // If platform-specific pattern, only match if platform matches
      if (platforms && platform && !platforms.includes(platform)) continue;
      const m = value.match(pattern);
      if (m && m[1]) {
        return { identifier: m[1].toLowerCase(), sourceType: 'url' };
      }
    }
    // Generic fallback: last path segment
    const segments = value.replace(/\/+$/, '').split('/');
    const last = segments[segments.length - 1];
    if (last && last !== '') {
      return { identifier: last.toLowerCase(), sourceType: 'url' };
    }
  }

  return { identifier: value.toLowerCase(), sourceType: 'raw' };
}

// ─── Matcher ─────────────────────────────────────────────────────────────────

/**
 * Match an import row's `account_identifier` to a single social account.
 *
 * Matching priority:
 *   1. account id        (exact, case-sensitive UUID)
 *   2. external id       (exact, case-sensitive)
 *   3. normalized username  (case-insensitive after normalization)
 *   4. normalized displayName (case-insensitive, nullable)
 *
 * The identifier is always scoped to the row's platform.
 * Never guesses across platforms.
 *
 * Returns a structured AccountMatchResult.
 */
export function matchImportRowToAccount(
  accounts: SocialAccount[],
  row: Pick<SocialMetricImportRow, 'accountIdentifier' | 'platform'>,
): AccountMatchResult {
  const { identifier } = normalizeSocialIdentifier(
    row.accountIdentifier,
    row.platform,
  );

  if (identifier === '') {
    return { status: 'empty' };
  }

  // Filter to platform-specific accounts
  const platformAccounts = accounts.filter((a) => a.platform === row.platform);
  if (platformAccounts.length === 0) {
    return { status: 'unmatched', normalizedIdentifier: identifier };
  }

  // Priority 1: exact id match (case-sensitive UUID)
  const idExact = platformAccounts.filter((a) => a.id === identifier);
  if (idExact.length === 1) {
    return { status: 'matched', accountId: idExact[0].id, account: idExact[0] };
  }
  if (idExact.length > 1) {
    return { status: 'ambiguous', candidates: idExact };
  }

  // Priority 2: exact externalId match (case-sensitive)
  const external = platformAccounts.filter(
    (a) => a.externalId != null && a.externalId === identifier,
  );
  if (external.length === 1) {
    return { status: 'matched', accountId: external[0].id, account: external[0] };
  }
  if (external.length > 1) {
    return { status: 'ambiguous', candidates: external };
  }

  // Priority 3: normalized username (case-insensitive)
  const byUsername = platformAccounts.filter(
    (a) => a.username.toLowerCase() === identifier,
  );
  if (byUsername.length === 1) {
    return { status: 'matched', accountId: byUsername[0].id, account: byUsername[0] };
  }
  if (byUsername.length > 1) {
    return { status: 'ambiguous', candidates: byUsername };
  }

  // Priority 4: normalized displayName (case-insensitive, nullable)
  const byDisplay = platformAccounts.filter(
    (a) => a.displayName != null && a.displayName.toLowerCase() === identifier,
  );
  if (byDisplay.length === 1) {
    return { status: 'matched', accountId: byDisplay[0].id, account: byDisplay[0] };
  }
  if (byDisplay.length > 1) {
    return { status: 'ambiguous', candidates: byDisplay };
  }

  return { status: 'unmatched', normalizedIdentifier: identifier };
}

// ─── Backward-compatible wrappers ────────────────────────────────────────────

/**
 * Legacy interface: wraps AccountMatchResult for backward compatibility
 * with existing preview/commit code.
 *
 * @deprecated Use matchImportRowToAccount() + AccountMatchResult instead.
 */
export function matchImportRowToAccountLegacy(
  accounts: SocialAccount[],
  row: Pick<SocialMetricImportRow, 'accountIdentifier' | 'platform'>,
): { account: SocialAccount } | { error: string } {
  const result = matchImportRowToAccount(accounts, row);
  switch (result.status) {
    case 'matched':
      return { account: result.account };
    case 'ambiguous':
      return { error: 'حساب یکتا پیدا نشد.' };
    case 'unmatched':
      return {
        error:
          'حسابی با این شناسه یافت نشد. (id، شناسهٔ خارجی، username یا نام حساب را بررسی کنید.)',
      };
    case 'empty':
      return { error: 'شناسهٔ حساب وارد نشده است.' };
  }
}

/** Build the preview list, matching every row against the accounts. */
export function matchRowsToAccounts(
  accounts: SocialAccount[],
  rows: SocialMetricImportRow[],
): Array<{
  row: SocialMetricImportRow;
  account: SocialAccount | null;
  matchError: string | null;
}> {
  return rows.map((row) => {
    const result = matchImportRowToAccountLegacy(accounts, row);
    if ('account' in result) {
      return { row, account: result.account, matchError: null };
    }
    return { row, account: null, matchError: result.error };
  });
}

/** Convenience type for a matched preview row. */
export type MatchedImportRow = ReturnType<typeof matchRowsToAccounts>[number];

/** Whether an account matches a platform (typed guard). */
export function platformOfAccount(
  account: SocialAccount,
  platform: SocialPlatform,
): boolean {
  return account.platform === platform;
}
