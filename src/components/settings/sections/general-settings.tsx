'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsRow } from '@/components/settings/settings-row';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw } from 'lucide-react';

const TIMEZONES = [
  { value: 'Asia/Tehran', label: 'تهران (UTC+3:30)' },
  { value: 'Asia/Dubai', label: 'دبی (UTC+4)' },
  { value: 'Europe/London', label: 'لندن (UTC+0)' },
  { value: 'America/New_York', label: 'نیویورک (UTC-5)' },
  { value: 'Asia/Tokyo', label: 'توکیو (UTC+9)' },
];

const DATE_FORMATS = [
  { value: 'jalali', label: 'شمسی' },
  { value: 'gregorian', label: 'میلادی' },
  { value: 'auto', label: 'مطابق سیستم' },
] as const;

export function GeneralSettings() {
  const { general, updateGeneral } = useSettingsStore();
  const [local, setLocal] = useState({ ...general });
  const [saved, setSaved] = useState(false);

  const hasChanges =
    local.workspaceName !== general.workspaceName ||
    local.timezone !== general.timezone ||
    local.dateFormat !== general.dateFormat;

  const handleSave = () => {
    updateGeneral(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocal({ ...general });
  };

  return (
    <SettingsSection
      title="تنظیمات عمومی"
      description="تنظیمات پایه فضای کاری و نمایش"
    >
      <SettingsRow
        label="نام نمایشی"
        description="نامی که در سیستم نمایش داده می‌شود"
      >
        <Input
          value={local.workspaceName}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, workspaceName: e.target.value }))
          }
          className="w-48 text-left"
          dir="ltr"
        />
      </SettingsRow>

      <SettingsRow label="منطقه زمانی" description="منطقه زمانی سیستم">
        <select
          value={local.timezone}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, timezone: e.target.value }))
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </SettingsRow>

      <SettingsRow label="قالب تاریخ" description="فرمت نمایش تاریخ">
        <select
          value={local.dateFormat}
          onChange={(e) =>
            setLocal((prev) => ({
              ...prev,
              dateFormat: e.target.value as typeof local.dateFormat,
            }))
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {DATE_FORMATS.map((df) => (
            <option key={df.value} value={df.value}>
              {df.label}
            </option>
          ))}
        </select>
      </SettingsRow>

      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges}
          className="gap-1.5"
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              ذخیره شد
            </>
          ) : (
            'ذخیره تغییرات'
          )}
        </Button>
        {hasChanges && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            بازنشانی
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}
