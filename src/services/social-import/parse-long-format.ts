import { toLatinDigits } from '@/utils/persian';
import { PERSIAN_MONTHS } from '@/constants/ui.constants';
import { normalizePlatform, normalizePeriod } from '@/services/social-import/normalize';
import type { SocialPlatform } from '@/types/domain';
import type { SocialMetricPeriod, SocialMetricValues } from '@/types/social';
import type { SocialMetricImportRow, SocialImportParseResult } from '@/services/social-import/types';

/**
 * Parse a raw long-format Excel/CSV (e.g. "گزارش ماهیانه سپهر.xlsx").
 *
 * Expected columns (order doesn't matter — matched by header name):
 *   brand | platform | username | metric_type | value | date | period | period_label
 *
 * Headers are matched case-insensitively with these aliases:
 *   - brand:     برند, brand, برند/سازمان
 *   - platform:  پلتفرم, platform
 *   - username:  username, نام_کاربری, حساب
 *   - metric:    metric_type, metric, نوع_آمار, شاخص
 *   - value:     value, مقدار, تعداد
 *   - date:      date, تاریخ
 *   - period:    period, دوره
 *   - period_label: period_label, label, ماه, برچسب
 *
 * The parser groups rows by (platform, username, period_label) and pivots
 * metric_type values into the standard wide-format metric columns.
 *
 * metric_type aliases:
 *   Follower / فالوور / دنبال‌کننده → followers
 *   Reach / ریچ → reach
 *   View / بازدید / ویو → views
 *   Like / لایک → likes
 *   Comment / کامنت / نظر → comments
 *   Share / اشتراک → shares
 *   Post / پست / محتوا → posts
 *   Subscriber / سابسکرایبر → subscribers (YouTube)
 *   Members / اعضا / اعضای کانال → channelMembers
 *   Impression / نمایش → impressions
 *   Saving / ذخیره → saves
 *   Retweet / بازتوییت → retweets
 */

const METRIC_TYPE_ALIASES: Record<string, keyof SocialMetricValues> = {
  // English
  follower: 'followers',
  followers: 'followers',
  reach: 'reach',
  view: 'views',
  views: 'views',
  like: 'likes',
  likes: 'likes',
  comment: 'comments',
  comments: 'comments',
  share: 'shares',
  shares: 'shares',
  post: 'posts',
  posts: 'posts',
  subscriber: 'subscribers',
  subscribers: 'subscribers',
  members: 'channelMembers',
  'channel_members': 'channelMembers',
  impression: 'impressions',
  impressions: 'impressions',
  saving: 'saves',
  saves: 'saves',
  retweet: 'retweets',
  retweets: 'retweets',
  engagement_rate: 'engagementRate',
  engagementrate: 'engagementRate',
  // Persian
  فالوور: 'followers',
  دنبال‌کننده: 'followers',
  دنبالکننده: 'followers',
  ریچ: 'reach',
  'ریچ (reach)': 'reach',
  بازدید: 'views',
  ویو: 'views',
  لایک: 'likes',
  کامنت: 'comments',
  نظر: 'comments',
  اشتراک: 'shares',
  اشتراک‌گذاری: 'shares',
  پست: 'posts',
  محتوا: 'posts',
  سابسکرایبر: 'subscribers',
  سابسکرایبرها: 'subscribers',
  اعضا: 'channelMembers',
  'اعضای کانال': 'channelMembers',
  نمایش: 'impressions',
  ذخیره: 'saves',
  بازتوییت: 'retweets',
  'نرخ تعامل': 'engagementRate',
  'نرخ‌تعامل': 'engagementRate',
};

