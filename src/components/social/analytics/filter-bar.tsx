'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, Filter } from 'lucide-react';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_RANGE_PRESET_LABELS } from '@/types/social';
import type { SocialMonthRange, SocialRangePreset } from '@/types/social';
import { jalaliMonthName } from '@/services/social-analytics';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const PRESET_ORDER: Array<Exclude<SocialRangePreset, 'custom'>> = [
  'current',
  'previous',
  '3m',
  '6m',
  '12m',
  '24m',
];

/** Analytical filter bar: brand (multi), platform (multi), month range. */
export function AnalyticsFilterBar({
  brands,
  selectedBrands,
  onToggleBrand,
  platforms,
  selectedPlatforms,
  onTogglePlatform,
  rangePreset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  availableMonths,
  manageButton,
}: {
  brands: string[];
  selectedBrands: string[];
  onToggleBrand: (brand: string) => void;
  platforms: SocialPlatform[];
  selectedPlatforms: SocialPlatform[];
  onTogglePlatform: (platform: SocialPlatform | '__all__') => void;
  rangePreset: SocialRangePreset;
  onPresetChange: (preset: SocialRangePreset) => void;
  customRange: SocialMonthRange | null;
  onCustomRangeChange: (range: SocialMonthRange) => void;
  availableMonths: string[];
  manageButton?: React.ReactNode;
}) {
  const allBrands = selectedBrands.length === 0;
  const allPlatforms = selectedPlatforms.length === 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
        <Filter className="h-4 w-4 text-primary" />
        فیلترهای تحلیلی
      </div>

      {/* Brand multi-select */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            برند ({allBrands ? 'همه' : `${selectedBrands.length} انتخابشده`})
          </span>
          {manageButton}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={allBrands}
            onClick={() => {
              if (!allBrands) onToggleBrand('__all__');
            }}
            label="همه برندها"
          />
          {brands.map((brand) => (
            <FilterChip
              key={brand}
              active={selectedBrands.includes(brand)}
              onClick={() => onToggleBrand(brand)}
              label={brand}
            />
          ))}
        </div>
      </div>

      {/* Platform multi-select */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          پلتفرم (
          {allPlatforms ? 'همه' : `${selectedPlatforms.length} انتخابشده`})
        </span>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={allPlatforms}
            onClick={() => {
              if (!allPlatforms) onTogglePlatform('__all__');
            }}
            label="همه پلتفرمها"
          />
          {platforms.map((platform) => (
            <FilterChip
              key={platform}
              active={selectedPlatforms.includes(platform)}
              onClick={() => onTogglePlatform(platform)}
              icon={
                <SocialPlatformIcon
                  platform={platform}
                  className="h-4 w-4 rounded-full"
                  iconClassName="h-2.5 w-2.5"
                />
              }
              label={SOCIAL_PLATFORM_LABELS[platform]}
            />
          ))}
        </div>
      </div>

      {/* Month range */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          بازه زمانی
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={rangePreset}
            onValueChange={(v) => onPresetChange(v as SocialRangePreset)}
          >
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ORDER.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {SOCIAL_RANGE_PRESET_LABELS[preset]}
                </SelectItem>
              ))}
              <SelectItem value="custom">بازه سفارشی</SelectItem>
            </SelectContent>
          </Select>

          {rangePreset === 'custom' ? (
            <CustomRangePicker
              availableMonths={availableMonths}
              value={customRange}
              onChange={onCustomRangeChange}
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              {rangePreset === 'current' ||
              rangePreset === 'previous' ||
              rangePreset === '3m' ||
              rangePreset === '6m' ||
              rangePreset === '12m' ||
              rangePreset === '24m'
                ? 'تا پایان ماه جاری'
                : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Two Jalali month selects for a custom range; applied on confirm. */
function CustomRangePicker({
  availableMonths,
  value,
  onChange,
}: {
  availableMonths: string[];
  value: SocialMonthRange | null;
  onChange: (range: SocialMonthRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = useMemo(
    () => [...availableMonths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    [availableMonths],
  );
  const defaultStart = months[0] ?? '';
  const defaultEnd = months[months.length - 1] ?? '';
  const [draftStart, setDraftStart] = useState(value?.start ?? defaultStart);
  const [draftEnd, setDraftEnd] = useState(value?.end ?? defaultEnd);

  const apply = () => {
    if (!draftStart || !draftEnd) return;
    const start = draftStart <= draftEnd ? draftStart : draftEnd;
    const end = draftStart <= draftEnd ? draftEnd : draftStart;
    onChange({ start, end });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
          <CalendarRange className="h-3.5 w-3.5" />
          {value
            ? `${jalaliMonthName(value.start)} — ${jalaliMonthName(value.end)}`
            : 'انتخاب بازه'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              از ماه
            </span>
            <Select
              value={draftStart}
              onValueChange={(v) => {
                setDraftStart(v);
                if (draftEnd && v > draftEnd) setDraftEnd(v);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {jalaliMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              تا ماه
            </span>
            <Select
              value={draftEnd}
              onValueChange={(v) => {
                setDraftEnd(v);
                if (draftStart && v < draftStart) setDraftStart(v);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {jalaliMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={apply} className="w-full">
            اعمال بازه
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
