import { NextResponse } from 'next/server';
import {
  IMPORT_MAX_FILE_BYTES,
  parseImportFile,
  rowsToImportRows,
} from '@/services/social-import/parse';
import { getSocialAccounts } from '@/services/social.service';
import { matchRowsToAccounts } from '@/services/social-import/match';

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
    const { rows, fileErrors } = rowsToImportRows(matrix);
    if (fileErrors.length > 0) {
      return NextResponse.json({ fileErrors, rows: [] }, { status: 200 });
    }
    const accounts = await getSocialAccounts();
    const matched = matchRowsToAccounts(accounts, rows);
    const previewRows = matched.map(({ row, account, matchError }) => ({
      rowNumber: row.rowNumber,
      platform: row.platform,
      accountIdentifier: row.accountIdentifier,
      period: row.period,
      periodLabel: row.periodLabel,
      values: row.values,
      errors: row.errors,
      account: account
        ? {
            id: account.id,
            brand: account.brand,
            username: account.username,
            displayName: account.displayName,
          }
        : null,
      matchError,
    }));
    return NextResponse.json({ fileErrors: [], rows: previewRows });
  } catch (err) {
    console.warn('[social-import] Could not parse the uploaded file.', err);
    return NextResponse.json(
      { error: 'خواندن فایل انجام نشد. فرمت فایل را بررسی کنید.' },
      { status: 400 },
    );
  }
}
