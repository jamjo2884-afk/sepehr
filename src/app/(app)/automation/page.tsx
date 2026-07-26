'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'تعریف قوانین اتوماسیون (ماشه → کنش)',
  'فعال‌سازی و غیرفعال‌سازی جریان‌های کاری',
  'اتصال اتوماسیون به پروژه‌ها و کمپین‌ها',
  'پایش اجرای اتوماسیون‌ها و گزارش آن‌ها',
];

export default function AutomationPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/automation']}
      futureActions={futureActions}
    />
  );
}
