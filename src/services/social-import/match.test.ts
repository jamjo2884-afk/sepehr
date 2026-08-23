import { describe, it, expect } from 'vitest';
import {
  normalizeSocialIdentifier,
  matchImportRowToAccount,
} from '@/services/social-import/match';
import type { SocialAccount } from '@/types/social';

// ─── Test Accounts ───────────────────────────────────────────────────────────

const aparatAccounts: SocialAccount[] = [
  {
    id: 'acc-ap-001',
    brand: 'آزما',
    platform: 'aparat',
    username: 'azmaa_net',
    displayName: 'آزما نت',
    url: 'https://aparat.com/azmaa_net',
    externalId: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'acc-ap-002',
    brand: 'سینما',
    platform: 'aparat',
    username: 'cine.philiaoffical',
    displayName: 'سینما فیلیا',
    url: null,
    externalId: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'acc-ap-003',
    brand: 'فصل یازدهم',
    platform: 'aparat',
    username: 'fasle_11',
    displayName: 'فصل ۱۱',
    url: null,
    externalId: null,
    status: 'active',
    connectionStatus: 'disconnected',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '',
    updatedAt: '',
  },
];

// An Instagram account to verify platform scoping
const instagramAccount: SocialAccount = {
  id: 'acc-ig-001',
  brand: 'آزما',
  platform: 'instagram',
  username: 'azmaa_net',
  displayName: 'آزما',
  url: null,
  externalId: null,
  status: 'active',
  connectionStatus: 'disconnected',
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSuccessfulSyncAt: null,
  createdAt: '',
  updatedAt: '',
};

const allAccounts = [...aparatAccounts, instagramAccount];

// ─── normalizeSocialIdentifier ───────────────────────────────────────────────

describe('normalizeSocialIdentifier', () => {
  it('trims whitespace', () => {
    expect(normalizeSocialIdentifier('  azmaa_net  ').identifier).toBe('azmaa_net');
  });

  it('strips leading @', () => {
    expect(normalizeSocialIdentifier('@azmaa_net').identifier).toBe('azmaa_net');
  });

  it('lowercases', () => {
    expect(normalizeSocialIdentifier('AZMAA_NET').identifier).toBe('azmaa_net');
  });

  it('preserves trailing slash on plain username (only stripped from URLs)', () => {
    // Trailing slashes are only stripped when the input is a URL.
    // A plain username with a trailing slash keeps it as-is.
    expect(normalizeSocialIdentifier('azmaa_net/').identifier).toBe('azmaa_net/');
  });

  it('extracts username from Aparat URL', () => {
    expect(
      normalizeSocialIdentifier('https://www.aparat.com/azmaa_net', 'aparat').identifier,
    ).toBe('azmaa_net');
  });

  it('extracts username from Aparat URL with trailing slash', () => {
    expect(
      normalizeSocialIdentifier('https://aparat.com/azmaa_net/', 'aparat').identifier,
    ).toBe('azmaa_net');
  });

  it('extracts username from Aparat URL without www', () => {
    expect(
      normalizeSocialIdentifier('https://aparat.com/cine.philiaoffical', 'aparat').identifier,
    ).toBe('cine.philiaoffical');
  });

  it('returns sourceType url for URL input', () => {
    const result = normalizeSocialIdentifier('https://aparat.com/azmaa_net', 'aparat');
    expect(result.sourceType).toBe('url');
  });

  it('returns sourceType raw for plain username', () => {
    const result = normalizeSocialIdentifier('azmaa_net');
    expect(result.sourceType).toBe('raw');
  });

  it('handles URL with query string', () => {
    expect(
      normalizeSocialIdentifier('https://aparat.com/azmaa_net?ref=home', 'aparat').identifier,
    ).toBe('azmaa_net');
  });

  it('handles URL with fragment', () => {
    expect(
      normalizeSocialIdentifier('https://aparat.com/azmaa_net#section', 'aparat').identifier,
    ).toBe('azmaa_net');
  });

  it('returns empty for empty input', () => {
    expect(normalizeSocialIdentifier('').identifier).toBe('');
  });

  it('returns empty for whitespace-only input', () => {
    expect(normalizeSocialIdentifier('   ').identifier).toBe('');
  });
});

