import {
  LayoutDashboard,
  ListTodo,
  Package,
  Rocket,
  Share2,
  Megaphone,
  Users,
  BarChart3,
  BrainCircuit,
  Bot,
  BookOpen,
  Settings,
  Award,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const navItems: NavItem[] = [
  {
    id: 'command-center',
    label: 'مرکز فرمان',
    href: '/command-center',
    icon: LayoutDashboard,
    description: 'نمای کلی عملیات رسانه‌ای و نقطه شروع روزانه شما',
  },
  {
    id: 'tasks',
    label: 'کارها',
    href: '/tasks',
    icon: ListTodo,
    description: 'مدیریت وظایف، پروژه‌ها و عملیات',
  },
  {
    id: 'assets',
    label: 'دارایی‌های رسانه‌ای',
    href: '/assets',
    icon: Package,
    description: 'آرشیو و مدیریت فایل‌ها و دارایی‌های رسانه‌ای',
  },
  {
    id: 'brands',
    label: 'برندها',
    href: '/brands',
    icon: Award,
    description: 'مشاهده و مدیریت تمام برندها به صورت موزاییکی',
  },
  {
    id: 'distribution',
    label: 'توزیع',
    href: '/distribution',
    icon: Rocket,
    description: 'انتشار محتوا در کانال‌ها و پلتفرم‌های مختلف',
  },
  {
    id: 'social',
    label: 'شبکه‌های اجتماعی',
    href: '/social',
    icon: Share2,
    description: 'مدیریت و آمار اکانت‌های شبکه‌های اجتماعی',
  },
  {
    id: 'campaigns',
    label: 'کمپین‌ها',
    href: '/campaigns',
    icon: Megaphone,
    description: 'برنامه‌ریزی و اجرای کمپین‌های رسانه‌ای',
  },
  {
    id: 'audience',
    label: 'مخاطبان',
    href: '/audience',
    icon: Users,
    description: 'بخش‌بندی مخاطبان و شناخت رفتار آن‌ها',
  },
  {
    id: 'analytics',
    label: 'تحلیل',
    href: '/analytics',
    icon: BarChart3,
    description: 'تحلیل عملکرد و گزارش‌های رسانه‌ای',
  },
  {
    id: 'intelligence',
    label: 'هوش رسانه‌ای',
    href: '/intelligence',
    icon: BrainCircuit,
    description: 'بینش‌های هوشمند و تحلیل محیط رسانه‌ای',
  },
  {
    id: 'automation',
    label: 'اتوماسیون',
    href: '/automation',
    icon: Bot,
    description: 'اتوماسیون فرایندها و جریان‌های کاری',
  },
  {
    id: 'knowledge',
    label: 'پایگاه دانش',
    href: '/knowledge',
    icon: BookOpen,
    description: 'مقالات، راهنماها و دانش سازمانی',
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    href: '/settings',
    icon: Settings,
    description: 'پیکربندی سیستم و حساب کاربری',
  },
];

export const navItemByHref = navItems.reduce<Record<string, NavItem>>(
  (acc, item) => {
    acc[item.href] = item;
    return acc;
  },
  {},
);
