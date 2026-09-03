// @ts-nocheck
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFlowToast } from "@/components/flowboard/toast";
import { useLanguage } from "@/i18n/flowboard/context";
import { formatDate } from "@/i18n/flowboard/dates";

interface Card {
  id: string;
  title: string;
  description?: string;
  list: { id: string; title: string };
  board: { id: string; title: string };
  priority: string;
  dueDate?: string;
  startDate?: string;
  isCompleted: boolean;
  labels: { label: { id: string; name: string; color: string } }[];
  members: { user: { id: string; name: string; avatarUrl?: string } }[];
  _count: { comments: number; checklists: number; attachments: number };
  updatedAt: string;
}

type SortKey = "title" | "list" | "board" | "priority" | "dueDate" | "updatedAt";
type SortDir = "asc" | "desc";
const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };

export default function TablePage() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const { t, locale } = useLanguage();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterText, setFilterText] = useState("");
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterBoard, setFilterBoard] = useState<string>("all");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const sessionRes = await fetch("/api/flowboard/auth/session");
      if (!sessionRes.ok) { /* No redirect needed in Media Deck */; return; }
      const session = await sessionRes.json();
      const workspaceId = session.workspaces?.[0]?.id;
      if (!workspaceId) return;
      const res = await fetch(`/api/flowboard/workspaces/${workspaceId}/cards`);
      if (res.ok) { const data = await res.json(); setCards(data.cards || []); }
    } catch { toast("Failed to load table", "error"); }
    finally { setLoading(false); }
  }, [router, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const uniqueBoards = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    cards.forEach((c) => { if (!map.has(c.board.id)) map.set(c.board.id, c.board); });
    return Array.from(map.values());
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filterText) {
        const q = filterText.toLowerCase();
        if (!card.title.toLowerCase().includes(q) && !card.board.title.toLowerCase().includes(q) && !card.list.title.toLowerCase().includes(q)) return false;
      }
      if (filterPriority.length > 0 && !filterPriority.includes(card.priority)) return false;
      if (filterBoard !== "all" && card.board.id !== filterBoard) return false;
      return true;
    }).sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "priority") return ((PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5)) * dir;
      if (sortKey === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1 * dir;
        if (!b.dueDate) return -1 * dir;
        return (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * dir;
      }
      if (sortKey === "updatedAt") return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [cards, filterText, filterPriority, filterBoard, sortKey, sortDir]);

  const priorityLabel = (p: string) => t(`priority.${p.toLowerCase()}` as any);

  const columns: { key: SortKey; label: string; width: string }[] = [
    { key: "title", label: t("table.card"), width: "w-1/4" },
    { key: "list", label: t("table.list"), width: "w-1/6" },
    { key: "board", label: t("table.board"), width: "w-1/6" },
    { key: "priority", label: t("table.priority"), width: "w-24" },
    { key: "dueDate", label: t("table.dueDate"), width: "w-28" },
    { key: "updatedAt", label: t("table.updatedAt"), width: "w-28" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <button onClick={() => router.push("/tasks/boards")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={locale === "fa" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
        <h1 className="font-semibold text-lg">{t("nav.table")}</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input type="text" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder={t("table.search")} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-white w-48" />
          <select value={filterBoard} onChange={(e) => setFilterBoard(e.target.value)} className="px-2 py-1.5 text-sm rounded-lg border border-border bg-white">
            <option value="all">{t("common.all")}</option>
            {uniqueBoards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <div className="flex gap-1">
            {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
              <button key={p} onClick={() => setFilterPriority((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])} className={`px-2 py-1 text-xs rounded-full border ${filterPriority.includes(p) ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
                {priorityLabel(p)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="p-4 max-w-full overflow-x-auto">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col.key} className={`${col.width} text-left px-3 py-2 cursor-pointer hover:bg-muted/50 select-none`} onClick={() => { if (sortKey === col.key) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(col.key); setSortDir("asc"); } }}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCards.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("table.noCards")}</td></tr>
              ) : filteredCards.map((card) => {
                const overdue = card.dueDate && !card.isCompleted && new Date(card.dueDate) < new Date();
                return (
                  <tr key={card.id} className="border-b border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedCardId(card.id)}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${card.isCompleted ? "line-through text-muted-foreground" : ""}`}>{card.title}</span>
                        {card.labels.slice(0, 3).map((cl) => <span key={cl.label.id} className="h-1.5 w-4 rounded-full inline-block" style={{ backgroundColor: cl.label.color }} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{card.list.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{card.board.title}</td>
                    <td className="px-3 py-2">
                      {card.priority !== "NONE" && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${card.priority === "URGENT" ? "bg-red-100 text-red-700" : card.priority === "HIGH" ? "bg-orange-100 text-orange-700" : card.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{priorityLabel(card.priority)}</span>}
                    </td>
                    <td className={`px-3 py-2 text-xs ${overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {card.dueDate ? formatDate(card.dueDate, locale) : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(card.updatedAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
