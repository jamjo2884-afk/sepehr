'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsRow } from '@/components/settings/settings-row';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  { value: 'dark', label: 'تاریک', icon: '🌙' },
  { value: 'light', label: 'روشن', icon: '☀️' },
  { value: 'system', label: 'مطابق سیستم', icon: '💻' },
] as const;

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'راحت', description: 'فضای بیشتر بین عناصر' },
  { value: 'compact', label: 'فشرده', description: 'فضای کمتر، اطلاعات بیشتر' },
] as const;

export function AppearanceSettings() {
  const { appearance, updateAppearance } = useSettingsStore();
  const [local, setLocal] = useState({ ...appearance });
  const [saved, setSaved] = useState(false);

  const hasChanges =
    local.theme !== appearance.theme || local.density !== appearance.density;

  const handleSave = () => {
    updateAppearance(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocal({ ...appearance });
  };

  return (
    <SettingsSection
      title="ظاهر"
      description="تنظیمات نمایش و تم سیستم"
    >
      <SettingsRow label="حالت نمایش" description="انتخاب تم رنگی سیستم">
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setLocal((prev) => ({ ...prev, theme: opt.value }))
              }
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                local.theme === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="تراکم رابط کاربری" description="میزان فاصله بین عناصر">
        <div className="flex gap-2">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setLocal((prev) => ({ ...prev, density: opt.value }))
              }
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                local.density === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
