'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'زمان‌بندی انتشار محتوا در کانال‌ها و پلتفرم‌های مختلف',
  'پیگیری وضعیت انتشار هر محتوا',
  'مدیریت نسخه‌های منتشرشده و تاریخچه آن‌ها',
  'اتصال توزیع به کمپین‌ها و پروژه‌ها',
];

export default function DistributionPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/distribution']}
      futureActions={futureActions}
    />
  );
}
