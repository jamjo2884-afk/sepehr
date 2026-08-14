import { describe, expect, it } from 'vitest';
import { TelegramConnector } from './telegram';
import type { SocialAccount } from '@/types/social';

/**
 * LIVE test — hits the real Telegram Bot API.
 *
 * No credential exists in this environment, so we intentionally send an
 * INVALID token. A real 401 from api.telegram.org proves the full code
 * path works (URL building, fetch, JSON parse, error mapping) without
 * ever faking a success. When a real SOCIAL_TELEGRAM_BOT_TOKEN is added
 * to the server env, this same connector is exercised by the sync route.
 */
describe('TelegramConnector live (invalid token → real error)', () => {
  it('verifyConnection returns a real API error for a bad token', async () => {
    const connector = new TelegramConnector();
    const account = {
      id: 'test-account',
      brand: 'test',
      platform: 'telegram',
      username: 'fasle_11',
      displayName: null,
      url: null,
      status: 'active',
      connectionStatus: 'disconnected',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSuccessfulSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SocialAccount;

    const result = await connector.verifyConnection({
      credential: {
        platform: 'telegram',
        kind: 'bot-token',
        secret: '123456:INVALID_TOKEN_FOR_LIVE_TEST',
      },
      account,
      now: new Date(),
    });      // Must be a REAL failure (401 Unauthorized from Telegram), never ok.
      expect(result.ok).toBe(false);
      // 401 is mapped to a structured, safe code by telegramError().
      expect(result.errorCode).toBe('invalid_credential');
      // The raw message may contain Telegram's description but never the
      // token itself (the sanitizer removes it before it reaches logs/UI).
      expect(result.errorMessage).not.toContain('INVALID_TOKEN_FOR_LIVE_TEST');
  }, 30_000);
});
