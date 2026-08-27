'use client';

import { Settings, Palette, Share2, Bell, Server, ChevronLeft } from 'lucide-react';
import type { SettingsCategory } from '@/types/settings';
import { SETTINGS_CATEGORIES } from '@/types/settings';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<SettingsCategory, React.ElementType> = {
  general: Settings,
  appearance: Palette,
  social: Share2,
  notifications: Bell,
  system: Server,
};

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

export function SettingsSidebar({
  activeCategory,
  onSelect,
}: SettingsSidebarProps) {
  return (
    <nav className="flex flex-col gap-1">
      {SETTINGS_CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICONS[cat.id];
        const active = activeCategory === cat.id;
        const disabled = !cat.enabled;

        return (
          <button
            key={cat.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            />
            <span className="flex-1 text-right">{cat.label}</span>
            {!disabled && (
              <ChevronLeft
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              />
            )}
            {disabled && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                به‌زودی
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
