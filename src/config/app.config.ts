export const appConfig = {
  name: 'Media Deck',
  nameEn: 'MEDIA DECK',
  description: 'پلتفرم هوشمند مدیریت، تحلیل و مانیتورینگ رسانه',
  version: '0.1.0',
  locale: 'fa-IR',
  direction: 'rtl' as const,
  defaultWorkspace: 'فضای کاری پیش‌فرض',
};

export type AppConfig = typeof appConfig;
