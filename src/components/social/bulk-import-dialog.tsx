'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { toPersianDigits } from '@/utils/persian';
import type { SocialImportSummary } from '@/services/social-import/types';
import { IMPORT_MAX_FILE_BYTES } from '@/services/social-import/parse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Preview row returned by the server (mirrors the matched preview shape). */
interface PreviewRow {
  rowNumber: number;
  platform: string;
  accountIdentifier: string;
  period: string;
  periodLabel: string;
  errors: string[];
  /** Normalized metric values (keys present only when provided). */
  values: Record<string, number>;
  account: { id: string; brand: string; username: string; displayName?: string | null } | null;
  matchError: string | null;
  matchStatus?: 'matched' | 'ambiguous' | 'unmatched' | 'empty';
  candidates?: Array<{ id: string; brand: string; username: string; displayName?: string | null }> | null;
}

type Stage = 'choose' | 'parsing' | 'preview' | 'saving' | 'done';

const PERIOD_LABELS: Record<string, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
};

export function BulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [stage, setStage] = useState<Stage>('choose');
  const [fileName, setFileName] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<SocialImportSummary | null>(null);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [resolvedAccounts, setResolvedAccounts] = useState<
    Map<number, { id: string; brand: string; username: string }>
  >(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleRowErrors = useCallback((rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  }, []);

  const validRows = rows.filter((r) => {
    if (r.errors.length > 0) return false;
    if (r.account != null) return true;
    return resolvedAccounts.has(r.rowNumber);
  });
  const invalidRows = rows.length - validRows.length;

  const reset = () => {
    setStage('choose');
    setFileName('');
    setFileErrors([]);
    setRows([]);
    setSummary(null);
    setSheetsUrl('');
    setResolvedAccounts(new Map());
  };

  const parseFile = async (file: File) => {
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      toast.error('حجم فایل حداکثر ۱۰ مگابایت است.');
      return;
    }
    if (file.size === 0) {
      toast.error('فایل خالی است.');
      return;
    }
    setFileName(file.name);
    setStage('parsing');
    setFileErrors([]);
    setRows([]);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/social/import/preview', {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as {
        fileErrors?: string[];
        rows?: PreviewRow[];
        error?: string;
      };
      if (!res.ok) {
        setFileErrors([data.error ?? 'خواندن فایل انجام نشد.']);
        setStage('choose');
        return;
      }
      if (data.fileErrors && data.fileErrors.length > 0) {
        setFileErrors(data.fileErrors);
        setStage('choose');
        return;
      }
      setRows(data.rows ?? []);
      setStage('preview');
    } catch {
      setFileErrors(['خواندن فایل انجام نشد. فرمت فایل را بررسی کنید.']);
      setStage('choose');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void parseFile(file);
  };

  const downloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      const res = await fetch(`/api/social/import/template?format=${format}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'xlsx'
          ? 'media-deck-import-template.xlsx'
          : 'media-deck-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('دانلود قالب انجام نشد.');
    }
  };

  const commitImport = async () => {
    if (validRows.length === 0) return;
    setStage('saving');
    try {
      const res = await fetch('/api/social/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            rowNumber: r.rowNumber,
            platform: r.platform,
            accountIdentifier: r.accountIdentifier,
            period: r.period,
            periodLabel: r.periodLabel,
            values: r.values,
            errors: [],
            resolvedAccountId: resolvedAccounts.get(r.rowNumber)?.id ?? r.account?.id ?? null,
          })),
        }),
      });
      const data = (await res.json()) as SocialImportSummary & {
        error?: string;
      };
      if (!res.ok) {
        setFileErrors([data.error ?? 'ثبت اطلاعات انجام نشد.']);
        setStage('preview');
        return;
      }
      setSummary(data);
      setStage('done');
      onImported();
    } catch {
      setFileErrors(['ثبت اطلاعات انجام نشد.']);
      setStage('preview');
    }
  };

  const handleSheetsContinue = () => {
    if (sheetsUrl.trim() === '') {
      toast.error('لینک فایل Google Sheets را وارد کنید.');
      return;
    }
    toast.info('اتصال Google Sheets در مرحله بعد فعال خواهد شد.');
  };

  const close = () => {
    onOpenChange(false);
    // Reset for the next open.
    setTimeout(reset, 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>ورود انبوه آمار</DialogTitle>
          <DialogDescription>
            آمار چند حساب را هم‌زمان از فایل Excel یا CSV وارد کنید. داده‌ها از
            همان مسیر ثبت دستی ذخیره می‌شوند (بدون duplicate و بدون پاک کردن
            مقادیر قبلی).
          </DialogDescription>
        </DialogHeader>

        {stage === 'choose' || stage === 'parsing' ? (
          <div className="flex flex-col gap-4">
            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file" className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </TabsTrigger>
                <TabsTrigger value="csv" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  CSV
                </TabsTrigger>
                <TabsTrigger value="sheets" className="gap-1.5">
                  <Cloud className="h-3.5 w-3.5" />
                  Google Sheets
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-3">
                <UploadZone
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  busy={stage === 'parsing'}
                  accept=".xlsx,.xls"
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                />
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </TabsContent>

              <TabsContent value="csv" className="mt-3">
                <UploadZone
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  busy={stage === 'parsing'}
                  accept=".csv"
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                />
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </TabsContent>

              <TabsContent value="sheets" className="mt-3 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  لینک فایل Google Sheets خود را وارد کنید. اتصال مستقیم در
                  مرحلهٔ بعد فعال می‌شود.
                </p>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    className="h-9 text-xs"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={handleSheetsContinue}
                  >
                    ادامه
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Template downloads */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 p-3">
              <span className="text-xs text-muted-foreground">
                قالب استاندارد را دانلود کنید:
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void downloadTemplate('xlsx')}
              >
                <Download className="h-3 w-3" />
                قالب Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void downloadTemplate('csv')}
              >
                <Download className="h-3 w-3" />
                قالب CSV
              </Button>
            </div>

            {fileErrors.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {fileErrors.map((e, i) => (
                  <p
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    {e}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === 'preview' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-surface px-2.5 py-1 text-muted-foreground">
                فایل: <span className="text-foreground">{fileName}</span>
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-muted-foreground">
                کل ردیف‌ها:{' '}
                <span className="font-medium text-foreground">
                  {toPersianDigits(String(rows.length))}
                </span>
              </span>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">
                متصل: {toPersianDigits(String(validRows.length))}
              </span>
              {invalidRows > 0 ? (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                  نیاز به بررسی: {toPersianDigits(String(invalidRows))}
                </span>
              ) : null}
            </div>

            <div className="max-h-[46vh] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      ردیف
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      پلتفرم
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      حساب
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      دوره
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      دنبال‌کنندگان
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      بازدید
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      لایک
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      وضعیت
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const issues = [...r.errors];
                    if (r.account == null && r.matchError) {
                      issues.push(r.matchError);
                    }
                    const ok = issues.length === 0;
                    return (
                      <>
                      <tr
                        key={r.rowNumber}
                        className={cn(
                          'border-b border-border/50 last:border-0',
                          !ok && 'bg-destructive/[0.04]',
                        )}
                      >
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                          {toPersianDigits(String(r.rowNumber))}
                        </td>
                        <td className="px-3 py-1.5 text-foreground">
                          {SOCIAL_PLATFORM_LABELS[r.platform as never] ??
                            r.platform}
                        </td>
                        <td className="px-3 py-1.5 text-foreground">
                          {r.account
                            ? `${r.account.brand} / ${r.account.username}`
                            : r.accountIdentifier || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {PERIOD_LABELS[r.period] ?? r.period} —{' '}
                          {toPersianDigits(r.periodLabel || '—')}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-foreground">
                          {r.values.followers != null
                            ? toPersianDigits(String(r.values.followers))
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-foreground">
                          {r.values.views != null
                            ? toPersianDigits(String(r.values.views))
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-foreground">
                          {r.values.likes != null
                            ? toPersianDigits(String(r.values.likes))
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              متصل شد
                            </span>
                          ) : r.matchStatus === 'ambiguous' ? (
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => toggleRowErrors(r.rowNumber)}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-500 hover:underline"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                نیاز به انتخاب
                                {expandedRows.has(r.rowNumber) ? ' ▾' : ' ▸'}
                              </button>
                              {expandedRows.has(r.rowNumber) && r.candidates ? (
                                <div className="flex flex-col gap-1 rounded border border-amber-500/20 bg-amber-500/5 p-1.5">
                                  {r.candidates.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        setResolvedAccounts((prev) => {
                                          const next = new Map(prev);
                                          next.set(r.rowNumber, { id: c.id, brand: c.brand, username: c.username });
                                          return next;
                                        });
                                      }}
                                      className={cn(
                                        'rounded px-2 py-0.5 text-right text-[11px] hover:bg-amber-500/10',
                                        resolvedAccounts.get(r.rowNumber)?.id === c.id && 'bg-amber-500/15 font-medium',
                                      )}
                                    >
                                      {c.brand} / {c.username}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => toggleRowErrors(r.rowNumber)}
                                className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                حساب پیدا نشد
                                {expandedRows.has(r.rowNumber) ? ' ▾' : ' ▸'}
                              </button>
                              {expandedRows.has(r.rowNumber) ? (
                                <div className="rounded border border-destructive/20 bg-destructive/5 p-1.5">
                                  <p className="text-[10px] text-destructive/70">
                                    برای ثبت این ردیف، ابتدا حساب مربوطه را از بخش مدیریت حساب‌ها اضافه کنید.
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                      {!ok && expandedRows.has(r.rowNumber) ? (
                        <tr key={`${r.rowNumber}-errors`} className="bg-destructive/[0.03]">
                          <td colSpan={8} className="px-3 py-2">
                            <ul className="flex flex-col gap-1">
                              {issues.map((issue, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-1.5 text-[11px] text-destructive/80"
                                >
                                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {invalidRows > 0 ? (
              <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {toPersianDigits(String(invalidRows))} ردیف خطا دارد. روی دکمهٔ
                  «خطا» کلیک کنید تا جزئیات هر ردیف نمایش داده شود. فقط ردیف‌های
                  معتبر ثبت می‌شوند.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === 'saving' ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال ثبت اطلاعات…</p>
          </div>
        ) : null}

        {stage === 'done' && summary ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                label="کل ردیف‌ها"
                value={summary.total}
                tone="default"
              />
              <SummaryCard
                label="ثبت‌شده"
                value={summary.inserted}
                tone="success"
              />
              <SummaryCard
                label="به‌روزرسانی‌شده"
                value={summary.updated}
                tone="info"
              />
              <SummaryCard
                label="ردشده"
                value={summary.rejected}
                tone="danger"
              />
            </div>
            {summary.duplicate > 0 ? (
              <p className="text-xs text-muted-foreground">
                duplicate: {toPersianDigits(String(summary.duplicate))}
              </p>
            ) : null}
            {summary.errors.length > 0 ? (
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {summary.errors.slice(0, 20).map((e, i) => (
                  <p
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-destructive"
                  >
                    <XCircle className="h-3 w-3 shrink-0" />
                    ردیف {toPersianDigits(String(e.rowNumber))}: {e.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {stage === 'preview' ? (
            <>
              <Button variant="outline" onClick={close}>
                انصراف
              </Button>
              <Button
                onClick={() => void commitImport()}
                disabled={validRows.length === 0}
              >
                <Upload className="h-3.5 w-3.5" />
                {invalidRows > 0
                  ? `ثبت ردیف‌های معتبر (${toPersianDigits(String(validRows.length))})`
                  : `ثبت اطلاعات (${toPersianDigits(String(validRows.length))})`}
              </Button>
            </>
          ) : null}
          {stage === 'done' ? <Button onClick={close}>پایان</Button> : null}
          {stage === 'choose' || stage === 'parsing' ? (
            <Button
              variant="outline"
              onClick={close}
              disabled={stage === 'parsing'}
            >
              بستن
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadZone({
  dragOver,
  setDragOver,
  busy,
  accept,
  onDrop,
  onClick,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  busy: boolean;
  accept: string;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border bg-surface/30 hover:bg-surface/50',
        busy && 'opacity-60',
      )}
    >
      {busy ? (
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      ) : (
        <Upload className="h-7 w-7 text-muted-foreground" />
      )}
      <span className="text-sm font-medium text-foreground">
        {busy
          ? 'در حال بررسی فایل…'
          : 'برای انتخاب فایل کلیک کنید یا فایل را اینجا رها کنید'}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {accept.replace(/\./g, '')} — حداکثر ۱۰ مگابایت
      </span>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'success' | 'info' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'info'
        ? 'text-primary'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface/50 p-4">
      <span className={cn('text-2xl font-bold tabular-nums', toneClass)}>
        {toPersianDigits(String(value))}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