// ─── Header matching ────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string[]> = {
  brand: ['brand', 'برند', 'برند/سازمان', 'سازمان'],
  platform: ['platform', 'پلتفرم', 'شبکه', 'سکو', 'سکوها'],
  username: ['username', 'نام_کاربری', 'حساب', 'account', 'identifier', 'شناسه'],
  metricType: ['metric_type', 'metric', 'نوع_آمار', 'شاخص', 'نوع', 'type'],
  value: ['value', 'مقدار', 'تعداد', 'amount'],
  date: ['date', 'تاریخ'],
  period: ['period', 'دوره'],
  periodLabel: [
    'period_label', 'label', 'ماه', 'برچسب', 'برچسب_دوره',
    'month', // The raw Excel has a 'month' column with YYYY-MM
  ],
  status: ['status', 'وضعیت', 'حالت'],
  link: ['link', 'لینک', 'url', 'آدرس'],
};

function findColumnIndex(
  headerLower: string[],
  aliases: string[],
): number {
  return headerLower.findIndex((h) => {
    const clean = h.replace(/[\s\u00A0]/g, '');
    return aliases.some((a) => clean === a);
  });
}

// ─── Period label normalization ──────────────────────────────────────────────

/**
 * Try to extract a YYYY-MM period label from a date string.
 * Handles:
 *   - Direct "1404-08" format
 *   - Persian month name + year: "مرداد ۱۴۰۴" → "1404-08"
 *   - Numeric month: "1404/08" or "1404-08"
 */
