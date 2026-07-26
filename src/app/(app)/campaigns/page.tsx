'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'برنامه‌ریزی و اجرای کمپین‌های رسانه‌ای',
  'تعریف اهداف، بازه زمانی و مخاطب هر کمپین',
  'پیگیری وضعیت کمپین (پیش‌نویس، زمان‌بندی، در حال اجرا، پایان‌یافته)',
  'اتصال محتوا و دارایی‌ها به کمپین',
];

export default function CampaignsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/campaigns']}
      futureActions={futureActions}
    />
  );
}
