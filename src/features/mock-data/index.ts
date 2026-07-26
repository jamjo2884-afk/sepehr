import type {
  Project,
  Campaign,
  MediaAsset,
  Operation,
  KnowledgeItem,
  AudienceSegment,
  Automation,
  AnalyticsReport,
} from '@/types/domain';
import type { Notification } from '@/types/index';

const now = Date.now();
const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
const hours = (n: number) => new Date(now - n * 3_600_000).toISOString();

export const mockProjects: Project[] = [
  {
    id: 'prj-001',
    workspaceId: 'ws-001',
    name: 'کمپین تابستانه',
    slug: 'summer-campaign',
    description: 'بسته محتوایی و توزیع برای فصل تابستان',
    status: 'active',
    progress: 62,
    thumbnailUrl: null,
    ownerId: 'usr-001',
    createdAt: days(18),
    updatedAt: hours(3),
  },
  {
    id: 'prj-002',
    workspaceId: 'ws-001',
    name: 'راه‌اندازی پادکست فصل دوم',
    slug: 'podcast-season-2',
    description: 'تولید و انتشار هشت قسمت پادکست',
    status: 'planning',
    progress: 24,
    thumbnailUrl: null,
    ownerId: 'usr-001',
    createdAt: days(9),
    updatedAt: hours(20),
  },
  {
    id: 'prj-003',
    workspaceId: 'ws-001',
    name: 'بازسازی هویت بصری',
    slug: 'visual-identity-refresh',
    description: 'بازطراحی لوگو، رنگ و سیستم بصری',
    status: 'active',
    progress: 48,
    thumbnailUrl: null,
    ownerId: 'usr-001',
    createdAt: days(30),
    updatedAt: days(1),
  },
  {
    id: 'prj-004',
    workspaceId: 'ws-001',
    name: 'گزارش سالانه عملکرد',
    slug: 'annual-performance-report',
    description: 'تدوین گزارش تحلیلی عملکرد یک سال',
    status: 'completed',
    progress: 100,
    thumbnailUrl: null,
    ownerId: 'usr-001',
    createdAt: days(60),
    updatedAt: days(5),
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'cmp-001',
    projectId: 'prj-001',
    name: 'موج اول تابستانه',
    description: 'رشد آگاهی از برند در شبکه‌های اجتماعی',
    status: 'running',
    startDate: days(10),
    endDate: days(-12),
    createdAt: days(15),
    updatedAt: hours(5),
  },
];

export const mockAssets: MediaAsset[] = [
  {
    id: 'ast-001',
    projectId: 'prj-001',
    name: 'تیزر تابستانه.mp4',
    type: 'video',
    url: '',
    thumbnailUrl: null,
    sizeBytes: 84_000_000,
    tags: ['تیزر', 'تابستان'],
    createdAt: days(6),
    updatedAt: days(6),
  },
  {
    id: 'ast-002',
    projectId: 'prj-003',
    name: 'پالت رنگی نسخه ۲.pdf',
    type: 'document',
    url: '',
    thumbnailUrl: null,
    sizeBytes: 1_200_000,
    tags: ['هویت بصری', 'رنگ'],
    createdAt: days(4),
    updatedAt: days(4),
  },
];

export const mockOperations: Operation[] = [
  {
    id: 'op-001',
    projectId: 'prj-001',
    title: 'بازبینی نهایی تیزر',
    description: 'تأیید کیفیت و نسخه نهایی تیزر تابستانه',
    type: 'review',
    status: 'in_progress',
    assigneeId: 'usr-001',
    dueDate: hours(-26),
    createdAt: days(3),
    updatedAt: hours(2),
  },
  {
    id: 'op-002',
    projectId: 'prj-002',
    title: 'نوشتن طرح قسمت اول',
    description: 'تدوین طرح محتوایی قسمت اول پادکست',
    type: 'planning',
    status: 'todo',
    assigneeId: 'usr-001',
    dueDate: days(-3),
    createdAt: days(2),
    updatedAt: days(2),
  },
  {
    id: 'op-003',
    projectId: 'prj-003',
    title: 'انتخاب پالت رنگی',
    description: 'ارائه و تأیید پالت رنگی نهایی',
    type: 'production',
    status: 'done',
    assigneeId: 'usr-001',
    dueDate: days(-1),
    createdAt: days(7),
    updatedAt: days(1),
  },
];

export const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: 'knw-001',
    projectId: 'prj-001',
    title: 'راهنمای تولید تیزر',
    body: 'مراحل تولید یک تیزر استاندارد از ایده تا انتشار.',
    type: 'playbook',
    tags: ['تیزر', 'تولید'],
    createdAt: days(12),
    updatedAt: days(5),
  },
];

export const mockAudienceSegments: AudienceSegment[] = [
  {
    id: 'seg-001',
    projectId: 'prj-001',
    name: 'مخاطبان فعال شبکه اجتماعی',
    description: 'کاربران فعال در اینستاگرام و تلگرام',
    size: 12_400,
    criteria: ['فعالیت بالا', '۱۸ تا ۳۵ سال'],
    createdAt: days(8),
    updatedAt: days(2),
  },
];

export const mockAutomations: Automation[] = [
  {
    id: 'aut-001',
    projectId: 'prj-001',
    name: 'اعلان انتشار خودکار',
    description: 'هنگام انتشار محتوا، اعلان در کانال داخلی ارسال شود',
    trigger: 'محتوا منتشر شد',
    action: 'ارسال اعلان به کانال داخلی',
    enabled: true,
    createdAt: days(6),
    updatedAt: days(6),
  },
];

export const mockAnalyticsReports: AnalyticsReport[] = [
  {
    id: 'rpt-001',
    projectId: 'prj-001',
    name: 'گزارش هفتگی کمپین تابستانه',
    period: 'هفته دوم تیر',
    summary: 'رشد ۱۸ درصدی تعامل نسبت به هفته قبل.',
    createdAt: days(2),
  },
];

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  projectId: string | null;
}

export const mockActivity: ActivityItem[] = [
  {
    id: 'act-001',
    title: 'تیزر تابستانه بازبینی شد',
    description: 'نسخه نهایی تیزر توسط تیم بازبینی تأیید شد',
    timestamp: hours(2),
    projectId: 'prj-001',
  },
  {
    id: 'act-002',
    title: 'دارایی جدید آپلود شد',
    description: 'فایل «پالت رنگی نسخه ۲» به پروژه هویت بصری اضافه شد',
    timestamp: hours(6),
    projectId: 'prj-003',
  },
  {
    id: 'act-003',
    title: 'عملیات جدید ثبت شد',
    description: '«نوشتن طرح قسمت اول» به عملیات پادکست اضافه شد',
    timestamp: days(1),
    projectId: 'prj-002',
  },
  {
    id: 'act-004',
    title: 'گزارش عملکرد آماده شد',
    description: 'گزارش سالانه عملکرد برای بازبینی نهایی ارسال شد',
    timestamp: days(2),
    projectId: 'prj-004',
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'ntf-001',
    title: 'مهلت عملیات نزدیک است',
    description: '«بازبینی نهایی تیزر» تا فردا باید تکمیل شود',
    read: false,
    createdAt: hours(1),
  },
  {
    id: 'ntf-002',
    title: 'دارایی جدید',
    description: 'فایل جدید به دارایی‌های رسانه‌ای اضافه شد',
    read: false,
    createdAt: hours(5),
  },
  {
    id: 'ntf-003',
    title: 'گزارش هفتگی آماده است',
    description: 'گزارش تحلیلی هفته دوم تیر منتشر شد',
    read: true,
    createdAt: days(1),
  },
];
