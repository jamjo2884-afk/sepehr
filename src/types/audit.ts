import type { ID, Timestamp } from '@/types/index';

/**
 * Audit Log (Phase 23).
 *
 * Stores ONLY operational metadata. Secrets — tokens, passwords, API keys,
 * cookies, credentials, authorization headers — are never accepted here;
 * `sanitizeAuditMetadata` additionally redacts any key that matches a
 * sensitive pattern before the row is written (defense in depth).
 */

export interface AuditLog {
  id: ID;
  workspaceId: ID;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}

/** Raw row shape of the `audit_logs` table. */
export interface AuditLogRow {
  id: ID;
  workspace_id: ID;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: Timestamp;
}

/** Field-level diff — only non-sensitive business fields belong here. */
export interface AuditChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditMetadata {
  /** Short human-readable summary of what happened. */
  summary?: string;
  /** Field-level before/after for the minimal business data needed. */
  changes?: AuditChange[];
  /** Any extra operational context (ids, statuses, counts). */
  [key: string]: unknown;
}

/** Audit actions used by Media Deck services. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'assign'
  | 'schedule'
  | 'cancel'
  | 'read';