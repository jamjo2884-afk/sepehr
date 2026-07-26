'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'ثبت و پیگیری کارهای عملیاتی هر پروژه',
  'تعریف نوع عملیات (برنامه‌ریزی، تولید، بازبینی، توزیع، پایش)',
  'تخصیص مسئولین و مهلت‌ها به هر عملیات',
  'مشاهده وضعیت کلی عملیات در یک نمای واحد',
];

export default function OperationsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/operations']}
      futureActions={futureActions}
    />
  );
}
