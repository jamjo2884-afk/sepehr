'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'آپلود و دسته‌بندی فایل‌های رسانه‌ای (تصویر، ویدیو، صوت، سند)',
  'برچسب‌گذاری و جستجوی سریع دارایی‌ها',
  'مشاهده پیش‌نمایش و متادیتای هر دارایی',
  'اتصال دارایی‌ها به پروژه‌ها و کمپین‌ها',
];

export default function AssetsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/assets']}
      futureActions={futureActions}
    />
  );
}
