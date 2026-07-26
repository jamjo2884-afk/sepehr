'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'ساخت و ویرایش پروژه‌های رسانه‌ای',
  'تعریف اهداف، مخاطبان و محدوده زمانی هر پروژه',
  'پیگیری پیشرفت پروژه و وضعیت مراحل آن',
  'تخصیص اعضای تیم و نقش‌ها به هر پروژه',
];

export default function ProjectsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/projects']}
      futureActions={futureActions}
    />
  );
}
