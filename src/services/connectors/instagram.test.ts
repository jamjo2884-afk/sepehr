import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConnector } from './registry';
import { InstagramConnector, instagramError } from './instagram';
import { HttpError } from './utils';
import type { SocialAccount } from '@/types/social';

function igAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: 'acc-1',
    brand: 'تست',
    platform: 'instagram',
    username: 'test_brand',
    displayName: null,
    url: null,
    externalId: '17841400000000000',
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Instagram connector — registry & capabilities', () => {
  it('resolveConnector("instagram") returns the Instagram connector', () => {
    const connector = resolveConnector('instagram');
    expect(connector).toBeInstanceOf(InstagramConnector);
    expect(connector?.capabilities.auth).toContain('oauth');
  });

  it('declares honest capabilities — no deprecated impressions', () => {
    const connector = resolveConnector('instagram');
    const fields = connector?.capabilities.metricFields ?? [];
    expect(fields).toContain('followers');
    expect(fields).toContain('reach');
    expect(fields).toContain('views');
    // impressions was deprecated in v22.0 (April 2025) — must not be emitted.
    expect(fields).not.toContain('impressions');
    expect(connector?.capabilities.content).toBe(true);
    expect(connector?.capabilities.contentMetrics).toBe(true);
    expect(connector?.capabilities.pagination).toBe('cursor');
  });
});

describe('Instagram connector — normalization', () => {
  it('maps Graph API fields + insights to MediaOS values (null when missing)', async () => {
    const connector = new InstagramConnector();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/insights')) {
        return jsonResponse({
          data: [
            { name: 'reach', total_value: { value: 500 } },
            { name: 'views', total_value: { value: 700 } },
          ],
        });
      }
      return jsonResponse({
        followers_count: 1000,
        follows_count: 50,
        media_count: 42,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await connector.fetchAccountMetrics(
      {
        credential: { platform: 'instagram', kind: 'oauth', secret: 'tok' },
        account: igAccount(),
        now: new Date('2026-08-14T12:00:00Z'),
      },
      'daily',
    );
    expect(result).toHaveLength(1);
    expect(result[0].values.followers).toBe(1000);
    expect(result[0].values.following).toBe(50);
    expect(result[0].values.posts).toBe(42);
    expect(result[0].values.reach).toBe(500);
    expect(result[0].values.views).toBe(700);
    // Insights the API did not return stay null — never 0.
    expect(result[0].values.likes).toBeNull();
    expect(result[0].values.comments).toBeNull();
    expect(result[0].values.shares).toBeNull();
    expect(result[0].values.saves).toBeNull();
    expect(result[0].periodLabel).toBeTruthy();
  });

  it('keeps metrics null when the API returns an empty insights set', async () => {
    const connector = new InstagramConnector();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/insights')
          ? jsonResponse({ data: [] })
          : jsonResponse({ followers_count: 2000 }),
      ),
    );
    const result = await connector.fetchAccountMetrics(
      {
        credential: { platform: 'instagram', kind: 'oauth', secret: 'tok' },
        account: igAccount(),
        now: new Date(),
      },
      'daily',
    );
    expect(result[0].values.followers).toBe(2000);
    expect(result[0].values.reach).toBeNull();
    expect(result[0].values.views).toBeNull();
  });
});

describe('Instagram connector — error handling', () => {
  it('maps token expiry to a structured code', () => {
    const result = instagramError(new HttpError(190, 'HTTP 190'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('token_expired');
  });

  it('maps OAuth/400 failures to invalid_credential', () => {
    const result = instagramError(new HttpError(400, 'HTTP 400'));
    expect(result.errorCode).toBe('invalid_credential');
  });

  it('maps permission failures', () => {
    const result = instagramError(new HttpError(10, 'HTTP 10'));
    expect(result.errorCode).toBe('permission_denied');
  });

  it('verifyConnection returns a real error when the API rejects the token', async () => {
    const connector = new InstagramConnector();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 400, message: 'Invalid OAuth access token' } },
          400,
        ),
      ),
    );
    const result = await connector.verifyConnection({
      credential: { platform: 'instagram', kind: 'oauth', secret: 'bad-token' },
      account: igAccount({ externalId: null }),
      now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('invalid_credential');
    expect(result.errorMessage).not.toContain('bad-token');
  });
});
