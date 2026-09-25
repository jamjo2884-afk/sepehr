import {
  LayoutDashboard,
  ListTodo,
  ClipboardList,
  Package,
  Rocket,
  Share2,
  Megaphone,
  Users,
  BarChart3,
  BrainCircuit,
  Bot,
  BookOpen,
  Bell,
  Settings,
  Award,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /**
   * Section identity color (v2 design system). One hue per main area so
   * the user knows at a glance where they are. Values are the names of
   * the `--section-*` design tokens (see globals.css / docs/design-tokens.md).
   */
  section:
    | 'command'
    | 'tasks'
    | 'content'
    | 'brands'
    | 'social'
    | 'finance'
    | 'analytics';
};

/** Map a section token name to its CSS custom property. */
export const sectionTintVar: Record<NavItem['section'], string> = {
  command: 'var(--section-command)',
  tasks: 'var(--section-tasks)',
  content: 'var(--section-content)',
  brands: 'var(--section-brands)',
  social: 'var(--section-social)',
  finance: 'var(--section-finance)',
  analytics: 'var(--section-analytics)',
};

export const navItems: NavItem[] = [
  {
    id: 'command-center',
    label: 'مرکز فرمان',
    href: '/command-center',
    icon: LayoutDashboard,
    description: 'نمای کلی عملیات رسانه‌ای و نقطه شروع روزانه شما',
    section: 'command',
  },
  {
    id: 'tasks',
    label: 'کارها',
    href: '/tasks',
    icon: ListTodo,
    description: 'مدیریت وظایف، پروژه‌ها و عملیات',
    section: 'tasks',
  },
  {
    id: 'content',
    label: 'محتوا',
    href: '/content',
    icon: ClipboardList,
    description: 'چرخه تولید محتوا: پیش‌نویس تا انتشار',
    section: 'content',
  },
  {
    id: 'assets',
    label: 'دارایی‌های رسانه‌ای',
    href: '/assets',
    icon: Package,
    description: 'آرشیو و مدیریت فایل‌ها و دارایی‌های رسانه‌ای',
    section: 'content',
  },
  {
    id: 'brands',
    label: 'برندها',
    href: '/brands',
    icon: Award,
    description: 'مشاهده و مدیریت تمام برندها به صورت موزاییکی',
    section: 'brands',
  },
  {
    id: 'distribution',
    label: 'توزیع',
    href: '/distribution',
    icon: Rocket,
    description: 'انتشار محتوا در کانال‌ها و پلتفرم‌های مختلف',
    section: 'social',
  },
  {
    id: 'social',
    label: 'شبکه‌های اجتماعی',
    href: '/social',
    icon: Share2,
    description: 'مدیریت و آمار اکانت‌های شبکه‌های اجتماعی',
    section: 'social',
  },
  {
    id: 'campaigns',
    label: 'کمپین‌ها',
    href: '/campaigns',
    icon: Megaphone,
    description: 'برنامه‌ریزی و اجرای کمپین‌های رسانه‌ای',
    section: 'brands',
  },
  {
    id: 'audience',
    label: 'مخاطبان',
    href: '/audience',
    icon: Users,
    description: 'بخش‌بندی مخاطبان و شناخت رفتار آن‌ها',
    section: 'social',
  },
  {
    id: 'finance',
    label: 'مالی',
    href: '/finance',
    icon: Wallet,
    description: 'مدیریت بودجه، هزینه و بازدهی برندها',
    section: 'finance',
  },
  {
    id: 'analytics',
    label: 'تحلیل',
    href: '/analytics',
    icon: BarChart3,
    description: 'تحلیل عملکرد و گزارش‌های رسانه‌ای',
    section: 'analytics',
  },
  {
    id: 'intelligence',
    label: 'هوش رسانه‌ای',
    href: '/intelligence',
    icon: BrainCircuit,
    description: 'بینش‌های هوشمند و تحلیل محیط رسانه‌ای',
    section: 'analytics',
  },
  {
    id: 'automation',
    label: 'اتوماسیون',
    href: '/automation',
    icon: Bot,
    description: 'اتوماسیون فرایندها و جریان‌های کاری',
    section: 'analytics',
  },
  {
    id: 'knowledge',
    label: 'پایگاه دانش',
    href: '/knowledge',
    icon: BookOpen,
    description: 'مقالات، راهنماها و دانش سازمانی',
    section: 'content',
  },
  {
    id: 'notifications',
    label: 'اعلان‌ها',
    href: '/notifications',
    icon: Bell,
    description: 'اعلان‌ها و هشدارهای سیستم',
    section: 'command',
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    href: '/settings',
    icon: Settings,
    description: 'پیکربندی سیستم و حساب کاربری',
    section: 'command',
  },
];

export const navItemByHref = navItems.reduce<Record<string, NavItem>>(
  (acc, item) => {
    acc[item.href] = item;
    return acc;
  },
  {},
);
