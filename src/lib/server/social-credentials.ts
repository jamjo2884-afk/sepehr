import type { SocialPlatform } from '@/types/domain';
import type {
  SocialCredential,
  SocialCredentialKind,
} from '@/services/connectors/types';

/**
 * Server-only credential resolution.
 *
 * Every platform secret lives in a server-side environment variable and is
 * resolved HERE — never stored in the database, never sent to the client,
 * never logged. If the variable is missing, the resolver returns null and
 * the sync flow reports a clear `credential_not_configured` error instead
 * of faking a connection.
 *
 * Env variables (add to the server / Vercel project):
 *   SOCIAL_TELEGRAM_BOT_TOKEN   — Telegram Bot API token (bot123:ABC...)
 *   INSTAGRAM_ACCESS_TOKEN      — Instagram Graph API token (Facebook
 *                                 User/System User token with
 *                                 instagram_basic + instagram_manage_insights)
 *
 * This module must only be imported from server code (API routes). It is
 * never imported by client components.
 */

const ENV_BY_PLATFORM: Partial<
  Record<SocialPlatform, { varName: string; kind: SocialCredentialKind }>
> = {
  telegram: { varName: 'SOCIAL_TELEGRAM_BOT_TOKEN', kind: 'bot-token' },
  instagram: { varName: 'INSTAGRAM_ACCESS_TOKEN', kind: 'oauth' },
};

/** Resolve the credential for a platform, or null when not configured. */
export function getPlatformCredential(
  platform: SocialPlatform,
): SocialCredential | null {
  const config = ENV_BY_PLATFORM[platform];
  if (!config) return null;
  const secret = process.env[config.varName];
  if (!secret || secret.trim() === '') return null;
  return { platform, kind: config.kind, secret: secret.trim() };
}

/** Whether a platform has a credential configured on this server. */
export function isPlatformCredentialConfigured(
  platform: SocialPlatform,
): boolean {
  return getPlatformCredential(platform) !== null;
}

/** The env var name for a platform (for setup docs / admin UI). */
export function credentialEnvVar(platform: SocialPlatform): string | null {
  return ENV_BY_PLATFORM[platform]?.varName ?? null;
}
