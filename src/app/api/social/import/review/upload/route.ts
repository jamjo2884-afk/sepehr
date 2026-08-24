import { NextResponse } from 'next/server';
import {
  IMPORT_MAX_FILE_BYTES,
  parseImportFile,
  rowsToImportRows,
} from '@/services/social-import/parse';
import { rowsToLongFormatImportRows } from '@/services/social-import/parse-long-format';
import {
  createImportSession,
  createImportRows,
  validateSession,
} from '@/services/import-review/import-review.service';

/**
 * POST /api/social/import/review/upload
 *
 * Upload a file → parse → create session → insert rows → validate.
 * Returns the session ID for the Review Center.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'فایلی دریافت نشد.' }, { status: 400 });
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'حجم فایل حداکثر ۱۰ مگابایت است.' }, { status: 413 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'فایل خالی است.' }, { status: 400 });
  }

  try {
    // Parse file — auto-detect long vs wide format
    const matrix = await parseImportFile(file);
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
      return NextResponse.json({ fileErrors, sessionId: null }, { status: 200 });
    }

    const fileName = file.name ?? 'unknown';
    const fileType = fileName.endsWith('.csv') ? 'csv' : 'xlsx';

    // Create session
    const session = await createImportSession(fileName, fileType, rows.length);

    // Insert rows
    const insertRows = rows.map((r) => ({
      row_number: r.rowNumber,
      raw_data: { platform: r.platform, accountIdentifier: r.accountIdentifier, period: r.period, periodLabel: r.periodLabel, values: r.values },
      normalized_data: { platform: r.platform, accountIdentifier: r.accountIdentifier, period: r.period, periodLabel: r.periodLabel, values: r.values },
      platform: r.platform,
      account_identifier: r.accountIdentifier,
      username: null as string | null,
      display_name: null as string | null,
      brand: null as string | null,
      period: r.period,
      period_label: r.periodLabel,
    }));
    await createImportRows(session.id, insertRows);

    // Validate
    const summary = await validateSession(session.id);

    return NextResponse.json({ sessionId: session.id, summary });
  } catch (err) {
    console.warn('[import-review] Upload failed.', err);
    return NextResponse.json({ error: 'پردازش فایل انجام نشد.' }, { status: 500 });
  }
}
