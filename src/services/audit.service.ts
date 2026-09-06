/**
 * Audit Log Service (Phase 23)
 *
 * Records operational audit events per workspace. The service NEVER accepts
 * secrets by contract, and `sanitizeAuditMetadata` additionally redacts any
 * key matching a sensitive pattern plus values that look like tokens
 * (defense in depth). Before/after diffs are limited to business fields.
 *
 * Demo mode: falls back to an in-memory ring buffer when the table is
 * unavailable (matching the brand/finance service convention).
 */

import { getSupabase, isTableAvailable } from '@/lib/db';
import type {
  AuditAction,
  AuditLog,
  AuditLogRow,
  AuditMetadata,
} from '@/types/audit';

/* =========================================================================
 * Redaction
 * ========================================================================= */

const SENSITIVE_KEY_PATTERN =
  /token|password|passwd|secret|credential|api[_-]?key|apikey|cookie|authorization|auth[_-]?(header|session)|access[_-]?token|refresh[_-]?token|private[_-]?key|bearer/i;

const REDACTED = '[REDACTED]';
const MAX_VALUE_LENGTH = 500;

function looksLikeToken(value: string): boolean {
  // JWT (three dot-separated segments) or long opaque token/base64-ish blob.
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return true;
  return value.length > 64 && /^[A-Za-z0-9_\-:+/=]+$/.test(value);
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (looksLikeToken(value)) return REDACTED;
    return value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth > 3) return REDACTED;
    return value.map((v) => redactValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > 3) return REDACTED;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : redactValue(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

/** Redact secrets from arbitrary metadata before persisting. */
export function sanitizeAuditMetadata(
  metadata: AuditMetadata | Record<string, unknown>,
): Record<string, unknown> {
  return redactValue(metadata, 0) as Record<string, unknown>;
}

/* =========================================================================
 * In-memory fallback (demo mode)
 * ========================================================================= */

interface MemoryAuditEntry extends AuditLog {
  _seq: number;
}

const _memory: MemoryAuditEntry[] = [];
let _seq = 0;

function memoryAdd(entry: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
  const row: MemoryAuditEntry = {
    id: `audit-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...entry,
    createdAt: new Date().toISOString(),
    _seq: ++_seq,
  };
  _memory.push(row);
  if (_memory.length > 200) _memory.splice(0, _memory.length - 200);
  return row;
}

function memoryList(workspaceId: string, limit: number): AuditLog[] {
  return _memory
    .filter((e) => e.workspaceId === workspaceId)
    .sort((a, b) => b._seq - a._seq)
    .slice(0, limit);
}

/** Clear the in-memory fallback store (test isolation only). */
export function resetAuditMemoryForTests(): void {
  _memory.length = 0;
}

/* =========================================================================
 * Row mapper
 * ========================================================================= */

function auditFromRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

/* =========================================================================
 * API
 * ========================================================================= */

export interface AuditContext {
  workspaceId: string;
  userId: string | null;
}

/**
 * Record an audit event. Never throws — audit failures must not break the
 * primary operation. Returns the new row id, or null on failure.
 */
export async function recordAudit(
  ctx: AuditContext,
  action: AuditAction | string,
  entityType: string,
  entityId: string,
  metadata: AuditMetadata | Record<string, unknown> = {},
): Promise<string | null> {
  const safe = sanitizeAuditMetadata(metadata);

  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('audit_logs')) {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata: safe,
        })
        .select('id')
        .single();
      if (error) {
        console.warn('[audit] Could not write audit log:', error.message);
        return null;
      }
      return (data?.id as string | undefined) ?? null;
    }
  } catch (err) {
    console.warn('[audit] Could not write audit log:', err);
    return null;
  }

  // Demo fallback
  return memoryAdd({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action,
    entityType,
    entityId,
    metadata: safe,
  }).id;
}

/**
 * List audit events for a workspace, newest first.
 * Falls back to the in-memory buffer in demo mode.
 */
export async function getAuditLogs(
  workspaceId: string,
  limit = 50,
): Promise<AuditLog[]> {
  try {
    const supabase = await getSupabase();
    if (await isTableAvailable('audit_logs')) {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 200));
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as unknown as AuditLogRow[]).map(auditFromRow);
      }
    }
  } catch {
    // Fall through to memory
  }
  return memoryList(workspaceId, limit);
}