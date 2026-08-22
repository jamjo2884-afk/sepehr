import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  rowsToImportRows,
  isExcelFile,
  IMPORT_MAX_FILE_BYTES,
} from '@/services/social-import/parse';
import {
  normalizePlatform,
  normalizePeriod,
  normalizePeriodLabel,
  parseImportNumber,
  headerToMetricKey,
} from '@/services/social-import/normalize';
import {
  buildCsvTemplate,
  buildXlsxTemplate,
} from '@/services/social-import/template';
import { matchImportRowToAccount } from '@/services/social-import/match';
import type { SocialAccount } from '@/types/social';

const CSV_HEADER =
  'platform,account_identifier,period,period_label,followers,views,likes';

describe('parseCsv', () => {
  it('parses a basic CSV', () => {
    const rows = parseCsv('platform,account_identifier\ninstagram,@azmaa\n');
    expect(rows).toEqual([
      ['platform', 'account_identifier'],
      ['instagram', '@azmaa'],
    ]);
  });

  it('strips a UTF-8 BOM', () => {
    const rows = parseCsv('\uFEFFplatform,followers\ninstagram,10\n');
    expect(rows[0][0]).toBe('platform');
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('a,b\n"hello, world","say ""hi"""\n');
    expect(rows[1]).toEqual(['hello, world', 'say "hi"']);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('detects semicolon delimiter for Persian Excel exports', () => {
    const rows = parseCsv('platform;followers\ninstagram;125000\n');
    expect(rows[1]).toEqual(['instagram', '125000']);
  });
});

describe('normalize helpers', () => {
  it('parses Persian/Arabic digits and thousands separators', () => {
    expect(parseImportNumber('۱۲۵,۰۰۰')).toBe(125000);
    expect(parseImportNumber('١٢٥٠٠٠')).toBe(125000);
    expect(parseImportNumber('125000')).toBe(125000);
    expect(parseImportNumber('1,250,000')).toBe(1250000);
    expect(parseImportNumber('')).toBeNull();
    expect(parseImportNumber('   ')).toBeNull();
    expect(() => parseImportNumber('abc')).toThrow();
    expect(() => parseImportNumber('-5')).toThrow();
  });

  it('normalizes platform names (Latin + Persian)', () => {
    expect(normalizePlatform('instagram')).toBe('instagram');
    expect(normalizePlatform('Instagram')).toBe('instagram');
    expect(normalizePlatform('اینستاگرام')).toBe('instagram');
    expect(normalizePlatform('تلگرام')).toBe('telegram');
    expect(normalizePlatform('x')).toBe('twitter');
    expect(normalizePlatform('بله')).toBe('bale');
    expect(normalizePlatform('aparat')).toBe('aparat');
    expect(normalizePlatform('threads')).toBe('threads');
    expect(normalizePlatform('splus')).toBe('soroushplus');
    expect(normalizePlatform('unknown')).toBeNull();
  });

  it('normalizes periods', () => {
    expect(normalizePeriod('monthly')).toBe('monthly');
    expect(normalizePeriod('ماهانه')).toBe('monthly');
    expect(normalizePeriod('weekly')).toBe('weekly');
    expect(normalizePeriod('daily')).toBe('daily');
    expect(normalizePeriod('nope')).toBeNull();
  });

  it('normalizes monthly labels including Persian month names', () => {
    expect(normalizePeriodLabel('monthly', '1405-05')).toBe('1405-05');
    expect(normalizePeriodLabel('monthly', 'مرداد ۱۴۰۵')).toBe('1405-05');
    expect(normalizePeriodLabel('monthly', 'مرداد 1405')).toBe('1405-05');
    expect(() => normalizePeriodLabel('monthly', '1405')).toThrow();
  });

  it('normalizes daily and weekly labels', () => {
    expect(normalizePeriodLabel('daily', '1405-05-23')).toBe('1405-05-23');
    expect(normalizePeriodLabel('daily', '۱۴۰۵-۰۵-۲۳')).toBe('1405-05-23');
    expect(() => normalizePeriodLabel('daily', '23/05/1405')).toThrow();
    expect(normalizePeriodLabel('weekly', '1405-W33')).toBe('1405-W33');
    expect(() => normalizePeriodLabel('weekly', '1405')).toThrow();
  });

  it('maps headers to metric keys (snake, camel, Persian)', () => {
    expect(headerToMetricKey('followers')).toBe('followers');
    expect(headerToMetricKey('engagement_rate')).toBe('engagementRate');
    expect(headerToMetricKey('story_views')).toBe('storyViews');
    expect(headerToMetricKey('نرخ تعامل')).toBe('engagementRate');
    expect(headerToMetricKey('اعضای کانال')).toBe('channelMembers');
    expect(headerToMetricKey('not-a-metric')).toBeNull();
  });
});

describe('rowsToImportRows', () => {
  it('validates a well-formed CSV', () => {
    const result = rowsToImportRows(
      parseCsv(
        `${CSV_HEADER}\ninstagram,@azmaa,monthly,1405-05,125000,450000,12000\n`,
      ),
    );
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.platform).toBe('instagram');
    expect(row.accountIdentifier).toBe('azmaa');
    expect(row.period).toBe('monthly');
    expect(row.periodLabel).toBe('1405-05');
    expect(row.values.followers).toBe(125000);
    expect(row.values.views).toBe(450000);
    expect(row.errors).toEqual([]);
  });

  it('reports a missing required column', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period\ninstagram,@azmaa,monthly\n',
      ),
    );
    expect(result.fileErrors.length).toBeGreaterThan(0);
    expect(result.rows).toEqual([]);
  });

  it('rejects an empty file', () => {
    const result = rowsToImportRows([]);
    expect(result.fileErrors).toContain('فایل خالی است.');
  });

  it('flags invalid platform, period and negative numbers', () => {
    const result = rowsToImportRows(
      parseCsv(
        `${CSV_HEADER}\nunknown,@azmaa,monthly,1405-05,125000\ninstagram,@azmaa,weird,1405-05,125000\ninstagram,@azmaa,monthly,1405-05,-5\n`,
      ),
    );
    expect(result.rows[0].errors.some((e) => e.includes('platform'))).toBe(
      true,
    );
    expect(result.rows[1].errors.some((e) => e.includes('period'))).toBe(true);
    expect(result.rows[2].errors.some((e) => e.includes('منفی'))).toBe(true);
  });

  it('skips unsupported metrics silently for the platform', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,story_views\ninstagram,@azmaa,monthly,1405-05,5000\n',
      ),
    );
    // story_views IS valid for instagram — should pass.
    expect(result.rows[0].errors).toEqual([]);

    // story_views is NOT valid for telegram — should be skipped silently.
    const result2 = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,story_views\ntelegram,@channel,monthly,1405-05,5000\n',
      ),
    );
    expect(result2.rows[0].values.storyViews).toBeUndefined();
    expect(result2.rows[0].errors).toEqual([]);
  });

  it('accepts Persian month names as period_label', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\ninstagram,@azmaa,monthly,مرداد ۱۴۰۵,125000\n',
      ),
    );
    expect(result.rows[0].periodLabel).toBe('1405-05');
    expect(result.rows[0].errors).toEqual([]);
  });

  it('accepts Persian digits in numbers', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\ninstagram,@azmaa,monthly,1405-05,۱۲۵۰۰۰\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(125000);
  });

  // ── Universal followers import mapping ──────────────────────────────

  it('maps followers → followers for Instagram', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\ninstagram,@azmaa,monthly,1405-05,1000\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(1000);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → followers for Twitter', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\ntwitter,@handle,monthly,1405-05,2000\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(2000);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → followers for Threads', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nthreads,@handle,monthly,1405-05,3000\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(3000);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → channelMembers for Telegram', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\ntelegram,@channel,monthly,1405-05,25000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(25000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → channelMembers for Bale', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nbale,@channel,monthly,1405-05,8000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(8000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → channelMembers for Eitaa', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\neita,@channel,monthly,1405-05,5000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(5000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → channelMembers for Rubika', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nrubika,@channel,monthly,1405-05,7000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(7000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → channelMembers for SoroushPlus', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nsoroushplus,@channel,monthly,1405-05,6000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(6000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → subscribers for YouTube', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nyoutube,@channel,monthly,1405-05,1000\n',
      ),
    );
    expect(result.rows[0].values.subscribers).toBe(1000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('maps followers → followers for Aparat', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\naparat,@channel,monthly,1405-05,4000\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(4000);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('YouTube: explicit subscribers takes precedence over followers', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers,subscribers\nyoutube,@channel,monthly,1405-05,1000,2000\n',
      ),
    );
    expect(result.rows[0].values.subscribers).toBe(2000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('Telegram: explicit channelMembers takes precedence over followers', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers,channel_members\ntelegram,@channel,monthly,1405-05,1000,2000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(2000);
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].errors).toEqual([]);
  });

  it('empty followers does not produce any audience field', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers,views\ntelegram,@channel,monthly,1405-05,,400000\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBeUndefined();
    expect(result.rows[0].values.followers).toBeUndefined();
    expect(result.rows[0].values.views).toBe(400000);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('unknown platform does not remap followers', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers\nunknown,@handle,monthly,1405-05,1000\n',
      ),
    );
    // unknown platform → errors include platform error, followers is skipped
    expect(result.rows[0].errors.some((e) => e.includes('platform'))).toBe(true);
  });

  it('does not affect other metric columns', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers,views,likes,comments\ninstagram,@azmaa,monthly,1405-05,1000,50000,3000,200\n',
      ),
    );
    expect(result.rows[0].values.followers).toBe(1000);
    expect(result.rows[0].values.views).toBe(50000);
    expect(result.rows[0].values.likes).toBe(3000);
    expect(result.rows[0].values.comments).toBe(200);
    expect(result.rows[0].errors).toEqual([]);
  });

  it('Telegram: followers + views + likes all map correctly', () => {
    const result = rowsToImportRows(
      parseCsv(
        'platform,account_identifier,period,period_label,followers,views,likes\ntelegram,@channel,monthly,1405-05,25000,400000,1800\n',
      ),
    );
    expect(result.rows[0].values.channelMembers).toBe(25000);
    expect(result.rows[0].values.views).toBe(400000);
    expect(result.rows[0].values.likes).toBe(1800);
    expect(result.rows[0].errors).toEqual([]);
  });
});

