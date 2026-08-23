import { NextResponse } from 'next/server';
import { detectAnomaliesForSession, detectAnomaliesForRowById } from '@/services/import-review/anomaly-detection';
import { updateImportRow } from '@/services/import-review/import-review.service';

/**
 * GET /api/social/import/review/sessions/[id]/anomalies
 *
 * Returns the anomaly summary for a session.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const summary = await detectAnomaliesForSession(params.id);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[anomalies] GET error:', err);
    return NextResponse.json({ error: 'خطا در خواندن anomali‌ها.' }, { status: 500 });
  }
}

/**
 * PATCH /api/social/import/review/sessions/[id]/anomalies
 *
 * Fix a specific metric anomaly by editing the row's normalized_data.
 *
 * Body: { rowId: string, field: string, newValue: number }
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  void params; // available for future use (session-scoped validation)
  try {
    const body = await req.json();
    const { rowId, field, newValue } = body as {
      rowId: string;
      field: string;
      newValue: number;
    };

    if (!rowId || !field || newValue === undefined) {
      return NextResponse.json(
        { error: 'rowId, field, and newValue are required.' },
        { status: 400 },
      );
    }

    // Fetch current row to get normalized_data
    const { supabase } = await import('@/lib/supabase');

    // Read current normalized_data
    const { data: row, error: fetchErr } = await supabase
      .from('import_rows')
      .select('normalized_data')
      .eq('id', rowId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'ردیف یافت نشد.' }, { status: 404 });
    }

    const nd = (row.normalized_data as Record<string, unknown>) ?? {};
    const source = (nd.values && typeof nd.values === 'object' && !Array.isArray(nd.values))
      ? { ...(nd.values as Record<string, unknown>) }
      : { ...nd };

    // Update the specific field
    source[field] = newValue;

    // Rebuild normalized_data
    const updatedNd: Record<string, unknown> = { ...nd };
    if (nd.values && typeof nd.values === 'object' && !Array.isArray(nd.values)) {
      updatedNd.values = source;
    } else {
      Object.assign(updatedNd, source);
    }

    // Write back
    await updateImportRow(rowId, { normalized_data: updatedNd }, { supabase });

    // Re-run anomaly detection for this row
    const newAnomalies = await detectAnomaliesForRowById(rowId);

    // Update resolution_data with new anomalies
    await supabase
      .from('import_rows')
      .update({
        resolution_data: {
          anomalies: newAnomalies.length > 0 ? newAnomalies : undefined,
          anomaly_severity: newAnomalies.length > 0
            ? newAnomalies.some((a) => a.severity === 'critical')
              ? 'critical'
              : newAnomalies.some((a) => a.severity === 'warning')
                ? 'warning'
                : 'info'
            : undefined,
        },
      })
      .eq('id', rowId);

    return NextResponse.json({
      success: true,
      field,
      newValue,
      remainingAnomalies: newAnomalies.length,
      anomalies: newAnomalies,
    });
  } catch (err) {
    console.error('[anomalies] PATCH error:', err);
    return NextResponse.json({ error: 'خطا در اصلاح anomali.' }, { status: 500 });
  }
}
