'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { SocialMetric } from '@/types/social';
import type { SocialMetricPeriod } from '@/types/social';
import { totalEngagement } from '@/services/social-metrics';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const PERIOD_SHORT: Record<SocialMetricPeriod, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
};

/** A dash for missing values — never a fake zero. */
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function periodDisplay(metric: SocialMetric): string {
  return metric.period === 'monthly'
    ? jalaliMonthName(metric.periodLabel)
    : toPersianDigits(metric.periodLabel);
}

/**
 * Chronological history of an account's metrics (newest first). Rows can be
 * opened in the edit dialog or deleted (with confirmation); missing values
 * render as '—'. Deletion is self-contained: it calls the API, removes the
 * row locally and optionally notifies the parent via `onDeleted`.
 */
export function MetricHistoryTable({
  metrics,
  onEdit,
  onRecordNew,
  onDeleted,
}: {
  metrics: SocialMetric[];
  onEdit: (metric: SocialMetric) => void;
  onRecordNew?: () => void;
  /** Called after a row is deleted (e.g. to refresh parent data). */
  onDeleted?: (metric: SocialMetric) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<SocialMetric | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<number | string>>(
    () => new Set(),
  );

  const rows = useMemo(
    () =>
      [...metrics]
        .filter((m) => !deletedIds.has(m.id))
        .sort((a, b) =>
          a.periodLabel < b.periodLabel
            ? 1
            : a.periodLabel > b.periodLabel
              ? -1
              : 0,
        ),
    [metrics, deletedIds],
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/social/metrics/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: deleteTarget.updatedAt }),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && result.ok) {
        setDeletedIds((prev) => new Set(prev).add(deleteTarget.id));
        setDeleteTarget(null);
        toast.success('متریک حذف شد.');
        onDeleted?.(deleteTarget);
      } else {
        toast.error(result.error || 'حذف متریک انجام نشد.');
      }
    } catch {
      toast.error('حذف متریک انجام نشد.');
    } finally {
      setDeleting(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          برای این حساب هنوز آماری ثبت نشده است.
        </p>
        {onRecordNew ? (
          <Button variant="outline" size="sm" onClick={onRecordNew}>
            ثبت اولین آمار
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-1 text-right font-medium text-muted-foreground">
              دوره
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              دنبال‌کننده
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              بازدید
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              تعامل
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              نرخ تعامل
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              محتوا
            </th>
            <th className="py-2 pl-1 text-left font-medium text-muted-foreground">
              عملیات
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const engagement = totalEngagement(m);
            return (
              <tr
                key={m.id}
                className="border-b border-border/50 last:border-0 hover:bg-surface/40"
              >
                <td className="py-2 pr-1">
                  <span className="font-medium text-foreground">
                    {periodDisplay(m)}
                  </span>
                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {PERIOD_SHORT[m.period]}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums text-foreground">
                  {formatNumber(m.followers)}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {m.views !== null ? formatNumber(m.views) : <Dash />}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {engagement > 0 ? formatNumber(engagement) : <Dash />}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {m.engagementRate !== null ? (
                    <>{formatNumber(Math.round(m.engagementRate * 10) / 10)}٪</>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {m.posts !== null ? formatNumber(m.posts) : <Dash />}
                </td>
                <td className="py-2 pl-1 text-left">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(m)}
                    >
                      <Pencil className="h-3 w-3" />
                      ویرایش
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(m)}
                      aria-label={`حذف آمار ${periodDisplay(m)}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      حذف
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف آمار</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف آمار «
              {deleteTarget ? periodDisplay(deleteTarget) : ''}» (دنبال‌کننده:{' '}
              {deleteTarget ? formatNumber(deleteTarget.followers) : ''})
              مطمئن هستید؟ این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? 'در حال حذف…' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
