import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Workspace Resolver tests.
 *
 * Tests the workspace resolution logic using mocked Supabase.
 * The workspace resolver maps auth.uid() → workspace membership.
 */

// Mock supabase server client (workspace.ts resolves memberships through
// createSupabaseServerClient so RLS sees the authenticated user).
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      single: mockSingle,
    })),
  })),
}));

// Mock auth module
let mockAuthUser: { id: string; email: string } | null = null;
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => mockAuthUser),
}));

describe('Workspace Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = null;
  });

  it('1. returns null when no auth user', async () => {
    mockAuthUser = null;
    const { getCurrentWorkspace } = await import('@/lib/workspace');
    const ctx = await getCurrentWorkspace();
    expect(ctx).toBeNull();
  });

  it('2. returns demo workspace for demo user', async () => {
    mockAuthUser = { id: 'demo-user-000', email: 'demo@test.com' };
    const { getCurrentWorkspace } = await import('@/lib/workspace');
    const ctx = await getCurrentWorkspace();

    expect(ctx).not.toBeNull();
    expect(ctx!.workspaceId).toBe('demo-workspace-000');
    expect(ctx!.role).toBe('owner');
  });

  it('3. returns workspace for authenticated user with membership', async () => {
    mockAuthUser = { id: 'user-123', email: 'user@test.com' };
    mockSingle.mockResolvedValue({
      data: { workspace_id: 'ws-abc', role: 'owner' },
      error: null,
    });

    const { getCurrentWorkspace } = await import('@/lib/workspace');
    const ctx = await getCurrentWorkspace();

    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe('user-123');
    expect(ctx!.workspaceId).toBe('ws-abc');
    expect(ctx!.role).toBe('owner');
  });

  it('4. returns null for user with no workspace membership', async () => {
    mockAuthUser = { id: 'user-orphan', email: 'orphan@test.com' };
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'No rows found' },
    });

    const { getCurrentWorkspace } = await import('@/lib/workspace');
    const ctx = await getCurrentWorkspace();

    expect(ctx).toBeNull();
  });

  it('5. requireWorkspace returns error for null context', async () => {
    mockAuthUser = null;
    const { requireWorkspace } = await import('@/lib/workspace');
    const result = await requireWorkspace();

    expect('error' in result).toBe(true);
  });

  it('6. requireWorkspace returns context for valid user', async () => {
    mockAuthUser = { id: 'user-456', email: 'user456@test.com' };
    mockSingle.mockResolvedValue({
      data: { workspace_id: 'ws-xyz', role: 'admin' },
      error: null,
    });

    const { requireWorkspace } = await import('@/lib/workspace');
    const result = await requireWorkspace();

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.workspaceId).toBe('ws-xyz');
      expect(result.role).toBe('admin');
    }
  });

  it('7. isOwnedByWorkspace returns true for matching workspace', async () => {
    mockAuthUser = { id: 'user-789', email: 'user789@test.com' };
    mockSingle.mockResolvedValue({
      data: { workspace_id: 'ws-match', role: 'viewer' },
      error: null,
    });

    const { isOwnedByWorkspace } = await import('@/lib/workspace');
    const result = await isOwnedByWorkspace('ws-match');
    expect(result).toBe(true);
  });

  it('8. isOwnedByWorkspace returns false for different workspace', async () => {
    mockAuthUser = { id: 'user-789', email: 'user789@test.com' };
    mockSingle.mockResolvedValue({
      data: { workspace_id: 'ws-own', role: 'viewer' },
      error: null,
    });

    const { isOwnedByWorkspace } = await import('@/lib/workspace');
    const result = await isOwnedByWorkspace('ws-other');
    expect(result).toBe(false);
  });

  it('9. isOwnedByWorkspace returns false when no workspace', async () => {
    mockAuthUser = null;
    const { isOwnedByWorkspace } = await import('@/lib/workspace');
    const result = await isOwnedByWorkspace('ws-any');
    expect(result).toBe(false);
  });
});
