'use client';

import { useEffect, useMemo, useState } from 'react';
import { jalaaliMonthLength, jalaaliToDateObject, toJalaali } from 'jalaali-js';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import type {
  SocialAccount,
  SocialMetric,
  SocialMetricPeriod,
  SocialMetricValues,
} from '@/types/social';
import { SOCIAL_METRIC_PERIODS } from '@/types/social';
import {
  jalaliAddMonths,
  currentJalaliMonth,
  jalaliMonthName,
} from '@/services/social-analytics';
import {
  periodLabelForDate,
  weeklyRangeForDate,
} from '@/services/social-metrics';
import {
  PLATFORM_METRIC_FIELDS,
  SOCIAL_METRIC_FIELDS,
  platformFollowersLabel,
  type SocialMetricFieldKey,
} from '@/constants/social-fields';
import { toLatinDigits, toPersianDigits } from '@/utils/persian';
import { Button } from '@/components/ui/button';
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

const PERIOD_LABELS: Record<SocialMetricPeriod, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

function parseJalaliDate(input: string): Date | null {
  const m = toLatinDigits(input.trim()).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;
  return jalaaliToDateObject(jy, jm, jd);
}

function todayJalaliString(): string {
  const { jy, jm, jd } = toJalaali(new Date());
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

function jalaliDateFromISO(iso: string | null): string {
  if (!iso) return todayJalaliString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayJalaliString();
  const { jy, jm, jd } = toJalaali(d);
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

/**
 * Dynamic metric form (record / edit). Renders exactly the fields the
 * selected account's platform supports (from PLATFORM_METRIC_FIELDS).
 *
 * - Empty inputs are stored as NULL (except `followers`, which is NOT NULL
 *   in the schema and defaults to 0); an explicit 0 is stored as 0.
 * - Duplicates are impossible: re-recording the same account + period +
 *   label updates the existing row (UNIQUE constraint).
 * - Editing can change EVERY option — account, period, month/date and the
 *   metric values. Moving a row onto an existing (account, period, label)
 *   key is rejected (client-side when `existingMetrics` is provided, and
 *   always by the service).
 */
export function MetricFormDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
  metric,
  existingMetrics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SocialAccount[];
  /** Preselected account for creation mode. */
  defaultAccountId?: string;
  /** When set, the dialog edits this existing metric. */
  metric?: SocialMetric | null;
  /** All loaded metrics — enables a friendly duplicate-key pre-check. */
  existingMetrics?: SocialMetric[];
  onSaved: (metric: SocialMetric, mode: 'create' | 'update') => void;
}) {
  const isEdit = Boolean(metric);
  const [accountId, setAccountId] = useState('');
  const [period, setPeriod] = useState<SocialMetricPeriod>('monthly');
  const [monthlyLabel, setMonthlyLabel] = useState(currentJalaliMonth());
  const [dateInput, setDateInput] = useState(todayJalaliString());
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );
  const platform: SocialPlatform | null = account?.platform ?? null;

  const monthOptions = useMemo(() => {
    const now = currentJalaliMonth();
    const out: string[] = [];
    for (let i = 35; i >= 0; i -= 1) out.push(jalaliAddMonths(now, -i));
    return out;
  }, []);

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (metric) {
      setAccountId(metric.accountId);
      setPeriod(metric.period);
      if (metric.period === 'monthly') {
        setMonthlyLabel(metric.periodLabel);
      } else {
        setDateInput(jalaliDateFromISO(metric.periodStart));
      }
      const init: Record<string, string> = {};
      for (const key of Object.keys(SOCIAL_METRIC_FIELDS)) {
        const value = (metric as unknown as Record<string, unknown>)[key];
        if (typeof value === 'number') init[key] = String(value);
      }
      setValues(init);
    } else {
      setAccountId(defaultAccountId ?? accounts[0]?.id ?? '');
      setPeriod('monthly');
      setMonthlyLabel(currentJalaliMonth());
      setDateInput(todayJalaliString());
      setValues({});
    }
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
  }, [open, metric, defaultAccountId, accounts]);

  const platformFields: SocialMetricFieldKey[] = useMemo(() => {
    if (!platform) return [];
    return PLATFORM_METRIC_FIELDS[platform];
  }, [platform]);

  const weeklyInfo = useMemo(() => {
    if (period !== 'weekly') return null;
    const date = parseJalaliDate(dateInput);
    if (!date) return null;
    const range = weeklyRangeForDate(date);
    return {
      label: periodLabelForDate(date, 'weekly'),
      start: jalaliDateFromISO(range.start),
      end: jalaliDateFromISO(range.end),
    };
  }, [period, dateInput]);

  const setField = (key: SocialMetricFieldKey, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** The (account, period, periodLabel) key the form would write. */
  const targetIdentity = (): {
    accountId: string;
    period: SocialMetricPeriod;
    periodLabel: string;
  } | null => {
    if (period === 'monthly') {
      const [jy, jm] = monthlyLabel.split('-').map(Number);
      if (!jy || !jm) return null;
      return { accountId, period, periodLabel: monthlyLabel };
    }
    const date = parseJalaliDate(dateInput);
    if (!date) return null;
    return { accountId, period, periodLabel: periodLabelForDate(date, period) };
  };

  /** Another row already occupying the target key (edit mode only). */
  const findDuplicate = (): SocialMetric | null => {
    if (!isEdit || !metric || !existingMetrics) return null;
    const target = targetIdentity();
    if (!target) return null;
    return (
      existingMetrics.find(
        (m) =>
          m.id !== metric.id &&
          m.accountId === target.accountId &&
          m.period === target.period &&
          m.periodLabel === target.periodLabel,
      ) ?? null
    );
  };

  const validate = (): string | null => {
    const errors: Record<string, string> = {};
    for (const key of platformFields) {
      const raw = (values[key] ?? '').trim();
      if (raw === '') continue;
      const n = Number(raw);
      const spec = SOCIAL_METRIC_FIELDS[key];
      if (!Number.isFinite(n)) {
        errors[key] = 'مقدار عددی وارد کنید.';
      } else if (n < 0) {
        errors[key] = 'مقدار نمی‌تواند منفی باشد.';
      } else if (spec.kind === 'percent' && n > (spec.max ?? 100)) {
        errors[key] = `حداکثر ${toPersianDigits(String(spec.max ?? 100))} است.`;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return 'مقادیر واردشده را بررسی کنید.';
    if (period !== 'monthly' && !parseJalaliDate(dateInput)) {
      setFormError('تاریخ شمسی را به شکل ۱۴۰۵-۰۵-۲۳ وارد کنید.');
      return 'تاریخ نامعتبر است.';
    }
    return null;
  };

  const buildPayload = (): SocialMetricValues => {
    const payload: SocialMetricValues = {};
    for (const key of platformFields) {
      const raw = (values[key] ?? '').trim();
      if (raw === '') {
        // NULL = "not provided": the service keeps the stored value on
        // re-record and defaults to 0 only for brand-new rows. Explicit 0
        // is stored as 0 by the number path below.
        payload[key] = null;
        continue;
      }
      payload[key] = Number(raw);
    }
    return payload;
  };

  const handleSubmit = async () => {
    if (!account || !platform) {
      setFormError('حساب را انتخاب کنید.');
      return;
    }
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }

    const payload = buildPayload();

    // Resolve the anchor date for the chosen period — it defines the row
    // key (period_label + range) through the canonical helpers.
    let date = new Date();
    if (period === 'monthly') {
      const [jy, jm] = monthlyLabel.split('-').map(Number);
      if (!jy || !jm) {
        setFormError('ماه نامعتبر است.');
        return;
      }
      date = jalaaliToDateObject(jy, jm, 1);
    } else {
      const parsed = parseJalaliDate(dateInput);
      if (!parsed) {
        setFormError('تاریخ شمسی نامعتبر است.');
        setSaving(false);
        return;
      }
      date = parsed;
    }

    setSaving(true);
    setFormError(null);

    const { recordSocialMetrics, updateSocialMetric } =
      await import('@/services/social.service');

    if (isEdit && metric) {
      const duplicate = findDuplicate();
      if (duplicate) {
        const label =
          duplicate.period === 'monthly'
            ? jalaliMonthName(duplicate.periodLabel)
            : toPersianDigits(duplicate.periodLabel);
        setFormError(
          `این دوره (${label}) برای این حساب قبلاً ثبت شده است.`,
        );
        setSaving(false);
        return;
      }
      const updated = await updateSocialMetric(metric.id, payload, {
        identity: { accountId, period, date },
        expectedUpdatedAt: metric.updatedAt,
      });
      if (!updated) {
        setFormError('ذخیره تغییرات انجام نشد. لطفاً دوباره تلاش کنید.');
        setSaving(false);
        return;
      }
      onSaved(updated, 'update');
    } else {
      const created = await recordSocialMetrics(account.id, period, payload, {
        date,
      });
      if (!created) {
        setFormError('ثبت آمار انجام نشد. لطفاً دوباره تلاش کنید.');
        setSaving(false);
        return;
      }
      onSaved(created, 'create');
    }
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش آمار' : 'ثبت آمار جدید'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'حساب، دوره و مقادیر را ویرایش کنید. اگر دورهٔ انتخابی برای این حساب قبلاً ثبت شده باشد، ذخیره انجام نمی‌شود.'
              : 'آمار این دوره برای حساب انتخاب‌شده ثبت می‌شود. ثبت مجدد همان دوره، رکورد قبلی را به‌روزرسانی می‌کند.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Account */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">حساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="انتخاب حساب…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.brand} — {SOCIAL_PLATFORM_LABELS[a.platform]} —{' '}
                    {a.username || a.displayName || '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">دوره</Label>
              <Select
                value={period}
                onValueChange={(v) => {
                  setPeriod(v as SocialMetricPeriod);
                  setFormError(null);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_METRIC_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {period === 'monthly'
                  ? 'ماه'
                  : period === 'weekly'
                    ? 'تاریخ شروع هفته'
                    : 'تاریخ'}
              </Label>
              {period === 'monthly' ? (
                <Select
                  value={monthlyLabel}
                  onValueChange={setMonthlyLabel}
                >
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
              ) : (
                <div className="flex gap-2">
                  <Input
                    className="h-9 text-xs"
                    dir="ltr"
                    value={dateInput}
                    onChange={(e) => {
                      setDateInput(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="۱۴۰۵-۰۵-۲۳"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 text-xs"
                    onClick={() => {
                      setDateInput(todayJalaliString());
                      setFormError(null);
                    }}
                  >
                    امروز
                  </Button>
                </div>
              )}
              {period === 'weekly' && weeklyInfo ? (
                <p className="text-[11px] text-muted-foreground">
                  هفتهٔ {toPersianDigits(weeklyInfo.label)} ({weeklyInfo.start}{' '}
                  تا {weeklyInfo.end})
                </p>
              ) : null}
            </div>
          </div>

          {/* Dynamic metric fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {platformFields.map((key) => {
              const spec = SOCIAL_METRIC_FIELDS[key];
              const fieldLabel = key === 'followers' && platform ? platformFollowersLabel(platform) : spec.label;
              const error = fieldErrors[key];
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {fieldLabel}
                  </Label>
                  <Input
                    type="number"
                    dir="ltr"
                    min={0}
                    max={spec.max}
                    step={spec.kind === 'percent' ? 'any' : 1}
                    hasError={Boolean(error)}
                    value={values[key] ?? ''}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={
                      key === 'followers' ? '۰' : 'خالی = بدون مقدار'
                    }
                  />
                  {error ? (
                    <p className="text-[11px] text-destructive">{error}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {formError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            انصراف
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !account}>
            {saving ? 'در حال ذخیره…' : isEdit ? 'ذخیره تغییرات' : 'ثبت آمار'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
