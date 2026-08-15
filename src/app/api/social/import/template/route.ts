import { NextResponse } from 'next/server';
import {
  buildCsvTemplate,
  buildXlsxTemplate,
} from '@/services/social-import/template';

/**
 * GET /api/social/import/template?format=xlsx|csv
 *
 * Downloads an import template generated from the project's own schema:
 * header row + clearly-marked DEMO rows + a column guide sheet (Excel).
 * Demo rows are never importable data — they only show the format.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'xlsx';
  try {
    if (format === 'csv') {
      const csv = buildCsvTemplate();
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="mediaos-import-template.csv"',
        },
      });
    }
    const buf = await buildXlsxTemplate();
    const bytes = new Uint8Array(buf);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="mediaos-import-template.xlsx"',
      },
    });
  } catch (err) {
    console.warn('[social-import] Could not build the template.', err);
    return NextResponse.json(
      { error: 'ساخت قالب انجام نشد.' },
      { status: 500 },
    );
  }
}
