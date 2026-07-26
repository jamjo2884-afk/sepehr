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
