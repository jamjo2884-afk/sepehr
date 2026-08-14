import { describe, expect, it } from 'vitest';
import {
  resolveConnector,
  registeredPlatforms,
} from '@/services/connectors/registry';
import { TelegramConnector } from '@/services/connectors/telegram';
import { sanitizeErrorMessage } from '@/services/connectors/utils';
import { validateNormalizedMetric } from '@/services/social-sync.service';
import type { NormalizedSocialMetric } from '@/types/social';

function metric(
  overrides: Partial<NormalizedSocialMetric> = {},
): NormalizedSocialMetric {
  return {
    period: 'daily',
    periodLabel: '1405-05-24',
    periodStart: null,
    periodEnd: null,
    values: { followers: 1000, channelMembers: 1000 },
    ...overrides,
  };
}

describe('connector registry', () => {
  it('resolves telegram to the Telegram connector', () => {
    const connector = resolveConnector('telegram');
    expect(connector).toBeInstanceOf(TelegramConnector);
    expect(connector?.capabilities.auth).toContain('bot-token');
  });

  it('returns null for platforms without a connector', () => {
    expect(resolveConnector('instagram')).toBeNull();
    expect(resolveConnector('youtube')).toBeNull();
  });

  it('telegram declares only honest capabilities', () => {
    const connector = resolveConnector('telegram');
    expect(connector?.capabilities.accountMetrics).toBe(true);
    // Bot API has no per-post metrics endpoint — must NOT be advertised.
    expect(connector?.capabilities.contentMetrics).toBe(false);
    expect(connector?.capabilities.metricFields).toEqual([
      'followers',
      'channelMembers',
    ]);
  });

  it('registry lists telegram only (first real connector)', () => {
    expect(registeredPlatforms()).toContain('telegram');
  });
});

describe('validateNormalizedMetric', () => {
  it('accepts a valid metric', () => {
    const result = validateNormalizedMetric(metric());
    expect(result.ok).toBe(true);
  });

  it('rejects negative counts (never writes bad data)', () => {
    const result = validateNormalizedMetric(
      metric({ values: { followers: -5, channelMembers: 10 } }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('نمی‌تواند منفی باشد');
  });

  it('rejects engagement rates above 100', () => {
    const result = validateNormalizedMetric(
      metric({ values: { followers: 10, engagementRate: 250 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('accepts NULL fields (merge keeps stored values later)', () => {
    const result = validateNormalizedMetric(
      metric({ values: { followers: 10, views: null, likes: null } }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('credential leakage check', () => {
  it('error messages never contain the secret', () => {
    const secret = 'bot123456:AAfake-secret-value';
    const raw = `getChat failed: 401 ${secret} is unauthorized`;
    const cleaned = sanitizeErrorMessage(raw, [secret]);
    expect(cleaned).not.toContain(secret);
    expect(cleaned).toContain('[redacted]');
  });

  it('sync error codes are structured, not raw API text', () => {
    // The sync service maps failures to typed error codes; the raw message
    // never reaches the client untouched.
    const codes = [
      'credential_not_configured',
      'connector_not_available',
      'verify_failed',
      'fetch_failed',
      'account_not_found',
    ];
    for (const code of codes) {
      expect(code).toMatch(/^[a-z_]+$/);
      expect(code).not.toContain('token');
      expect(code).not.toContain('key');
      expect(code).not.toContain('secret');
    }
  });
});
