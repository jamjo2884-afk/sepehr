import type { ID, Timestamp } from '@/types/index';

/**
 * A Project is the top-level container for media operations.
 * Everything in future versions (campaigns, assets, operations, reports)
 * belongs to a Project.
 */
export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  thumbnailUrl: string | null;
  ownerId: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ProjectStatus =
  'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'در حال برنامه‌ریزی',
  active: 'فعال',
  on_hold: 'متوقف',
  completed: 'تکمیل‌شده',
  archived: 'بایگانی‌شده',
};

/** A coordinated media effort within a project. */
export interface Campaign {
  id: ID;
  projectId: ID;
  name: string;
  description: string;
  status: CampaignStatus;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CampaignStatus =
  'draft' | 'scheduled' | 'running' | 'paused' | 'finished';

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  running: 'در حال اجرا',
  paused: 'متوقف',
  finished: 'پایان‌یافته',
};

/** A media file (image, video, audio, document) owned by a project. */
export interface MediaAsset {
  id: ID;
  projectId: ID;
  name: string;
  type: MediaAssetType;
  url: string;
  thumbnailUrl: string | null;
  sizeBytes: number;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MediaAssetType =
  'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export const MEDIA_ASSET_TYPE_LABELS: Record<MediaAssetType, string> = {
  image: 'تصویر',
  video: 'ویدیو',
  audio: 'صوت',
  document: 'سند',
  archive: 'آرشیو',
  other: 'غیره',
};

/** A unit of operational work within a project (task, production step, etc.). */
export interface Operation {
  id: ID;
  projectId: ID;
  title: string;
  description: string;
  type: OperationType;
  status: OperationStatus;
  assigneeId: ID | null;
  dueDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OperationType =
  'planning' | 'production' | 'review' | 'distribution' | 'monitoring';

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  planning: 'برنامه‌ریزی',
  production: 'تولید',
  review: 'بازبینی',
  distribution: 'توزیع',
  monitoring: 'پایش',
};

export type OperationStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  todo: 'در صف',
  in_progress: 'در حال انجام',
  blocked: 'مسدود',
  done: 'انجام‌شده',
};

/** A knowledge-base entry (article, note, playbook) within a project. */
export interface KnowledgeItem {
  id: ID;
  projectId: ID;
  title: string;
  body: string;
  type: KnowledgeItemType;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type KnowledgeItemType = 'article' | 'note' | 'playbook' | 'reference';

export const KNOWLEDGE_ITEM_TYPE_LABELS: Record<KnowledgeItemType, string> = {
  article: 'مقاله',
  note: 'یادداشت',
  playbook: 'راهنمای عملیاتی',
  reference: 'منبع',
};

/** A segment of the audience targeted by campaigns. */
export interface AudienceSegment {
  id: ID;
  projectId: ID;
  name: string;
  description: string;
  size: number;
  criteria: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** An automation rule within a project (trigger → action). */
export interface Automation {
  id: ID;
  projectId: ID;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A generated analytics report for a project. */
export interface AnalyticsReport {
  id: ID;
  projectId: ID;
  name: string;
  period: string;
  summary: string;
  createdAt: Timestamp;
}

/** A social-media platform supported by the dashboard. */
export type SocialPlatform =
  | 'instagram'
  | 'telegram'
  | 'youtube'
  | 'twitter'
  | 'bale'
  | 'eita'
  | 'rubika'
  | 'soroushplus'
  | 'aparat'
  | 'threads'
  | 'shad'
  | 'igap'
  | 'site'
  | 'gap'
  | 'virasty';

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  youtube: 'یوتیوب',
  twitter: 'توییتر / ایکس',
  bale: 'بله',
  eita: 'ایتا',
  rubika: 'روبیکا',
  soroushplus: 'سروش‌پلاس',
  aparat: 'آپارات',
  threads: 'تردز',
  shad: 'شاد',
  igap: 'آی‌گپ',
  site: 'وب‌سایت',
  gap: 'گپ',
  virasty: 'ویراستی',
};

/** Brand metadata used for icons and accent colors. */
export interface SocialPlatformBrand {
  /** Latin name shown as a fallback / tooltip. */
  name: string;
  /** Brand hex color for icons and accents. */
  color: string;
}

export const SOCIAL_PLATFORM_BRAND: Record<
  SocialPlatform,
  SocialPlatformBrand
> = {
  instagram: { name: 'Instagram', color: '#E1306C' },
  telegram: { name: 'Telegram', color: '#229ED9' },
  youtube: { name: 'YouTube', color: '#FF0000' },
  twitter: { name: 'X', color: '#1D1D1D' },
  bale: { name: 'Bale', color: '#FF8200' },
  eita: { name: 'Eitaa', color: '#FC4F62' },
  rubika: { name: 'Rubika', color: '#7B61FF' },
  soroushplus: { name: 'SoroushPlus', color: '#2EB67D' },
  aparat: { name: 'Aparat', color: '#ED1B2F' },
  threads: { name: 'Threads', color: '#000000' },
  shad: { name: 'Shad', color: '#00A86B' },
  igap: { name: 'iGap', color: '#1E88E5' },
  site: { name: 'Site', color: '#607D8B' },
  gap: { name: 'Gap', color: '#FF6F00' },
  virasty: { name: 'Virasty', color: '#D32F2F' },
};

/** A connected account on a social-media platform and its headline metrics. */
export interface SocialAccount {
  id: ID;
  platform: SocialPlatform;
  /** Display name of the channel / page / account. */
  handle: string;
  /** Primary audience size (followers / subscribers / members). */
  followers: number;
  /** Total published posts / videos / messages. */
  posts: number;
  /** Average engagement per post (likes + comments + shares). */
  avgEngagement: number;
  /** Engagement rate as a percentage (0–100). */
  engagementRate: number;
  /** Percentage change of followers over the last 30 days. */
  followersGrowth: number;
  /** Platform-specific secondary metric label, e.g. "بازدید" or "پیام". */
  secondaryMetricLabel: string;
  /** Platform-specific secondary metric value (views / reach / etc). */
  secondaryMetricValue: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A single point in a time series of social engagement. */
export interface SocialMetricPoint {
  /** ISO date string. */
  date: Timestamp;
  /** Total engagement on that day across the selected platform(s). */
  engagement: number;
}

/** A named time-series of engagement for one or more platforms. */
export interface SocialTrendSeries {
  platform: SocialPlatform;
  label: string;
  points: SocialMetricPoint[];
}
