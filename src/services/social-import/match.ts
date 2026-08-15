import type { SocialAccount } from '@/types/social';
import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricImportRow } from '@/services/social-import/types';

/**
 * Resolve an import row's `account_identifier` to a single social account.
 *
 * Matching priority (from the phase spec):
 *   1. account id        (exact uuid)
 *   2. external id       (the platform's own id, never guessed)
 *   3. username / handle (case-insensitive, '@' stripped)
 *   4. display name      (case-insensitive)
 *
 * The identifier is always scoped to the row's platform: an identifier that
 * matches accounts on several platforms is NOT resolved by cross-platform
 * guessing — if it still matches more than one account on the row's
 * platform, that's an ambiguity error.
 *
 * Returns `{ account }` on a unique match, or `{ error }` (Persian) when
 * nothing matched or the match was ambiguous. Never guesses.
 */
export function matchImportRowToAccount(
  accounts: SocialAccount[],
  row: Pick<SocialMetricImportRow, 'accountIdentifier' | 'platform'>,
): { account: SocialAccount } | { error: string } {
  // Strip a leading '@' so '@azmaa' and 'azmaa' match the same account.
  const identifier = row.accountIdentifier.trim().replace(/^@/, '');
  if (identifier === '') {
    return { error: 'شناسهٔ حساب وارد نشده است.' };
  }
  const platformAccounts = accounts.filter((a) => a.platform === row.platform);
  if (platformAccounts.length === 0) {
    return { error: 'حسابی برای این پلتفرم یافت نشد.' };
  }

  const idExact = platformAccounts.filter((a) => a.id === identifier);
  if (idExact.length === 1) return { account: idExact[0] };
  if (idExact.length > 1) return { error: 'حساب یکتا پیدا نشد.' };

  const external = platformAccounts.filter(
    (a) => a.externalId != null && a.externalId === identifier,
  );
  if (external.length === 1) return { account: external[0] };
  if (external.length > 1) return { error: 'حساب یکتا پیدا نشد.' };

  const lower = identifier.toLowerCase();
  const byUsername = platformAccounts.filter(
    (a) => a.username.toLowerCase() === lower,
  );
  if (byUsername.length === 1) return { account: byUsername[0] };
  if (byUsername.length > 1) return { error: 'حساب یکتا پیدا نشد.' };

  const byDisplay = platformAccounts.filter(
    (a) => a.displayName != null && a.displayName.toLowerCase() === lower,
  );
  if (byDisplay.length === 1) return { account: byDisplay[0] };
  if (byDisplay.length > 1) return { error: 'حساب یکتا پیدا نشد.' };

  return {
    error:
      'حسابی با این شناسه یافت نشد. (id، شناسهٔ خارجی، username یا نام حساب را بررسی کنید.)',
  };
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
    const result = matchImportRowToAccount(accounts, row);
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