function extractPeriodLabel(raw: string): string | null {
  const value = toLatinDigits(raw).trim();
  if (value === '') return null;

  // Direct YYYY-MM format
  const direct = value.match(/^(\d{4})-(\d{2})$/);
  if (direct) return `${direct[1]}-${direct[2]}`;

  // Slash-separated: "1404/08"
  const slash = value.match(/^(\d{4})\/(\d{2})$/);
  if (slash) return `${slash[1]}-${slash[2]}`;

  // Persian month name + year: "مرداد ۱۴۰۴" / "مرداد 1404"
  const fa = value.match(/^([\u0600-\u06FF]+)\s*(\d{4})$/);
  if (fa) {
    const monthIndex = PERSIAN_MONTHS.findIndex(
      (m) => toLatinDigits(m) === toLatinDigits(fa[1]),
    );
    if (monthIndex >= 0) {
      return `${fa[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
  }

  return null;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse a long-format matrix (rows of cells) into import rows.
 *
 * Each source row produces one metric value; the parser pivots these into
 * wide-format `SocialMetricImportRow` objects grouped by
 * (platform, username, period_label).
 */
export function rowsToLongFormatImportRows(
  matrix: string[][],
): SocialImportParseResult {
  const fileErrors: string[] = [];
  if (matrix.length < 2) {
    return { rows: [], fileErrors: ['فایل خالی است یا فقط شامل هدر است.'] };
  }

  // ── 1. Match headers ──────────────────────────────────────────────────
  const header = matrix[0].map((c) => c.trim());
  const headerLower = header.map((c) =>
    c.replace(/[\s\u00A0]/g, '').toLowerCase(),
  );

  const colBrand = findColumnIndex(headerLower, HEADER_ALIASES.brand);
  const colPlatform = findColumnIndex(headerLower, HEADER_ALIASES.platform);
  const colUsername = findColumnIndex(headerLower, HEADER_ALIASES.username);
  const colMetricType = findColumnIndex(headerLower, HEADER_ALIASES.metricType);
  const colValue = findColumnIndex(headerLower, HEADER_ALIASES.value);
  const colDate = findColumnIndex(headerLower, HEADER_ALIASES.date);
  const colPeriod = findColumnIndex(headerLower, HEADER_ALIASES.period);
  const colPeriodLabel = findColumnIndex(headerLower, HEADER_ALIASES.periodLabel);
  const colStatus = findColumnIndex(headerLower, HEADER_ALIASES.status);
  const colLink = findColumnIndex(headerLower, HEADER_ALIASES.link);

  const missing: string[] = [];
  if (colBrand < 0) missing.push('brand');
  if (colPlatform < 0) missing.push('platform');
  if (colUsername < 0) missing.push('username');
  if (colMetricType < 0) missing.push('metric_type');
  if (colValue < 0) missing.push('value');
  if (colPeriodLabel < 0 && colDate < 0) missing.push('period_label / date');

  // If 'ماه' and 'month' both exist, prefer the YYYY-MM 'month' column
  // for period_label (it's already normalized).
  const periodLabelCol = (() => {
    // Check if there's a column literally named 'month' (YYYY-MM)
    const monthIdx = headerLower.findIndex((h) => h === 'month');
    if (monthIdx >= 0) return monthIdx;
    return colPeriodLabel;
  })();

  if (missing.length > 0) {
    return {
      rows: [],
      fileErrors: [
        `ستون‌های ضروری در فایل وجود ندارد: ${missing.join('، ')}. ` +
          `ستون‌های موجود: ${header.join(', ')}`,
      ],
    };
  }

  // ── 2. Group by (platform, username, period_label) ─────────────────────
  interface GroupedRow {
    brand: string;
    platform: SocialPlatform | null;
    username: string;
    period: SocialMetricPeriod;
    periodLabel: string;
    values: SocialMetricValues;
    rowNumbers: number[];
  }

  const groups = new Map<string, GroupedRow>();
  const groupErrors: Array<{ rowNumber: number; message: string }> = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const rowNumber = r + 1;
    const cellAt = (i: number): string => (i >= 0 ? (cells[i] ?? '').trim() : '');

    const brand = cellAt(colBrand);
    const platformRaw = cellAt(colPlatform);
    const username = cellAt(colUsername);
    const metricTypeRaw = cellAt(colMetricType);
    const valueRaw = cellAt(colValue);

    // Skip completely empty rows
    if (!brand && !platformRaw && !username) continue;

    // Platform validation
    const platform = normalizePlatform(platformRaw);
    if (!platform) {
      groupErrors.push({
        rowNumber,
        message: platformRaw
          ? `پلتفرم «${platformRaw}» نامعتبر است.`
          : `پلتفرم در ردیف ${rowNumber} وارد نشده.`,
      });
      continue;
    }

    // Period label — prefer the YYYY-MM 'month' column, then 'ماه', then 'تاریخ'
    let periodLabel = '';
    if (periodLabelCol >= 0) {
      periodLabel = extractPeriodLabel(cellAt(periodLabelCol)) ?? '';
    }
    if (!periodLabel && colPeriodLabel >= 0 && colPeriodLabel !== periodLabelCol) {
      periodLabel = extractPeriodLabel(cellAt(colPeriodLabel)) ?? '';
    }
    if (!periodLabel && colDate >= 0) {
      periodLabel = extractPeriodLabel(cellAt(colDate)) ?? '';
    }
    if (!periodLabel) {
      groupErrors.push({
        rowNumber,
        message: `تاریخ/ماه در ردیف ${rowNumber} نامعتبر است.`,
      });
      continue;
    }

    // Period type (default monthly)
    let period: SocialMetricPeriod = 'monthly';
    if (colPeriod >= 0) {
      const p = normalizePeriod(cellAt(colPeriod));
      if (p) period = p;
    }

    // Metric type → field key
    const metricKey = METRIC_TYPE_ALIASES[
      toLatinDigits(metricTypeRaw).toLowerCase().replace(/[\s\u00A0]/g, '')
    ];
    if (!metricKey) {
      groupErrors.push({
        rowNumber,
        message: metricTypeRaw
          ? `نوع شاخص «${metricTypeRaw}» شناخته نشده.`
          : `نوع شاخص در ردیف ${rowNumber} وارد نشده.`,
      });
      continue;
    }

    // Value — handle empty, dash, text, k-suffix, and non-numeric values
    let value: number | null = null;
    const valueClean = valueRaw.replace(/[\s\u00A0\u200C]/g, '').trim();
    if (valueClean && valueClean !== '-' && valueClean !== '—') {
      // Skip known non-numeric text values (status text in wrong column, etc.)
      const NON_NUMERIC = [
        'غیرفعال', 'غیر فعال', 'فعال', 'راکد', 'معلق',
        'active', 'inactive', 'suspended',
      ];
      if (NON_NUMERIC.includes(valueClean)) {
        continue; // skip silently
      }
      // Skip various dash/hyphen sequences (-----, --, ---, etc.)
      if (/^[-‐-―]+$/.test(valueClean)) {
        continue;
      }
      try {
        // Strip trailing units like (viewer), (subscribers), etc.
        let normalized = toLatinDigits(valueRaw)
          .replace(/\([^)]*\)/g, '') // remove (viewer), (subscribers), etc.
          .replace(/[،,]/g, '')
          .replace(/[\s\u00A0\u200C]/g, '')
          .trim();
        // Handle k/K suffix: 4.5k → 4500, 16 k → 16000
        const kMatch = normalized.match(/^([\d.]+)\s*[kK]$/);
        if (kMatch) {
          const base = parseFloat(kMatch[1]);
          if (Number.isFinite(base) && base >= 0) {
            value = Math.round(base * 1000);
            // fall through to group assignment below
          }
        } else {
          const n = Number(normalized);
          if (Number.isFinite(n) && n >= 0) {
            value = n;
          }
        }
        // If value is still null after parsing, skip silently
        if (value === null) continue;
      } catch {
        continue;
      }
    }

    // Group key: platform|username|periodLabel
    const key = `${platform}|${username}|${periodLabel}`;
    if (!groups.has(key)) {
      groups.set(key, {
        brand,
        platform,
        username,
        period,
        periodLabel,
        values: {},
        rowNumbers: [],
      });
    }
    const group = groups.get(key)!;
    group.rowNumbers.push(rowNumber);
    if (value !== null) {
      group.values[metricKey] = value;
    }

    // Store account status and link for account creation
    if (colStatus >= 0) {
      const statusRaw = cellAt(colStatus);
      (group as any).status = statusRaw;
    }
    if (colLink >= 0) {
      const linkRaw = cellAt(colLink);
      (group as any).link = linkRaw;
    }
  }

  // ── 3. Convert groups to SocialMetricImportRow[] ───────────────────────
  const rows: SocialMetricImportRow[] = [...groups.values()].map(
    (group, i) => ({
      rowNumber: group.rowNumbers[0] ?? i + 2,
      platform: group.platform!,
      accountIdentifier: group.username,
      period: group.period,
      periodLabel: group.periodLabel,
      values: group.values,
      errors: [],
      brand: group.brand,
      link: (group as any).link || null,
      sourceStatus: (group as any).status || null,
    }),
  );

  // Add file-level errors from parsing failures
  const fileErrs = [...fileErrors, ...groupErrors.map((e) => e.message)];

  return { rows, fileErrors: fileErrs };
}

/**
 * Parse a long-format File (Excel or CSV) directly.
 * Returns typed import rows ready for preview/commit.
 */
export async function parseLongFormatFile(
  file: File,
): Promise<SocialImportParseResult> {
  const fileName = file.name ?? '';
  let matrix: string[][];

  if (/\.xlsx?$/i.test(fileName)) {
    const { read, utils } = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = read(new Uint8Array(data), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { rows: [], fileErrors: ['فایل خالی است.'] };
    const aoa = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    matrix = aoa.map((r) =>
      (r as unknown[]).map((c) => (c == null ? '' : String(c).trim())),
    );
  } else {
    // CSV — reuse the existing CSV parser
    const { parseCsv } = await import('@/services/social-import/parse');
    const text = await file.text();
    matrix = parseCsv(text);
  }

  return rowsToLongFormatImportRows(matrix);
}
