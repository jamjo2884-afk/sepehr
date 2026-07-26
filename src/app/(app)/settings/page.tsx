'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'پیکربندی اطلاعات فضای کاری',
  'مدیریت اعضای تیم و نقش‌ها',
  'تنظیمات حساب کاربری و امنیت',
  'پیکربندی اعلان‌ها و یکپارچه‌سازی‌ها',
];

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/settings']}
      futureActions={futureActions}
    />
  );
}