describe('templates', () => {
  it('builds a CSV template with BOM and headers', () => {
    const csv = buildCsvTemplate();
    expect(csv.startsWith('\uFEFFplatform,account_identifier')).toBe(true);
    expect(csv).toContain('@example');
  });

  it('builds an xlsx template buffer', async () => {
    const buf = await buildXlsxTemplate();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});

describe('matchImportRowToAccount', () => {
  const accounts: SocialAccount[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      brand: 'ازما',
      platform: 'instagram',
      username: 'azmaa',
      displayName: 'ازما',
      url: null,
      externalId: null,
      status: 'active',
      createdAt: '',
      updatedAt: '',
      connectionStatus: 'disconnected',
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSuccessfulSyncAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      brand: 'تلگرام ازما',
      platform: 'telegram',
      username: 'azmaa_channel',
      displayName: 'کانال ازما',
      url: null,
      externalId: '123456789',
      status: 'active',
      createdAt: '',
      updatedAt: '',
      connectionStatus: 'connected',
      lastSyncAt: null,
      lastSyncStatus: 'success',
      lastSuccessfulSyncAt: null,
    },
  ];

  it('matches by username (case-insensitive, @ stripped)', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: '@AZMAA',
      platform: 'instagram',
    });
    expect('account' in r && r.account.id).toBe(accounts[0].id);
  });

  it('matches by external id', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: '123456789',
      platform: 'telegram',
    });
    expect('account' in r && r.account.id).toBe(accounts[1].id);
  });

  it('matches by account id', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: '00000000-0000-0000-0000-000000000001',
      platform: 'instagram',
    });
    expect('account' in r && r.account.id).toBe(accounts[0].id);
  });

  it('matches by display name', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: 'کانال ازما',
      platform: 'telegram',
    });
    expect('account' in r && r.account.id).toBe(accounts[1].id);
  });

  it('rejects when no account matches', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: 'nobody',
      platform: 'instagram',
    });
    expect('error' in r).toBe(true);
  });

  it('rejects ambiguous matches on the same platform', () => {
    const dup = [
      ...accounts,
      { ...accounts[0], id: '00000000-0000-0000-0000-000000000099' },
    ];
    const r = matchImportRowToAccount(dup, {
      accountIdentifier: 'azmaa',
      platform: 'instagram',
    });
    expect('error' in r && r.error).toContain('یکتا');
  });

  it('never matches across platforms by guessing', () => {
    const r = matchImportRowToAccount(accounts, {
      accountIdentifier: 'azmaa',
      platform: 'telegram',
    });
    expect('error' in r).toBe(true);
  });
});

describe('isExcelFile / size', () => {
  it('detects Excel extensions', () => {
    expect(isExcelFile('data.xlsx')).toBe(true);
    expect(isExcelFile('data.xls')).toBe(true);
    expect(isExcelFile('data.csv')).toBe(false);
  });

  it('exposes the max size', () => {
    expect(IMPORT_MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});
