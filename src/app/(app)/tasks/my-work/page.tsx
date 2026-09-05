
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/flowboard/context";
import { formatDateShort } from "@/i18n/flowboard/dates";

interface CardItem {
  id: string; title: string; description?: string; priority: string;
  dueDate?: string; startDate?: string; coverColor?: string; isCompleted: boolean;
  list: { id: string; title: string };
  board: { id: string; title: string; backgroundColor?: string };
  labels: { label: { id: string; name: string; color: string } }[];
  checklists: { items: { isCompleted: boolean }[] }[];
  _count: { comments: number; checklists: number; attachments: number };
}
interface User { id: string; name: string; email: string; }
interface Workspace { id: string; name: string; slug: string; role: string; }
interface Summary { total: number; overdue: number; dueToday: number; upcoming: number; completed: number; }
type FilterType = "all" | "overdue" | "today" | "upcoming" | "completed";
type SortType = "dueDate" | "priority" | "updated";

export default function MyWorkPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [, setUser] = useState<User | null>(null);
  const [, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, overdue: 0, dueToday: 0, upcoming: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("dueDate");
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [boardFilter, setBoardFilter] = useState<string | null>(null);
  const [availableBoards, setAvailableBoards] = useState<{ id: string; title: string }[]>([]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fetchSession = useCallback(async () => {
    try {
      const r = await fetch("/api/flowboard/auth/session");
      if (!r.ok) { /* No redirect needed in Media Deck */; return; }
      const d = await r.json();
      setUser(d.user);
      setWorkspaces(d.workspaces);
      if (d.workspaces.length > 0 && !currentWorkspace) setCurrentWorkspace(d.workspaces[0]);
    } catch { /* No redirect needed in Media Deck */; }
  }, [router, currentWorkspace]);

  const fetchCards = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspaceId: currentWorkspace.id });
      if (filter !== "all") params.set("filter", filter);
      const r = await fetch(`/api/flowboard/users/me/cards?${params}`);
      if (r.ok) {
        const d = await r.json();
        setCards(d.cards || []);
        setSummary(d.summary || { total: 0, overdue: 0, dueToday: 0, upcoming: 0, completed: 0 });
        const bm = new Map<string, { id: string; title: string }>();
        for (const c of d.cards || []) {
          if (!bm.has(c.board.id)) bm.set(c.board.id, { id: c.board.id, title: c.board.title });
        }
        setAvailableBoards(Array.from(bm.values()));
      }
    } finally { setLoading(false); }
  }, [currentWorkspace, filter]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = cards
    .filter((c) => {
      if (priorityFilter.length > 0 && !priorityFilter.includes(c.priority)) return false;
      if (boardFilter && c.board.id !== boardFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "priority") {
        const o: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
        return (o[a.priority] ?? 5) - (o[b.priority] ?? 5);
      }
      if (sort === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

  const getCl = (c: CardItem) => {
    const cls = c.checklists ?? [];
    if (cls.length === 0) return null;
    let d = 0, tot = 0;
    for (const cl of cls) for (const i of cl.items) { tot++; if (i.isCompleted) d++; }
    if (tot === 0) return null;
    return { done: d, total: tot };
  };
  const isOverdue = (c: CardItem) => c.dueDate && !c.isCompleted && new Date(c.dueDate) < today;
  const isDueToday = (c: CardItem) => {
    if (!c.dueDate || c.isCompleted) return false;
    const dd = new Date(new Date(c.dueDate).getFullYear(), new Date(c.dueDate).getMonth(), new Date(c.dueDate).getDate());
    return dd.getTime() === today.getTime();
  };
  const pColor = (p: string) => p === "URGENT" ? "bg-red-100 text-red-700" : p === "HIGH" ? "bg-orange-100 text-orange-700" : p === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : p === "LOW" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground";
  const pLabel = (p: string) => t(`priority.${p.toLowerCase()}` as any);


  const filterTabs: { value: FilterType; label: string }[] = [
    { value: "all", label: t("common.all") },
    { value: "overdue", label: t("myWork.overdue") },
    { value: "today", label: t("myWork.dueToday") },
    { value: "upcoming", label: t("myWork.upcoming") },
    { value: "completed", label: t("myWork.completed") },
  ];

  const summaryCards = [
    { label: t("myWork.total"), value: summary.total, color: "text-foreground" },
    { label: t("myWork.overdue"), value: summary.overdue, color: "text-red-600" },
    { label: t("myWork.dueToday"), value: summary.dueToday, color: "text-amber-600" },
    { label: t("myWork.upcoming"), value: summary.upcoming, color: "text-blue-600" },
    { label: t("myWork.completed"), value: summary.completed, color: "text-emerald-600" },
  ];

  return (
    <div className="flex flex-col gap-6">
        <header className="h-12 border-b border-border bg-card flex items-center px-6 gap-4">
          <h2 className="font-semibold text-foreground">{t("myWork.title")}</h2>
        </header>
        <div className="p-6 max-w-5xl">
          <div className="grid grid-cols-5 gap-3 mb-6">
            {summaryCards.map((s) => (
              <div key={s.label} className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {filterTabs.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === f.value ? "bg-white shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortType)} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-white">
              <option value="dueDate">{t("myWork.sortDueDate")}</option>
              <option value="priority">{t("myWork.sortPriority")}</option>
              <option value="updated">{t("myWork.sortUpdated")}</option>
            </select>
            {availableBoards.length > 1 && (
              <select value={boardFilter ?? ""} onChange={(e) => setBoardFilter(e.target.value || null)} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-white">
                <option value="">{t("myWork.allBoards")}</option>
                {availableBoards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            )}
            <div className="flex gap-1">
              {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
                <button key={p} onClick={() => setPriorityFilter((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])} className={`px-2 py-1 text-xs rounded-full border ${priorityFilter.includes(p) ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
                  {pLabel(p)}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">{filter === "completed" ? "🎉" : filter === "overdue" ? "✅" : "📋"}</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {filter === "completed" ? t("myWork.noCompleted") : filter === "overdue" ? t("myWork.noOverdue") : filter === "today" ? t("myWork.noDueToday") : t("myWork.noAssigned")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {filter === "all" ? t("myWork.noAssignedDesc") : filter === "completed" ? t("myWork.noCompletedDesc") : filter === "overdue" ? t("myWork.noOverdueDesc") : filter === "today" ? t("myWork.noDueTodayDesc") : t("myWork.noUpcomingDesc")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCards.map((card) => {
                const ci = getCl(card);
                const ov = isOverdue(card);
                const dt = isDueToday(card);
                return (
                  <button key={card.id} onClick={() => router.push(`/tasks/boards/${card.board.id}?card=${card.id}`)} className="w-full bg-card rounded-xl border border-border p-4 text-left hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      {card.coverColor && <div className="w-1.5 h-full min-h-[40px] rounded-full flex-shrink-0" style={{ backgroundColor: card.coverColor }} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-sm font-medium truncate ${card.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{card.title}</h3>
                          {card.isCompleted && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{t("myWork.completed")}</span>}
                          {ov && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{t("myWork.overdueLabel")}</span>}
                          {dt && !ov && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{t("myWork.dueTodayLabel")}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.board.backgroundColor || "#0079bf" }} />
                            {card.board.title}
                          </span>
                          <span>›</span>
                          <span>{card.list.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {card.priority !== "NONE" && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pColor(card.priority)}`}>{pLabel(card.priority)}</span>}
                          {card.dueDate && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ov ? "bg-red-100 text-red-700 font-semibold" : dt ? "bg-amber-100 text-amber-700 font-semibold" : "text-muted-foreground"}`}>{formatDateShort(card.dueDate, locale)}</span>}
                          {ci && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ci.done === ci.total ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground"}`}>☑ {ci.done}/{ci.total}</span>}
                          {card.labels.length > 0 && <div className="flex gap-0.5">{card.labels.slice(0, 4).map((cl) => <span key={cl.label.id} className="h-1.5 w-6 rounded-full" style={{ backgroundColor: cl.label.color }} />)}</div>}
                          <div className="flex items-center gap-2 ml-auto text-muted-foreground">
                            {card._count.comments > 0 && <span className="text-[10px]">💬 {card._count.comments}</span>}
                            {card._count.attachments > 0 && <span className="text-[10px]">📎 {card._count.attachments}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );
}
