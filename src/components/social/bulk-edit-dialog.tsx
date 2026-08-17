'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialMetric,
  SocialMetricValues,
} from '@/types/social';
import {
  currentJalaliMonth,
  jalaliAddMonths,
  jalaliMonthName,
} from '@/services/social-analytics';
import {
  SOCIAL_METRIC_FIELDS,
  PLATFORM_METRIC_FIELDS,
  type SocialMetricFieldKey,
} from '@/constants/social-fields';
import type { BulkEditSummary } from '@/services/social-bulk-edit.service';
import { formatNumber, toPersianDigits } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Step = 'select' | 'changes' | 'result';
type FieldMode = 'none' | 'set' | 'clear';

const MODE_LABELS: Record<FieldMode, string> = {
  none: 'بدون تغییر',
  set: 'تنظیم مقدار',
  clear: 'پاک کردن',
};

/**
 * Bulk metric EDIT dialog — edits EXISTING `social_metrics` rows only.
 *
 * Flow: انتخاب ← تعیین تغییرات ← پیش‌نمایش ← تأیید ← اعمال ← نتیجه.
 *
 * The operator picks accounts (reusing the brand/platform filters of the
 * accounts page) + one Jalali month. Only accounts that already have a
 * metric row for that month can be targeted — an account without a row is
 * reported as «رکورد آماری پیدا نشد» and is never created here. Every
 * field supports three states: بدون تغییر (absent from the payload), a
 * new number (set), or پاک کردن (explicit NULL — except `followers`,
 * which is NOT NULL in the schema and cannot be cleared).
 *
 * Changes are NEVER applied immediately: the preview table shows
 * account / platform / period / field / current → new for every change and
 * the operator confirms explicitly. The server applies each row through
 * the canonical `updateSocialMetric` with optimistic concurrency and
 * reports every row's outcome (success / rejected / conflict / error).
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  accounts,
  metrics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SocialAccount[];
  metrics: SocialMetric[];
  /** Called after a successful apply so the page can reload its data. */
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>('select');
  const [brandFilter, setBrandFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [monthlyLabel, setMonthlyLabel] = useState(currentJalaliMonth());
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMode>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkEditSummary | null>(null);

  const brands = useMemo(
    () =>
      [...new Set(accounts.map((a) => a.brand))].sort((a, b) =>
        a.localeCompare(b, 'fa'),
      ),
    [accounts],
  );
  const platforms = useMemo(
    () => [...new Set(accounts.map((a) => a.platform))] as SocialPlatform[],
    [accounts],
  );
  const monthOptions = useMemo(() => {
    const now = currentJalaliMonth();
    const out: string[] = [];
    for (let i = 35; i >= 0; i -= 1) out.push(jalaliAddMonths(now, -i));
    return out;
  }, []);

  // The concrete metric row per account for the selected month.
  const metricByAccount = useMemo(() => {
    const map = new Map<string, SocialMetric>();
    for (const m of metrics) {
      if (m.period === 'monthly' && m.periodLabel === monthlyLabel) {
        map.set(m.accountId, m);
      }
    }
    return map;
  }, [metrics, monthlyLabel]);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (brandFilter === 'all' || a.brand === brandFilter) &&
          (platformFilter === 'all' || a.platform === platformFilter),
      ),
    [accounts, brandFilter, platformFilter],
  );

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.has(a.id)),
    [accounts, selectedIds],
  );

  // Union of the metric fields supported by the selected platforms.
  const platformFields = useMemo<SocialMetricFieldKey[]>(() => {
    const platformsOfSelection = new Set(
      selectedAccounts.map((a) => a.platform),
    );
    if (platformsOfSelection.size === 0) return [];
    return Object.keys(SOCIAL_METRIC_FIELDS).filter((key) =>
      [...platformsOfSelection].some((p) =>
        PLATFORM_METRIC_FIELDS[p].includes(key as SocialMetricFieldKey),
      ),
    ) as SocialMetricFieldKey[];
  }, [selectedAccounts]);

  // Reset the dialog every time it opens.
  useEffect(() => {
    if (!open) return;
    setStep('select');
    setBrandFilter('all');
    setPlatformFilter('all');
    setSelectedIds(new Set());
    setMonthlyLabel(currentJalaliMonth());
    setFieldModes({});
    setFieldValues({});
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
    setResult(null);
  }, [open]);

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const targetable = filteredAccounts.filter((a) =>
        metricByAccount.has(a.id),
      );
      const allSelected = targetable.every((a) => prev.has(a.id));
      const next = new Set(prev);
      for (const a of targetable) {
        if (allSelected) next.delete(a.id);
        else next.add(a.id);
      }
      return next;
    });
  };

  const setMode = (key: SocialMetricFieldKey, mode: FieldMode) => {
    setFieldModes((prev) => ({ ...prev, [key]: mode }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setField = (key: SocialMetricFieldKey, raw: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: raw }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // The three-state change payload: absent = no change, number = set,
  // null = clear. Server re-validates everything.
  const changes = useMemo<SocialMetricValues>(() => {
    const out: SocialMetricValues = {};
    for (const key of platformFields) {
      const mode = fieldModes[key] ?? 'none';
      if (mode === 'set') {
        const raw = (fieldValues[key] ?? '').trim();
        if (raw === '') continue;
        out[key] = Number(raw);
      } else if (mode === 'clear') {
        out[key] = null;
      }
    }
    return out;
  }, [platformFields, fieldModes, fieldValues]);

  const changeCount = useMemo(() => Object.keys(changes).length, [changes]);

  const previewRows = useMemo(() => {
    const rows: Array<{
      account: SocialAccount;
      fieldKey: SocialMetricFieldKey;
      oldValue: number | null;
      newValue: number | null;
    }> = [];
    for (const account of selectedAccounts) {
      const metric = metricByAccount.get(account.id);
      if (!metric) continue;
      for (const key of Object.keys(changes) as SocialMetricFieldKey[]) {
        const stored = (metric as unknown as Record<string, unknown>)[key];
        rows.push({
          account,
          fieldKey: key,
          oldValue: typeof stored === 'number' ? stored : null,
          newValue: (changes[key] as number | null) ?? null,
        });
      }
    }
    return rows;
  }, [selectedAccounts, metricByAccount, changes]);

  const validateChanges = (): string | null => {
    const errors: Record<string, string> = {};
    for (const key of platformFields) {
      const mode = fieldModes[key] ?? 'none';
      if (mode === 'set') {
        const raw = (fieldValues[key] ?? '').trim();
        if (raw === '') {
          errors[key] = 'مقدار وارد کنید.';
          continue;
        }
        const n = Number(raw);
        const spec = SOCIAL_METRIC_FIELDS[key];
        if (!Number.isFinite(n)) {
          errors[key] = 'مقدار عددی وارد کنید.';
        } else if (n < 0) {
          errors[key] = 'مقدار نمی‌تواند منفی باشد.';
        } else if (spec.kind === 'percent' && n > (spec.max ?? 100)) {
          errors[key] =
            `حداکثر ${toPersianDigits(String(spec.max ?? 100))} است.`;
        }
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return 'مقادیر واردشده را بررسی کنید.';
    if (changeCount === 0) return 'حداقل یک فیلد را برای تغییر انتخاب کنید.';
    return null;
  };

  const handleApply = async () => {
    const invalid = validateChanges();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const targets = selectedAccounts
        .map((account) => {
          const metric = metricByAccount.get(account.id);
          return metric
            ? { accountId: account.id, expectedUpdatedAt: metric.updatedAt }
            : null;
        })
        .filter((t): t is { accountId: string; expectedUpdatedAt: string } =>
          Boolean(t),
        );
      const res = await fetch('/api/social/metrics/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: 'monthly',
          periodLabel: monthlyLabel,
          targets,
          values: changes,
        }),
      });
      const data = (await res.json()) as BulkEditSummary & { error?: string };
      if (!res.ok) {
        setFormError(data.error || 'ویرایش انبوه انجام نشد.');
        return;
      }
      setResult(data);
      setStep('result');
      onSaved();
    } catch {
      setFormError('ویرایش انبوه انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const missingCount = useMemo(
    () => filteredAccounts.filter((a) => !metricByAccount.has(a.id)).length,
    [filteredAccounts, metricByAccount],
  );

  const isOpen = open;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ویرایش انبوه آمار</DialogTitle>
          <DialogDescription>
            فقط رکوردهای آماری موجود ویرایش می‌شوند؛ رکورد جدیدی ساخته نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="flex flex-col gap-4">
            {/* Month */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">ماه</Label>
              <Select value={monthlyLabel} onValueChange={setMonthlyLabel}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((label) => (
                    <SelectItem key={label} value={label}>
                      {jalaliMonthName(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filters + account picker */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">برند</Label>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه برندها</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    پلتفرم
                  </Label>
                  <Select
                    value={platformFilter}
                    onValueChange={setPlatformFilter}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه پلتفرم‌ها</SelectItem>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>
                          {SOCIAL_PLATFORM_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAllFiltered}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface/70 hover:text-foreground"
              >
                <span>انتخاب همهٔ حساب‌های دارای رکورد</span>
                <span className="font-medium text-foreground">
                  {toPersianDigits(
                    String(
                      filteredAccounts.filter((a) => metricByAccount.has(a.id))
                        .length,
                    ),
                  )}{' '}
                  حساب
                </span>
              </button>

              <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface/30 p-2">
                {filteredAccounts.map((a) => {
                  const hasMetric = metricByAccount.has(a.id);
                  const checked = selectedIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors',
                        hasMetric
                          ? 'hover:bg-surface/70'
                          : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!hasMetric}
                        onCheckedChange={() => toggleAccount(a.id)}
                        className="border-border"
                      />
                      <SocialPlatformIcon
                        platform={a.platform}
                        className="h-6 w-6 rounded-md"
                        iconClassName="h-3.5 w-3.5"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {a.brand} — {a.username || a.displayName || '—'}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {hasMetric
                          ? SOCIAL_PLATFORM_LABELS[a.platform]
                          : 'رکورد آماری پیدا نشد'}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {toPersianDigits(String(selectedAccounts.length))} حساب انتخاب
                شده است.
                {missingCount > 0
                  ? ` — ${toPersianDigits(String(missingCount))} حساب در این ماه رکورد آماری ندارند.`
                  : ''}
              </p>
            </div>
          </div>
        ) : null}

        {step === 'changes' ? (
          <div className="flex flex-col gap-4">
            {/* Field controls */}
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                فیلدهایی که می‌خواهید تغییر دهید را مشخص کنید. هر فیلد سه حالت
                دارد: بدون تغییر، تنظیم مقدار، یا پاک کردن (NULL).
              </p>
              {platformFields.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
                  فیلدی برای پلتفرم‌های انتخاب‌شده موجود نیست.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {platformFields.map((key) => {
                    const spec = SOCIAL_METRIC_FIELDS[key];
                    const mode = fieldModes[key] ?? 'none';
                    const error = fieldErrors[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface/40 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs text-foreground">
                            {spec.label}
                            {spec.kind === 'percent' ? ' (٪)' : ''}
                          </Label>
                          <Select
                            value={mode}
                            onValueChange={(v) => setMode(key, v as FieldMode)}
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {MODE_LABELS.none}
                              </SelectItem>
                              <SelectItem value="set">
                                {MODE_LABELS.set}
                              </SelectItem>
                              <SelectItem
                                value="clear"
                                disabled={key === 'followers'}
                              >
                                {MODE_LABELS.clear}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {mode === 'set' ? (
                          <Input
                            type="number"
                            dir="ltr"
                            min={0}
                            max={spec.max}
                            step={spec.kind === 'percent' ? 'any' : 1}
                            hasError={Boolean(error)}
                            value={fieldValues[key] ?? ''}
                            onChange={(e) => setField(key, e.target.value)}
                            placeholder={spec.label}
                          />
                        ) : null}
                        {key === 'followers' ? (
                          <p className="text-[11px] text-muted-foreground">
                            این فیلد نمی‌تواند خالی باشد.
                          </p>
                        ) : null}
                        {error ? (
                          <p className="text-[11px] text-destructive">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  پیش‌نمایش تغییرات
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {toPersianDigits(String(previewRows.length))} تغییر در{' '}
                  {toPersianDigits(String(selectedAccounts.length))} حساب
                </span>
              </div>
              {previewRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
                  تغییری برای نمایش نیست.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/40">
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          حساب
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          شبکه
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          دوره
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          فیلد
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          مقدار فعلی
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          مقدار جدید
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          وضعیت
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr
                          key={`${row.account.id}-${row.fieldKey}-${i}`}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-3 py-2">
                            <span className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {row.account.brand}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.account.username || '—'}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {SOCIAL_PLATFORM_LABELS[row.account.platform]}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {jalaliMonthName(monthlyLabel)}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {SOCIAL_METRIC_FIELDS[row.fieldKey].label}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {row.oldValue !== null
                              ? formatNumber(row.oldValue)
                              : 'خالی'}
                          </td>
                          <td className="px-3 py-2 font-medium tabular-nums text-foreground">
                            {row.newValue !== null
                              ? formatNumber(row.newValue)
                              : 'خالی'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="secondary"
                              className="border-0 bg-primary/10 text-primary"
                            >
                              تغییر
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {formError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'result' ? (
          <div className="flex flex-col gap-4">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <ResultCard
                    label="انتخاب‌شده"
                    value={result.total}
                    className="text-foreground"
                  />
                  <ResultCard
                    label="موفق"
                    value={result.success}
                    className="text-success"
                  />
                  <ResultCard
                    label="تعارض"
                    value={result.conflict}
                    className="text-amber-600 dark:text-amber-400"
                  />
                  <ResultCard
                    label="رد شده"
                    value={result.rejected}
                    className="text-destructive"
                  />
                  <ResultCard
                    label="خطا"
                    value={result.error}
                    className="text-destructive"
                  />
                </div>

                {result.historyWarnings > 0 ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    {toPersianDigits(String(result.historyWarnings))} رکورد
                    به‌روزرسانی شد اما ثبت تاریخچه برای آن‌ها انجام نشد.
                  </p>
                ) : null}

                {result.rows.some(
                  (r) => r.status !== 'success' || r.historyFailed,
                ) ? (
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-surface/30 p-2">
                    {result.rows.map((row, i) => {
                      const failed =
                        row.status !== 'success' || row.historyFailed;
                      if (!failed) return null;
                      return (
                        <div
                          key={`${row.accountId}-${i}`}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          <span className="text-foreground">
                            {accounts.find((a) => a.id === row.accountId)
                              ?.brand ?? row.accountId}
                            {row.status === 'conflict'
                              ? ' — ' + (row.message ?? 'تعارض')
                              : row.status === 'rejected'
                                ? ' — ' + (row.message ?? 'رد شده')
                                : row.historyFailed
                                  ? ' — ' + (row.message ?? 'خطای تاریخچه')
                                  : ' — ' + (row.message ?? 'خطا')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    همهٔ رکوردها با موفقیت به‌روزرسانی شدند.
                  </div>
                )}
              </>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                در حال دریافت نتیجه…
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {step === 'select' ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                انصراف
              </Button>
              <Button
                onClick={() => {
                  if (selectedAccounts.length === 0) {
                    setFormError('حداقل یک حساب دارای رکورد انتخاب کنید.');
                    return;
                  }
                  setFormError(null);
                  setStep('changes');
                }}
                disabled={selectedAccounts.length === 0}
              >
                ادامه
              </Button>
            </>
          ) : null}

          {step === 'changes' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFormError(null);
                  setStep('select');
                }}
                disabled={saving}
              >
                بازگشت
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                انصراف
              </Button>
              <Button
                onClick={handleApply}
                disabled={saving || changeCount === 0}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    در حال اعمال…
                  </>
                ) : (
                  <>
                    <PenLine className="h-3.5 w-3.5" />
                    تأیید و اعمال تغییرات
                    {selectedAccounts.length > 0
                      ? ` (${toPersianDigits(String(selectedAccounts.length))} رکورد)`
                      : ''}
                  </>
                )}
              </Button>
            </>
          ) : null}

          {step === 'result' ? (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              پایان
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface/50 p-3">
      <span className={cn('text-2xl font-bold tabular-nums', className)}>
        {formatNumber(value)}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
