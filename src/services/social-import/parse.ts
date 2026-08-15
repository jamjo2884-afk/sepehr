import {
  headerToMetricKey,
  normalizePeriod,
  normalizePeriodLabel,
  normalizePlatform,
  parseImportNumber,
} from '@/services/social-import/normalize';
import { PLATFORM_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';
import type {
  SocialMetricImportRow,
  SocialImportParseResult,
} from '@/services/social-import/types';

export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Parse a CSV text into a matrix of cells. Handles:
 * - UTF-8 BOM (stripped)
 * - CRLF / LF line endings
 * - quoted fields with embedded commas / quotes ("…""…")
 * - semicolon-delimited files (common in Persian Excel exports) — the
 *   delimiter is detected from the first non-empty line
 */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, '');
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    countChar(firstLine, ';') > countChar(firstLine, ',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      continue;
    }
    if (ch === '\n') {
      pushRow();
      continue;
    }
    if (ch === '\r') {
      if (content[i + 1] === '\n') continue;
      pushRow();
      continue;
    }
    field += ch;
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n += 1;
  return n;
}

/** Whether the file extension suggests an Excel workbook. */
export function isExcelFile(fileName: string): boolean {
  return /\.xlsx?$/i.test(fileName);
}

/** Read a File into a string matrix (Excel → first sheet). */
export async function parseImportFile(file: File): Promise<string[][]> {
  const fileName = file.name ?? '';
  if (isExcelFile(fileName)) {
    const { read, utils } = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = read(new Uint8Array(data), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const aoa = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    return aoa.map((r) =>
      (r as unknown[]).map((c) => (c == null ? '' : String(c).trim())),
    );
  }
  const text = await file.text();
  return parseCsv(text);
}

/** Map a raw string matrix into typed import rows with validation. */
export function rowsToImportRows(matrix: string[][]): SocialImportParseResult {
  const fileErrors: string[] = [];
  if (matrix.length === 0) {
    return { rows: [], fileErrors: ['فایل خالی است.'] };
  }
  const header = matrix[0].map((c) => c.trim());
  // Required columns: platform, account_identifier, period, period_label.
  const headerLower = header.map((c) =>
    c.replace(/[\s\u00A0]/g, '').toLowerCase(),
  );
  const findHeader = (aliases: string[]): number =>
    headerLower.findIndex((h) => aliases.includes(h));
  const colPlatform = findHeader(['platform', 'پلتفرم']);
  const colAccount = findHeader([
    'account_identifier',
    'accountidentifier',
    'account',
    'حساب',
    'identifier',
    'شناسه_حساب',
    'شناسهحساب',
  ]);
  const colPeriod = findHeader(['period', 'دوره']);
  const colPeriodLabel = findHeader([
    'period_label',
    'periodlabel',
    'label',
    'ماه',
    'دوره_نمایشی',
    'برچسب_دوره',
  ]);

  const missing: string[] = [];
  if (colPlatform < 0) missing.push('platform');
  if (colAccount < 0) missing.push('account_identifier');
  if (colPeriod < 0) missing.push('period');
  if (colPeriodLabel < 0) missing.push('period_label');
  if (missing.length > 0) {
    return {
      rows: [],
      fileErrors: [`ستون‌های ضروری در فایل وجود ندارد: ${missing.join('، ')}`],
    };
  }

  // Metric columns present in the file (by header).
  const metricCols: Array<{ index: number; key: SocialMetricFieldKey }> = [];
  header.forEach((h, i) => {
    const key = headerToMetricKey(h);
    if (
      key &&
      i !== colPlatform &&
      i !== colAccount &&
      i !== colPeriod &&
      i !== colPeriodLabel
    ) {
      metricCols.push({ index: i, key });
    }
  });

  const rows: SocialMetricImportRow[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r];
    const rowNumber = r + 1;
    const errors: string[] = [];
    const cellAt = (i: number): string => (i >= 0 ? (cells[i] ?? '') : '');

    const platform = normalizePlatform(cellAt(colPlatform));
    if (!platform) {
      errors.push(
        cellAt(colPlatform).trim() === ''
          ? 'platform وارد نشده است.'
          : 'platform نامعتبر است.',
      );
    }

    const accountIdentifier = cellAt(colAccount).trim().replace(/^@/, '');
    if (accountIdentifier === '') {
      errors.push('account_identifier وارد نشده است.');
    }

    const periodRaw = cellAt(colPeriod);
    const period = normalizePeriod(periodRaw);
    if (!period) {
      errors.push(
        periodRaw.trim() === ''
          ? 'period وارد نشده است.'
          : 'period نامعتبر است (daily / weekly / monthly).',
      );
    }

    let periodLabel = '';
    if (period) {
      try {
        periodLabel =
          normalizePeriodLabel(period, cellAt(colPeriodLabel)) ?? '';
      } catch (e) {
        errors.push(
          e instanceof Error ? e.message : 'period_label نامعتبر است.',
        );
      }
    } else if (cellAt(colPeriodLabel).trim() === '') {
      errors.push('period_label وارد نشده است.');
    }

    const values: Record<string, number | null> = {};
    const supported =
      platform !== null ? new Set(PLATFORM_METRIC_FIELDS[platform]) : null;
    for (const { index, key } of metricCols) {
      const raw = cellAt(index);
      if (raw.trim() === '') continue; // NULL = not provided
      if (supported !== null && !supported.has(key)) {
        errors.push(`شاخص «${key}» برای این پلتفرم معتبر نیست.`);
        continue;
      }
      try {
        const n = parseImportNumber(raw);
        if (n !== null) {
          if (key === 'engagementRate' && n > 100) {
            errors.push('نرخ تعامل نمی‌تواند بیشتر از ۱۰۰ باشد.');
            continue;
          }
          values[key] = n;
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'عدد نامعتبر است.');
      }
    }

    rows.push({
      rowNumber,
      platform: platform ?? 'instagram',
      accountIdentifier,
      period: period ?? 'monthly',
      periodLabel: periodLabel || '',
      values,
      errors,
    });
  }
  return { rows, fileErrors };
}
