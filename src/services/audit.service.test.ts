import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Audit Log Service tests.
 *
 * Covers the redaction contract (never store tokens/passwords/secrets) and
 * the in-memory fallback path.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

import {
  sanitizeAuditMetadata,
  recordAudit,
  getAuditLogs,
} from '@/services/audit.service';

const WS = 'ws-1';

describe('sanitizeAuditMetadata (redaction)', () => {
  it('1. redacts sensitive keys at any depth', () => {
    const out = sanitizeAuditMetadata({
      summary: 'تغییر وضعیت',
      changes: [
        { field: 'status', before: 'draft', after: 'review' },
      ],
      access_token: 'abc123',
      password: 'p@ss',
      nested: {
        api_key: 'key-xyz',
        authorization: 'Bearer deadbeef',
        ok: 'keep-me',
      },
    });

    expect(out.summary).toBe('تغییر وضعیت');
    expect(out.changes).toEqual([
      { field: 'status', before: 'draft', after: 'review' },
    ]);
    expect(out.access_token).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).api_key).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).ok).toBe('keep-me');
  });

  it('2. redacts JWT-like and long opaque string values', () => {
    const out = sanitizeAuditMetadata({
      summary: 'ok',
      tokenLike: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig',
      opaque: 'A'.repeat(80),
      short: 'hello',
    });

    expect(out.tokenLike).toBe('[REDACTED]');
    expect(out.opaque).toBe('[REDACTED]');
    expect(out.short).toBe('hello');
  });

  it('3. truncates long non-secret values', () => {
    const long = 'x'.repeat(1000);
    const out = sanitizeAuditMetadata({ summary: long });
    expect(String(out.summary).length).toBeLessThan(600);
    expect(String(out.summary).endsWith('…')).toBe(true);
  });

  it('4. passes through numbers, booleans, null and arrays', () => {
    const out = sanitizeAuditMetadata({
      count: 3,
      ok: true,
      nothing: null,
      list: [1, 'a'],
    });

    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
    expect(out.nothing).toBeNull();
    expect(out.list).toEqual([1, 'a']);
  });
});

describe('recordAudit / getAuditLogs (in-memory fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('5. records and returns an audit entry scoped to workspace', async () => {
    const id = await recordAudit(
      { workspaceId: WS, userId: 'u1' },
      'status_change',
      'content',
      'content-1',
      { summary: 'تغییر وضعیت', changes: [{ field: 'status', before: 'draft', after: 'review' }] },
    );
    expect(id).not.toBeNull();

    const logs = await getAuditLogs(WS);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const entry = logs.find((l) => l.id === id);
    expect(entry).toBeDefined();
    expect(entry!.action).toBe('status_change');
    expect(entry!.entityType).toBe('content');
    expect(entry!.entityId).toBe('content-1');
    expect(entry!.workspaceId).toBe(WS);
    expect(entry!.userId).toBe('u1');
  });

  it('6. never persists secrets even if caller passes them', async () => {
    const id = await recordAudit(
      { workspaceId: WS, userId: 'u1' },
      'create',
      'content',
      'c-2',
      {
        summary: 'ایجاد',
        // Simulate a buggy caller passing credentials through
        credentials: { username: 'admin', password: 'hunter2', apiKey: 'sk-123' },
      },
    );

    const logs = await getAuditLogs(WS);
    const entry = logs.find((l) => l.id === id);
    const meta = entry!.metadata as Record<string, unknown>;
    const creds = meta.credentials as Record<string, unknown>;
    expect(creds.username).toBe('admin');
    expect(creds.password).toBe('[REDACTED]');
    expect(creds.apiKey).toBe('[REDACTED]');
    expect(JSON.stringify(meta)).not.toContain('hunter2');
    expect(JSON.stringify(meta)).not.toContain('sk-123');
  });

  it('7. audit logs are isolated per workspace', async () => {
    await recordAudit({ workspaceId: WS, userId: 'u1' }, 'create', 'content', 'c-3', {});
    await recordAudit({ workspaceId: 'ws-other', userId: 'u2' }, 'create', 'content', 'c-9', {});

    const mine = await getAuditLogs(WS);
    const other = await getAuditLogs('ws-other');

    expect(mine.every((l) => l.workspaceId === WS)).toBe(true);
    expect(other.every((l) => l.workspaceId === 'ws-other')).toBe(true);
    expect(other.some((l) => l.entityId === 'c-9')).toBe(true);
    expect(mine.some((l) => l.entityId === 'c-9')).toBe(false);
  });
});