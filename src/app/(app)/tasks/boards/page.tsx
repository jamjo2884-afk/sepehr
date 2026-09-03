// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/i18n/flowboard/context";

interface Workspace { id: string; name: string; slug: string; role: string; }
interface Board { id: string; title: string; description?: string; backgroundColor?: string; backgroundImage?: string; position: number; isFavorited: boolean; listCount: number; memberCount: number; createdAt: string; updatedAt: string; }
interface User { id: string; name: string; email: string; avatarUrl?: string; }

function BoardsPageInner() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [archivedBoards, setArchivedBoards] = useState<Board[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch("/api/flowboard/auth/session");
      if (!r.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      const d = await r.json();
      setUser(d.user);
      setWorkspaces(d.workspaces);
      setError(false);
      if (d.workspaces.length === 0) {
        // No workspace yet — stop loading and show the empty/creation state.
        setLoading(false);
      } else if (!currentWorkspace) {
        setCurrentWorkspace(d.workspaces[0]);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [currentWorkspace]);

  const reload = useCallback(() => {
    setError(false);
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const fetchBoards = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/flowboard/workspaces/${currentWorkspace.id}/boards`);
      if (r.ok) setBoards(await r.json());
    } finally { setLoading(false); }
  }, [currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  const fetchArchivedBoards = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const r = await fetch(`/api/flowboard/workspaces/${currentWorkspace.id}/boards/archived`);
      if (r.ok) setArchivedBoards(await r.json());
    } catch {}
  }, [currentWorkspace]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || creatingWorkspace) return;
    setCreatingWorkspace(true);
    setWorkspaceError("");
    try {
      const r = await fetch("/api/flowboard/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setWorkspaceError(d?.error || t("boards.createWorkspaceFailed"));
        return;
      }
      setNewWorkspaceName("");
      setShowCreateWorkspace(false);
      await fetchData();
    } catch {
      setWorkspaceError(t("boards.createWorkspaceFailed"));
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim() || !currentWorkspace) return;
    try {
      const r = await fetch(`/api/flowboard/workspaces/${currentWorkspace.id}/boards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newBoardTitle.trim() }) });
      if (r.ok) { const b = await r.json(); setNewBoardTitle(""); setShowCreateBoard(false); router.push(`/tasks/boards/${b.id}`); }
    } catch {}
  };

  const handleRestoreBoard = async (boardId: string) => {
    try {
      const r = await fetch(`/api/flowboard/boards/${boardId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived: false }) });
      if (r.ok) { setArchivedBoards((p) => p.filter((b) => b.id !== boardId)); fetchBoards(); }
    } catch {}
  };

  const favorites = boards.filter((b) => b.isFavorited);
  const recent = boards.filter((b) => !b.isFavorited).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const getBg = (b: Board) => b.backgroundImage ? { backgroundImage: `url(${b.backgroundImage})`, backgroundSize: "cover" as const } : { backgroundColor: b.backgroundColor || "#0079bf" };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("nav.boards")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentWorkspace?.name || t("nav.boards")} — {boards.length} {t("common.cards")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Workspace selector */}
          {workspaces.length > 1 && (
            <select
              value={currentWorkspace?.id || ""}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === e.target.value);
                if (ws) setCurrentWorkspace(ws);
              }}
              className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{t("boards.loadFailed")}</h3>
          <p className="text-muted-foreground mb-6">{t("boards.loadFailedDesc")}</p>
          <button onClick={reload} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            {t("common.retry")}
          </button>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🗂️</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{t("boards.noWorkspace")}</h3>
          <p className="text-muted-foreground mb-6">{t("boards.createWorkspaceDesc")}</p>
          <button onClick={() => setShowCreateWorkspace(true)} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            {t("boards.createWorkspace")}
          </button>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">★ {t("boards.starredBoards")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {favorites.map((b) => (
                  <Link key={b.id} href={`/tasks/boards/${b.id}`} className="h-32 rounded-xl p-4 text-white font-medium shadow-sm flex flex-col justify-between hover:opacity-90 transition-opacity" style={getBg(b)}>
                    <span className="text-lg">{b.title}</span>
                    <div className="text-white/70 text-xs">{b.listCount} {t("common.lists")} · {b.memberCount} {t("common.members")}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("boards.yourBoards")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recent.map((b) => (
                <Link key={b.id} href={`/tasks/boards/${b.id}`} className="h-32 rounded-xl p-4 text-white font-medium shadow-sm flex flex-col justify-between hover:opacity-90 transition-opacity" style={getBg(b)}>
                  <span className="text-lg">{b.title}</span>
                  <div className="text-white/70 text-xs">{b.listCount} {t("common.lists")} · {b.memberCount} {t("common.members")}</div>
                </Link>
              ))}
              <button onClick={() => setShowCreateBoard(true)} className="h-32 rounded-xl border-2 border-dashed border-border bg-surface/40 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  {t("boards.create")}
                </span>
              </button>
            </div>
          </section>

          {/* Archived */}
          <div className="mt-4">
            <button onClick={() => { setShowArchived(!showArchived); if (!showArchived) fetchArchivedBoards(); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              {showArchived ? t("boards.hideArchived") : t("boards.showArchived")}
            </button>
            {showArchived && (
              <div className="mt-3">
                {archivedBoards.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">{t("boards.noArchived")}</p>
                ) : (
                  <div className="space-y-2">
                    {archivedBoards.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-surface/40 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md" style={{ backgroundColor: b.backgroundColor || "#0079bf" }} />
                          <div>
                            <p className="text-sm font-medium">{b.title}</p>
                            <p className="text-xs text-muted-foreground">{new Date(b.updatedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button onClick={() => handleRestoreBoard(b.id)} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                          {t("common.restore")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {boards.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("boards.noBoards")}</h3>
              <p className="text-muted-foreground mb-6">{t("boards.createFirstDesc")}</p>
              <button onClick={() => setShowCreateBoard(true)} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                {t("boards.createFirst")}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Board Dialog */}
      {showCreateBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">{t("boards.newBoard")}</h3>
            <form onSubmit={handleCreateBoard}>
              <input type="text" value={newBoardTitle} onChange={(e) => setNewBoardTitle(e.target.value)} placeholder={t("boards.newBoard")} autoFocus className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent mb-4" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowCreateBoard(false); setNewBoardTitle(""); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t("common.cancel")}</button>
                <button type="submit" disabled={!newBoardTitle.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{t("common.create")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Workspace Dialog */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">{t("boards.newWorkspace")}</h3>
            <form onSubmit={handleCreateWorkspace}>
              <input type="text" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} placeholder={t("boards.newWorkspace")} autoFocus className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent mb-4" />
              {workspaceError && <p className="text-sm text-destructive mb-4">{workspaceError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowCreateWorkspace(false); setNewWorkspaceName(""); setWorkspaceError(""); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t("common.cancel")}</button>
                <button type="submit" disabled={!newWorkspaceName.trim() || creatingWorkspace} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{creatingWorkspace ? t("common.saving") : t("common.create")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoardsPage() {
  return <BoardsPageInner />;
}
