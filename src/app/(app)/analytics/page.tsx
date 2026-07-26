'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'مشاهده گزارش‌های تحلیلی عملکرد پروژه‌ها و کمپین‌ها',
  'مقایسه شاخص‌ها در بازه‌های زمانی مختلف',
  'تحلیل تعامل، دسترسی و رشد مخاطبان',
  'تولید گزارش‌های دوره‌ای و اشتراک‌گذاری آن‌ها',
];

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/analytics']}
      futureActions={futureActions}
    />
  );
}
