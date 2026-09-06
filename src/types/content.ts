import type { ID, Timestamp } from '@/types/index';

/**
 * Content Workflow entity (Phase 23).
 *
 * Mirrors the `contents` table created by
 * supabase/migrations/20260907_phase23_control_center.sql.
 */

export type ContentStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'پیش‌نویس',
  review: 'در انتظار بازبینی',
  approved: 'تأیید‌شده',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشر‌شده',
  rejected: 'رد‌شده',
  cancelled: 'لغو‌شده',
  failed: 'ناموفق',
};

export type ContentType =
  | 'post'
  | 'reel'
  | 'story'
  | 'video'
  | 'carousel'
  | 'document'
  | 'other';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'پست',
  reel: 'ریلز',
  story: 'استوری',
  video: 'ویدیو',
  carousel: 'کاروسل',
  document: 'سند',
  other: 'سایر',
};

/** Allowed status transitions. Any other move is rejected by the service. */
export const CONTENT_STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['review', 'cancelled'],
  review: ['approved', 'rejected'],
  approved: ['scheduled', 'published', 'cancelled'],
  scheduled: ['published', 'cancelled', 'failed'],
  published: [],
  rejected: ['draft'],
  cancelled: [],
  failed: ['draft'],
};

/** Check whether a status transition is allowed. */
export function canTransitionContent(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  return CONTENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface Content {
  id: ID;
  workspaceId: ID;
  brandId: ID | null;
  campaignId: ID | null;
  title: string;
  type: ContentType;
  status: ContentStatus;
  body: string;
  platform: string | null;
  scheduledAt: Timestamp | null;
  publishedAt: Timestamp | null;
  createdBy: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Payload accepted when creating a content row. */
export interface ContentInput {
  title: string;
  type?: ContentType;
  brandId?: string | null;
  campaignId?: string | null;
  body?: string;
  platform?: string | null;
  scheduledAt?: string | null;
}

/** Raw row shape of the `contents` table. */
export interface ContentRow {
  id: ID;
  workspace_id: ID;
  brand_id: ID | null;
  campaign_id: ID | null;
  title: string;
  type: ContentType;
  status: ContentStatus;
  body: string;
  platform: string | null;
  scheduled_at: Timestamp | null;
  published_at: Timestamp | null;
  created_by: ID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}