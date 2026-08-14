import type { Project, Campaign, MediaAsset, Operation } from '@/types/domain';
import type { Notification } from '@/types/index';
import {
  mockProjects,
  mockCampaigns,
  mockAssets,
  mockOperations,
  mockActivity,
  mockNotifications,
  type ActivityItem,
} from '@/features/mock-data';

/**
 * Generic data service.
 *
 * Reads business rows from Supabase (tables created by
 * supabase/migrations/20260814100000_create_business_tables.sql) and maps
 * them onto the app's domain types. Falls back to the bundled mock data
 * when Supabase is unavailable or the table is empty, so the dashboard
 * keeps working without a configured backend.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = any;

function iso(v: unknown): string {
  return typeof v === 'string' ? v : new Date().toISOString();
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

async function fetchTable<T extends SupabaseRow>(
  table: string,
  columns: string,
  order: string,
): Promise<T[] | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data as T[];
  } catch (err) {
    console.warn(
      `[data] Could not read ${table} from Supabase, falling back to mock data.`,
      err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  status: Project['status'];
  progress: number;
  thumbnail_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    progress: num(row.progress),
    thumbnailUrl: row.thumbnail_url,
    ownerId: row.owner_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** All projects, newest first. Falls back to mock data. */
export async function getProjects(): Promise<Project[]> {
  const rows = await fetchTable<ProjectRow>(
    'projects',
    'id,workspace_id,name,slug,description,status,progress,thumbnail_url,owner_id,created_at,updated_at',
    'updated_at',
  );
  if (!rows) return mockProjects;
  return rows
    .map(projectFromRow)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** A single project by id. Returns null when missing (or mock fallback miss). */
export async function getProjectById(id: string): Promise<Project | null> {
  const projects = await getProjects();
  return projects.find((p) => p.id === id) ?? null;
}

/** Operations that belong to a project. Falls back to mock filtering. */
export async function getOperationsByProject(
  projectId: string,
): Promise<Operation[]> {
  const all = await getOperations();
  return all.filter((o) => o.projectId === projectId);
}

/** Media assets that belong to a project. Falls back to mock filtering. */
export async function getAssetsByProject(
  projectId: string,
): Promise<MediaAsset[]> {
  const all = await getMediaAssets();
  return all.filter((a) => a.projectId === projectId);
}

/** Campaigns that belong to a project. Falls back to mock filtering. */
export async function getCampaignsByProject(
  projectId: string,
): Promise<Campaign[]> {
  const all = await getCampaigns();
  return all.filter((c) => c.projectId === projectId);
}

/** A single operation by id. */
export async function getOperationById(
  id: string,
): Promise<Operation | null> {
  const all = await getOperations();
  return all.find((o) => o.id === id) ?? null;
}

/** A single media asset by id. */
export async function getAssetById(id: string): Promise<MediaAsset | null> {
  const all = await getMediaAssets();
  return all.find((a) => a.id === id) ?? null;
}

/** A single campaign by id. */
export async function getCampaignById(
  id: string,
): Promise<Campaign | null> {
  const all = await getCampaigns();
  return all.find((c) => c.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export interface ActivityRow {
  id: string;
  title: string;
  description: string;
  project_id: string | null;
  created_at: string;
}

function activityFromRow(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    timestamp: iso(row.created_at),
  };
}

/** Recent activity feed, newest first. Falls back to mock data. */
export async function getActivity(): Promise<ActivityItem[]> {
  const rows = await fetchTable<ActivityRow>(
    'activity_items',
    'id,title,description,project_id,created_at',
    'created_at',
  );
  if (!rows) return mockActivity;
  return rows.map(activityFromRow);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
}

function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    read: bool(row.read),
    createdAt: iso(row.created_at),
  };
}

/** Notifications, newest first. Falls back to mock data. */
export async function getNotifications(): Promise<Notification[]> {
  const rows = await fetchTable<NotificationRow>(
    'notifications',
    'id,user_id,title,description,read,created_at',
    'created_at',
  );
  if (!rows) return mockNotifications;
  return rows.map(notificationFromRow);
}

// ---------------------------------------------------------------------------
// Campaigns, assets, operations (available for future modules)
// ---------------------------------------------------------------------------

export interface CampaignRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: Campaign['status'];
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getCampaigns(): Promise<Campaign[]> {
  const rows = await fetchTable<CampaignRow>(
    'campaigns',
    'id,project_id,name,description,status,start_date,end_date,created_at,updated_at',
    'created_at',
  );
  if (!rows) return mockCampaigns;
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date ? iso(row.start_date) : null,
    endDate: row.end_date ? iso(row.end_date) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
}

export interface MediaAssetRow {
  id: string;
  project_id: string;
  name: string;
  type: MediaAsset['type'];
  url: string;
  thumbnail_url: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export async function getMediaAssets(): Promise<MediaAsset[]> {
  const rows = await fetchTable<MediaAssetRow>(
    'media_assets',
    'id,project_id,name,type,url,thumbnail_url,size_bytes,tags,created_at,updated_at',
    'created_at',
  );
  if (!rows) return mockAssets;
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    sizeBytes: num(row.size_bytes),
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
}

export interface OperationRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  type: Operation['type'];
  status: Operation['status'];
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOperations(): Promise<Operation[]> {
  const rows = await fetchTable<OperationRow>(
    'operations',
    'id,project_id,title,description,type,status,assignee_id,due_date,created_at,updated_at',
    'created_at',
  );
  if (!rows) return mockOperations;
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    assigneeId: row.assignee_id,
    dueDate: row.due_date ? iso(row.due_date) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
}
