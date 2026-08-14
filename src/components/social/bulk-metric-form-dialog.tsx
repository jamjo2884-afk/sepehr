'use client';

import { useEffect, useMemo, useState } from 'react';
import { jalaaliToDateObject } from 'jalaali-js';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import type { SocialAccount } from '@/types/social';
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
import { toPersianDigits } from '@/utils/persian';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { Button } from '@/components/ui/button';
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

/**
 * Bulk monthly metric form: pick several accounts (filtered by brand /
 * platform), one Jalali month, enter the metric values once — and every
 * selected account gets a row in a single upsert. The fields shown are the
 * union of the fields the selected accounts' platforms support; the service
 * writes only the columns each platform actually records.
 */
export function BulkMetricFormDialog({
  open,
  onOpenChange,
  accounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SocialAccount[];
  /** Called with the number of rows written after a successful save. */
  onSaved: (count: number) => void;
}) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [monthlyLabel, setMonthlyLabel] = useState(currentJalaliMonth());
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Union of the metric fields supported by the selected accounts.
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

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setBrandFilter('all');
    setPlatformFilter('all');
    setSelectedIds(new Set());
    setMonthlyLabel(currentJalaliMonth());
    setValues({});
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
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
      const allSelected = filteredAccounts.every((a) => prev.has(a.id));
      const next = new Set(prev);
      for (const a of filteredAccounts) {
        if (allSelected) next.delete(a.id);
        else next.add(a.id);
      }
      return next;
    });
  };

  const setField = (key: SocialMetricFieldKey, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
    return null;
  };

  const buildPayload = (): Record<string, number | null> => {
    const payload: Record<string, number | null> = {};
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
    if (selectedAccounts.length === 0) {
      setFormError('حداقل یک حساب انتخاب کنید.');
      return;
    }
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError(null);

    const { recordSocialMetricsBulk } =
      await import('@/services/social.service');
    const [jy, jm] = monthlyLabel.split('-').map(Number);
    const date = jalaaliToDateObject(jy, jm, 1);
    const count = await recordSocialMetricsBulk(
      selectedAccounts.map((a) => ({ id: a.id, platform: a.platform })),
      'monthly',
      buildPayload(),
      { date },
    );
    setSaving(false);
    if (count === null) {
      setFormError('ثبت آمار انجام نشد. لطفاً دوباره تلاش کنید.');
      return;
    }
    onSaved(count);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>ثبت انبوه آمار ماهانه</DialogTitle>
          <DialogDescription>
            چند حساب انتخاب کنید، مقادیر را یک بار وارد کنید — برای همهٔ
            انتخاب‌شده‌ها در یک دوره ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>

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
                <Label className="text-xs text-muted-foreground">پلتفرم</Label>
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
              <span>
                {filteredAccounts.length > 0
                  ? 'انتخاب همهٔ حساب‌های نمایش‌داده‌شده'
                  : 'حسابی برای انتخاب نیست'}
              </span>
              <span className="font-medium text-foreground">
                {toPersianDigits(String(filteredAccounts.length))} حساب
              </span>
            </button>

            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface/30 p-2">
              {filteredAccounts.map((a) => {
                const checked = selectedIds.has(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface/70"
                  >
                    <Checkbox
                      checked={checked}
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
                      {SOCIAL_PLATFORM_LABELS[a.platform]}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {toPersianDigits(String(selectedAccounts.length))} حساب انتخاب شده
              است.
            </p>
          </div>

          {/* Dynamic metric fields (union of selected platforms) */}
          {platformFields.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {platformFields.map((key) => {
                const spec = SOCIAL_METRIC_FIELDS[key];
                const error = fieldErrors[key];
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {spec.label}
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
          ) : null}

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
          <Button
            onClick={handleSubmit}
            disabled={saving || selectedAccounts.length === 0}
          >
            {saving
              ? 'در حال ثبت…'
              : selectedAccounts.length > 0
                ? `ثبت برای ${toPersianDigits(String(selectedAccounts.length))} حساب`
                : 'ابتدا حساب انتخاب کنید'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
