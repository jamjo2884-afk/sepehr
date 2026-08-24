import { NextResponse } from 'next/server';
import {
  IMPORT_MAX_FILE_BYTES,
  parseImportFile,
  rowsToImportRows,
} from '@/services/social-import/parse';
import { rowsToLongFormatImportRows } from '@/services/social-import/parse-long-format';
import { getSocialAccounts, createSocialAccount } from '@/services/social.service';
import { matchImportRowToAccount } from '@/services/social-import/match';
import { normalizeAccountStatus } from '@/services/social-import/normalize';

/**
 * POST /api/social/import/preview
 *
 * Body: multipart/form-data with a single `file` field (Excel or CSV).
 *
 * Parses the file in memory, validates every row against the app's own
 * schema (platforms, periods, numbers, per-platform metric validity) and
 * matches each row's account identifier to a unique social account. The
 * file is never stored — it's read into memory, parsed and discarded.
 *
 * Response: { fileErrors, rows } where each row carries its validation
 * errors and the matched account (or a Persian matching error).
 */

export async function POST(req: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'درخواست نامعتبر است.' },
      { status: 400 },
    );
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'فایلی دریافت نشد.' }, { status: 400 });
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'حجم فایل حداکثر ۱۰ مگابایت است.' },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'فایل خالی است.' }, { status: 400 });
  }

  try {
    const matrix = await parseImportFile(file);

    // Auto-detect format: if headers contain metric_type/type/شاخص,
    // it's a long-format file (raw Excel export). Otherwise use the
    // standard wide-format parser.
    const headerLower = matrix[0]?.map((c: string) =>
      c.replace(/[\s\u00A0]/g, '').toLowerCase(),
    ) ?? [];
    const isLongFormat = headerLower.some(
      (h) =>
        h === 'metric_type' ||
        h === 'metric' ||
        h === 'نوع_آمار' ||
        h === 'shaaj' ||
        h === 'شاخص',
    );

    const { rows, fileErrors } = isLongFormat
      ? rowsToLongFormatImportRows(matrix)
      : rowsToImportRows(matrix);
    if (fileErrors.length > 0) {
      return NextResponse.json({ fileErrors, rows: [] }, { status: 200 });
    }
    let accounts = await getSocialAccounts();

    // Auto-create missing accounts from the Excel data
    // so the preview shows them as matched.
    const existingKeys = new Set(
      accounts.map((a) => `${a.platform}|${a.username}`),
    );
    const uniqueFromRows = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (!row.accountIdentifier || !row.brand) continue;
      const key = `${row.platform}|${row.accountIdentifier}`;
      if (!uniqueFromRows.has(key) && !existingKeys.has(key)) {
        uniqueFromRows.set(key, row);
      }
    }
    for (const [, row] of uniqueFromRows) {
      const created = await createSocialAccount({
        brand: row.brand!,
        platform: row.platform,
        username: row.accountIdentifier,
        url: row.link || null,
        status: normalizeAccountStatus(row.sourceStatus ?? '') ?? 'active',
      });
      if (created) {
        accounts = [...accounts, created];
      }
    }

    const previewRows = rows.map((row) => {
      const result = matchImportRowToAccount(accounts, row);
      const account =
        result.status === 'matched'
          ? {
              id: result.account.id,
              brand: result.account.brand,
              username: result.account.username,
              displayName: result.account.displayName,
            }
          : null;
      const candidates =
        result.status === 'ambiguous'
          ? result.candidates.map((c) => ({
              id: c.id,
              brand: c.brand,
              username: c.username,
              displayName: c.displayName,
            }))
          : null;
      const matchError =
        result.status === 'empty'
          ? 'شناسهٔ حساب وارد نشده است.'
          : result.status === 'unmatched'
            ? 'حسابی با این شناسه یافت نشد.'
            : null;
      return {
        rowNumber: row.rowNumber,
        platform: row.platform,
        accountIdentifier: row.accountIdentifier,
        period: row.period,
        periodLabel: row.periodLabel,
        values: row.values,
        errors: row.errors,
        account,
        candidates,
        matchStatus: result.status,
        matchError,
        brand: row.brand ?? null,
        link: row.link ?? null,
        sourceStatus: row.sourceStatus ?? null,
      };
    });
    return NextResponse.json({ fileErrors: [], rows: previewRows });
  } catch (err) {
    console.warn('[social-import] Could not parse the uploaded file.', err);
    return NextResponse.json(
      { error: 'خواندن فایل انجام نشد. فرمت فایل را بررسی کنید.' },
      { status: 400 },
    );
  }
}
