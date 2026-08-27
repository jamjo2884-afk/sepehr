'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { SettingsCategory } from '@/types/settings';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { GeneralSettings } from '@/components/settings/sections/general-settings';
import { AppearanceSettings } from '@/components/settings/sections/appearance-settings';
import { SocialSettings } from '@/components/settings/sections/social-settings';
import { SystemSettings } from '@/components/settings/sections/system-settings';

export function SettingsLayout() {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>('general');

  const hydrateFromServer = useSettingsStore((s) => s.hydrateFromServer);
  const isLoading = useSettingsStore((s) => s.isLoading);

  // Hydrate settings from Supabase on mount
  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  // Derive platform counts from the settings store for now; in a future
  // phase this would come from a server-side data source.
  const platformCounts = useSettingsStore(() => ({}));

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            در حال بارگذاری تنظیمات...
          </p>
        </div>
      );
    }

    switch (activeCategory) {
      case 'general':
        return <GeneralSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'social':
        return <SocialSettings platformCounts={platformCounts} />;
      case 'notifications':
        return (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              اعلان‌ها در نسخه‌های بعدی فعال خواهند شد.
            </p>
          </div>
        );
      case 'system':
        return <SystemSettings />;
    }
  }, [activeCategory, platformCounts, isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          تنظیمات
        </h1>
        <p className="text-sm text-muted-foreground">
          مدیریت تنظیمات Media Deck
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="rounded-xl border border-border bg-surface/60 p-3">
            <SettingsSidebar
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="relative rounded-xl border border-border bg-surface/60 p-6">
            {content}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