// ─── matchImportRowToAccount (Aparat) ────────────────────────────────────────

describe('matchImportRowToAccount — Aparat', () => {
  it('matches by exact username', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches @username', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: '@azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches USERNAME (case-insensitive)', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'AZMAA_NET',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches MixedCase username', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'AzMaa_Net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches Aparat URL to username', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'https://www.aparat.com/azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches Aparat URL without www', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'https://aparat.com/azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches Aparat URL with trailing slash', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'https://aparat.com/azmaa_net/',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('matches Aparat URL with www and trailing slash', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'https://www.aparat.com/cine.philiaoffical/',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-002');
    }
  });

  it('matches username with dot', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'cine.philiaoffical',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-002');
    }
  });

  it('matches by displayName', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'آزما نت',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe('acc-ap-001');
    }
  });

  it('returns unmatched for non-existent Aparat account', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'nonexistent_user',
      platform: 'aparat',
    });
    expect(result.status).toBe('unmatched');
    if (result.status === 'unmatched') {
      expect(result.normalizedIdentifier).toBe('nonexistent_user');
    }
  });

  it('returns unmatched for Aparat URL of non-existent account', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'https://aparat.com/nonexistent_user',
      platform: 'aparat',
    });
    expect(result.status).toBe('unmatched');
  });

  it('returns empty for empty identifier', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: '',
      platform: 'aparat',
    });
    expect(result.status).toBe('empty');
  });

  it('returns unmatched when no accounts exist for platform', () => {
    const result = matchImportRowToAccount([], {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('unmatched');
  });

  it('does NOT match across platforms (aparat username ≠ instagram username)', () => {
    // Only instagram accounts, looking for aparat username
    const result = matchImportRowToAccount([instagramAccount], {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('unmatched');
  });
});

// ─── Ambiguous matching ─────────────────────────────────────────────────────

describe('matchImportRowToAccount — Aparat ambiguous', () => {
  it('returns ambiguous when multiple Aparat accounts share a username', () => {
    const dupeAccounts: SocialAccount[] = [
      { ...aparatAccounts[0], id: 'acc-dupe-1', brand: 'مردمک' },
      { ...aparatAccounts[0], id: 'acc-dupe-2', brand: 'کبریت' },
    ];
    const result = matchImportRowToAccount(dupeAccounts, {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
    }
  });
});

// ─── Platform scoping ───────────────────────────────────────────────────────

describe('matchImportRowToAccount — platform scoping', () => {
  it('does not match aparat account when platform is instagram', () => {
    const result = matchImportRowToAccount(aparatAccounts, {
      accountIdentifier: 'azmaa_net',
      platform: 'instagram',
    });
    // No instagram accounts in aparatAccounts → unmatched
    expect(result.status).toBe('unmatched');
  });

  it('does not match instagram account when platform is aparat', () => {
    const result = matchImportRowToAccount([instagramAccount], {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    // No aparat accounts in [instagramAccount] → unmatched
    expect(result.status).toBe('unmatched');
  });
});

// ─── All Aparat identifiers from real import ────────────────────────────────

describe('matchImportRowToAccount — real Aparat import identifiers', () => {
  const realIdentifiers = [
    'azmaa_net',
    'cine.philiaoffical',
    'fasle_11',
    'darajee100',
    'kebritmedia',
    'rahbar_sevvom',
  ];

  it.each(realIdentifiers)('normalizes "%s" to lowercase', (id) => {
    const { identifier } = normalizeSocialIdentifier(id, 'aparat');
    expect(identifier).toBe(id.toLowerCase());
  });

  it('matches azmaa_net against the full account set', () => {
    const result = matchImportRowToAccount(allAccounts, {
      accountIdentifier: 'azmaa_net',
      platform: 'aparat',
    });
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.account.platform).toBe('aparat');
    }
  });
});
