'use client';

import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsRow } from '@/components/settings/settings-row';
import { SYSTEM_INFO } from '@/types/settings';
import { Server, Database, Calendar, Tag } from 'lucide-react';

export function SystemSettings() {
  return (
    <SettingsSection
      title="سیستم"
      description="اطلاعات نسخه و وضعیت سیستم"
    >
      <SettingsRow
        label="نسخه"
        description="نسخه فعلی سیستم"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          {SYSTEM_INFO.version}
        </span>
      </SettingsRow>

      <SettingsRow
        label="محیط"
        description="محیط اجرایی فعلی"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Server className="h-3.5 w-3.5" />
          {SYSTEM_INFO.environment}
        </span>
      </SettingsRow>

      <SettingsRow
        label="پایگاه داده"
        description="سیستم مدیریت پایگاه داده"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          {SYSTEM_INFO.database}
        </span>
      </SettingsRow>

      <SettingsRow
        label="آخرین مایگریشن"
        description="تاریخ آخرین تغییرات دیتابیس"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {SYSTEM_INFO.lastMigration}
        </span>
      </SettingsRow>
    </SettingsSection>
  );
}
