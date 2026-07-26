export const appConfig = {
  name: 'مدیا اواس',
  nameEn: 'MediaOS',
  description: 'سیستم‌عامل رسانه‌ای مبتنی بر هوش مصنوعی',
  version: '0.1.0',
  locale: 'fa-IR',
  direction: 'rtl' as const,
  defaultWorkspace: 'فضای کاری پیش‌فرض',
};

export type AppConfig = typeof appConfig;
