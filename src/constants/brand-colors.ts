/**
 * Brand color palette.
 *
 * Primary colors extracted from logo PNGs via sharp pixel analysis.
 * Secondary/fallback colors chosen from a harmonious palette for brands
 * without logos or with near-monochrome logos.
 *
 * Each brand gets:
 *   - `primary`: main brand color (from logo or identity)
 *   - `light`: light variant for backgrounds/gradients (primary + 15% opacity)
 *   - `chart`: slightly adjusted for chart readability
 */

export interface BrandColor {
  primary: string;
  light: string;
  chart: string;
}

/**
 * برندهایی که باید در همه جا نادیده گرفته شوند.
 * این برندها آمار صفر دارند و حذف شده‌اند.
 */
export const IGNORED_BRANDS: Set<string> = new Set([
  'آوانت',
  'افشاگری',
  'اقتصاددان شوید',
  'برجام',
  'پادتن',
  'پاراگراف',
  'تارکد',
  'جهان نما',
  'شهروند نگار',
  'فرجه',
  'فرهنگ',
  'مایه شرمساری',
  'مستقیم بهشت',
]);

/** بررسی اینکه آیا برند نادیده گرفته شده */
export function isBrandIgnored(brand: string): boolean {
  return IGNORED_BRANDS.has(brand);
}

/**
 * کلیدها باید دقیقاً با `brand` ذخیره‌شده در دیتابیس مطابقت داشته باشند.
 * فرمت: hex رنگ اصلی + رنگ روشن برای گرادیانت + رنگ نمودار
 */
export const BRAND_COLORS: Record<string, BrandColor> = {
  // ── برندهای دارای لوگو (رنگ استخراج‌شده از پیکسل) ──────────────────
  کبریت: {
    primary: '#E02020', // آتشی/قرمز
    light: '#E0202018',
    chart: '#E02020',
  },
  'نود اقتصادی': {
    primary: '#DC2626', // قرمز خبری
    light: '#DC262618',
    chart: '#DC2626',
  },
  'صد درجه': {
    primary: '#E00020', // قرمز پررنگ
    light: '#E0002018',
    chart: '#E00020',
  },
  'پل استودیو': {
    primary: '#E06020', // نارنجی گرم
    light: '#E0602018',
    chart: '#E06020',
  },
  ازما: {
    primary: '#2D6A4F', // سبز تیره علمی
    light: '#2D6A4F18',
    chart: '#2D6A4F',
  },
  'فصل 11': {
    primary: '#2D6B6B', // سبزآبی تیره
    light: '#2D6B6B18',
    chart: '#2D6B6B',
  },
  مردمک: {
    primary: '#B45309', // قهوه‌ای نارنجی
    light: '#B4530918',
    chart: '#B45309',
  },
  'نسیم آنلاین': {
    primary: '#0D7377', // فیروزه‌ای
    light: '#0D737718',
    chart: '#0D7377',
  },
  'رهبر سوم': {
    primary: '#16A34A', // سبز
    light: '#16A34A18',
    chart: '#16A34A',
  },
  روشنگری: {
    primary: '#92400E', // قهوه‌ای طلایی
    light: '#92400E18',
    chart: '#92400E',
  },
  'سینه فیلیا': {
    primary: '#6D28D9', // بنفش سینمایی
    light: '#6D28D918',
    chart: '#6D28D9',
  },
  مرورگر: {
    primary: '#7C1D1D', // زرشکی تیره
    light: '#7C1D1D18',
    chart: '#7C1D1D',
  },

  // ── برندهای بدون لوگو (رنگ‌های پیشنهادی هماهنگ) ─────────────────────
  'دیده بان دولت': {
    primary: '#1E40AF', // آبی دولتی
    light: '#1E40AF18',
    chart: '#1E40AF',
  },
  'جنگ با ارزو ها': {
    primary: '#B91C1C', // قرمز جنگی
    light: '#B91C1C18',
    chart: '#B91C1C',
  },
  'کف خیابون': {
    primary: '#D97706', // نارنجی خیابانی
    light: '#D9770618',
    chart: '#D97706',
  },
};

/**
 * رنگ پیش‌فرض برای برندهایی که در نقشه نیستند.
 */
export const BRAND_COLOR_FALLBACK: BrandColor = {
  primary: '#6B7280',
  light: '#6B728018',
  chart: '#6B7280',
};

/**
 * دریافت رنگ یک برند — با fallback امن.
 */
export function getBrandColor(brand: string): BrandColor {
  return BRAND_COLORS[brand] ?? BRAND_COLOR_FALLBACK;
}

/**
 * لیست تمام رنگ‌های نمودار (برای time-series چندبرندی).
 * هر رنگ یکتا و متمایز است.
 */
export const CHART_PALETTE: string[] = [
  '#E02020', // قرمز
  '#1E40AF', // آبی
  '#2D6A4F', // سبز
  '#D97706', // نارنجی
  '#7C3AED', // بنفش
  '#0D7377', // فیروزه‌ای
  '#DC2626', // قرمز تیره
  '#9333EA', // بنفش روشن
  '#059669', // سبز روشن
  '#B45309', // قهوه‌ای
  '#0891B2', // cyan
  '#E06020', // نارنجی گرم
  '#6D28D9', // violet
  '#16A34A', // سبز
  '#0E7490', // teal
  '#A16207', // طلایی
  '#B91C1C', // قرمز جنگی
  '#2563EB', // آبی
  '#7C1D1D', // زرشکی
  '#92400E', // قهوه‌ای طلایی
];
