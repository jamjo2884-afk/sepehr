'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'ثبت و دسته‌بندی مقالات، یادداشت‌ها و راهنماها',
  'جستجوی سریع در میان دانش سازمانی',
  'اتصال آیتم‌های دانش به پروژه‌ها',
  'اشتراک‌گذاری راهنماهای عملیاتی با تیم',
];

export default function KnowledgePage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/knowledge']}
      futureActions={futureActions}
    />
  );
}
