'use client';

import { navItemByHref } from '@/config/navigation.config';
import { ModulePlaceholder } from '@/components/common/module-placeholder';

const futureActions = [
  'دریافت بینش‌های هوشمند درباره محیط رسانه‌ای',
  'تحلیل روندها و موضوعات داغ',
  'تشخیص فرصت‌های محتوایی',
  'پیشنهادهای مبتنی بر هوش مصنوعی برای محتوا و استراتژی',
];

export default function IntelligencePage() {
  return (
    <ModulePlaceholder
      item={navItemByHref['/intelligence']}
      futureActions={futureActions}
    />
  );
}
