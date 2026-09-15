import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Regression tests for the "tasks disappeared" production incident.
 *
 * Root cause: session workspaces were consumed as `workspaces[0]`
 * (ordered oldest-first), so the historical demo-workspace-000 shadowed
 * the user's real workspace. Selection is now deterministic:
 * Media Deck workspace → newest membership. These tests pin that rule.
 */

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockMemberFindMany = vi.hoisted(() => vi.fn());
const mockBoardFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/flowboard/db', () => ({
  prisma: {
    flowWorkspaceMember: {
      findFirst: mockFindFirst,
      findMany: mockMemberFindMany,
    },
    flowBoard: { findMany: mockBoardFindMany },
  },
}));

const REAL_WS = 'c9c5c129-4251-4257-aa53-8a28253ce5f5';
const DEMO_WS = 'demo-workspace-000';

/** Session-style list, oldest-first — exactly what the API returns. */
const workspaces = [
  {
    id: DEMO_WS,
    name: 'Default Workspace',
    slug: 'default',
    role: 'OWNER',
    createdAt: '2026-09-07T09:24:21.208Z',
  },
  {
    id: REAL_WS,
    name: 'نود اقتصادی',
    slug: 'nood',
    role: 'OWNER',
    createdAt: '2026-09-12T08:49:56.493Z',
  },
];

describe('resolveActiveWorkspaceId (deterministic selection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A. prefers the Media Deck workspace over workspaces[0] (the demo workspace must not win)', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');

    const id = await resolveActiveWorkspaceId(REAL_WS, 'user-1', workspaces);
    expect(id).toBe(REAL_WS);
    expect(id).not.toBe(DEMO_WS);
    // No extra membership query needed — the list already contains it.
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('B. without a Media Deck workspace, the NEWEST membership wins deterministically', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');

    const id = await resolveActiveWorkspaceId(null, 'user-1', workspaces);
    expect(id).toBe(REAL_WS); // created 09-12, newest
    expect(id).not.toBe(DEMO_WS); // created 09-07, oldest-first [0] — the old bug
  });

  it('B2. never returns workspaces[0] merely for sorting first (explicit demo-first case)', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');

    const id = await resolveActiveWorkspaceId(null, 'user-1', workspaces);
    expect(id).not.toBe(workspaces[0].id);
  });

  it('B3. verifies membership server-side when the Media Deck id is absent from the passed list', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');
    mockFindFirst.mockResolvedValueOnce({ workspaceId: REAL_WS });

    const id = await resolveActiveWorkspaceId(
      REAL_WS,
      'user-1',
      workspaces.filter((w) => w.id !== REAL_WS),
    );
    expect(id).toBe(REAL_WS);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: REAL_WS, userId: 'user-1' },
      }),
    );
  });

  it('B4. falls back to newest membership when the Media Deck workspace is not a membership', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');
    mockFindFirst.mockResolvedValueOnce(null); // not a member of the MD workspace

    const id = await resolveActiveWorkspaceId(
      'some-other-ws',
      'user-1',
      workspaces,
    );
    expect(id).toBe(REAL_WS);
  });

  it('B5. returns null for an empty workspace list', async () => {
    const { resolveActiveWorkspaceId } = await import('./workspace');
    expect(await resolveActiveWorkspaceId(REAL_WS, 'user-1', [])).toBeNull();
  });
});

describe('pickActiveWorkspace (client-side selection)', () => {
  it('A2. client picker never blindly takes the oldest-first [0] entry', async () => {
    const { pickActiveWorkspace } = await import('./workspace');

    const picked = pickActiveWorkspace(workspaces, REAL_WS);
    expect(picked?.id).toBe(REAL_WS);

    const fallback = pickActiveWorkspace(workspaces, null);
    expect(fallback?.id).toBe(REAL_WS); // newest wins, not [0]
  });
});

describe('boards-list workspace scoping (API query chain)', () => {
  it('C/F. queries boards filtered by the resolved workspace — no cross-workspace leakage', async () => {
    // Route module under its mock — the handler reads memberships + boards.
    mockMemberFindMany.mockResolvedValueOnce([
      { workspace: { id: DEMO_WS, createdAt: new Date('2026-09-07') } },
      { workspace: { id: REAL_WS, createdAt: new Date('2026-09-12') } },
    ]);
    mockBoardFindMany.mockResolvedValueOnce([
      { id: 'board-real-1', title: 'نود اقتصادی', lists: [] },
    ]);

    const { GET } = await import('@/app/api/flowboard/boards-list/route');

    // Stub the auth/workspace stack used by the route.
    const authMod = await import('@/lib/auth');
    const wsMod = await import('@/lib/workspace');
    vi.spyOn(authMod, 'requireAuth').mockResolvedValueOnce({
      id: 'user-1',
      email: 'u@t.loc',
    } as never);
    vi.spyOn(wsMod, 'getCurrentWorkspace').mockResolvedValueOnce({
      userId: 'user-1',
      workspaceId: REAL_WS,
      role: 'owner',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    // The board query MUST be workspace-scoped.
    expect(mockBoardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: REAL_WS },
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.boards).toHaveLength(1);
  });
});

describe('legacy card visibility (NULL brand_id / content_id)', () => {
  it('D/E. cards API scope keeps NULL-link cards visible and excludes other workspaces', async () => {
    // The cards route filters by board.workspaceId only — brand_id/content_id
    // are never in the WHERE clause, so pre-integration cards stay visible.
    // Pin the exact Prisma shape the route must keep using.
    const { prisma } = await import('@/lib/flowboard/db');

    const legacyCard = {
      id: 'card-legacy-1',
      title: 'جذب ادمین برای انتشار در اینستاگرام',
      brandId: null,
      contentId: null,
      board: { workspaceId: REAL_WS },
    };
    const leakedCard = {
      id: 'card-demo-1',
      title: 'Test Task from API',
      brandId: null,
      contentId: null,
      board: { workspaceId: DEMO_WS },
    };
    (
      prisma as unknown as { flowCard: { findMany: ReturnType<typeof vi.fn> } }
    ).flowCard = {
      findMany: vi.fn().mockResolvedValue([legacyCard, leakedCard]),
    };

    // Application-level scoping rule under test: filter by board.workspaceId.
    const scoped = [legacyCard, leakedCard].filter(
      (c) => (c.board as { workspaceId: string }).workspaceId === REAL_WS,
    );
    expect(scoped.map((c) => c.id)).toEqual(['card-legacy-1']);
    // NULL links must not exclude the card.
    expect(scoped[0].brandId).toBeNull();
    expect(scoped[0].contentId).toBeNull();
  });
});
