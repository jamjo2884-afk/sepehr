'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'تعریف بخش‌های مختلف مخاطبان با معیارهای مشخص',
  'بررسی اندازه و ویژگی‌های هر بخش مخاطب',
  'هدف‌گذاری کمپین‌ها برای بخش‌های خاص',
  'شناخت رفتار و ترجیحات مخاطبان',
];

export default function AudiencePage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/audience']}
      futureActions={futureActions}
    />
  );
}
