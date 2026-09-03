// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/flowboard/context";
import { formatDate } from "@/i18n/flowboard/dates";

interface DashboardData {
  cards: { id: string; title: string; priority: string; dueDate?: string; isCompleted: boolean; list: { title: string }; board: { title: string }; updatedAt: string }[];
  stats: { total: number; completed: number; overdue: number; byList: Record<string, number>; byPriority: Record<string, number>; byBoard: Record<string, number> };
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const sessionRes = await fetch("/api/flowboard/auth/session");
      if (!sessionRes.ok) { /* No redirect needed in Media Deck */; return; }
      const session = await sessionRes.json();
      const workspaceId = session.workspaces?.[0]?.id;
      if (!workspaceId) return;
      const res = await fetch(`/api/flowboard/workspaces/${workspaceId}/cards`);
      if (res.ok) {
        const workspaceData = await res.json();
        const cards = workspaceData.cards || [];
        const now = new Date();
        const completed = cards.filter((c: any) => c.isCompleted).length;
        const overdue = cards.filter((c: any) => c.dueDate && !c.isCompleted && new Date(c.dueDate) < now).length;

        const byList: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        const byBoard: Record<string, number> = {};
        cards.forEach((c: any) => {
          byList[c.list.title] = (byList[c.list.title] || 0) + 1;
          byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
          byBoard[c.board.title] = (byBoard[c.board.title] || 0) + 1;
        });

        setData({
          cards: cards.slice(0, 10),
          stats: { total: cards.length, completed, overdue, byList, byPriority, byBoard },
        });
      }
    } catch {} finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const priorityLabel = (p: string) => t(`priority.${p.toLowerCase()}` as any);

  const completionRate = data ? (data.stats.total > 0 ? Math.round((data.stats.completed / data.stats.total) * 100) : 0) : 0;
  const maxListCount = data ? Math.max(...Object.values(data.stats.byList), 1) : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <button onClick={() => router.push("/tasks/boards")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={locale === "fa" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
        <h1 className="font-semibold text-lg">{t("nav.dashboard")}</h1>
      </header>

      <div className="p-6 max-w-5xl">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : !data ? null : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: t("dashboard.totalCards"), value: data.stats.total, color: "text-foreground", bg: "bg-card" },
                { label: t("dashboard.completedCards"), value: data.stats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: t("dashboard.overdueCards"), value: data.stats.overdue, color: "text-red-600", bg: "bg-red-50" },
                { label: t("dashboard.completionRate"), value: `${completionRate}%`, color: "text-blue-600", bg: "bg-blue-50" },
              ].map((kpi) => (
                <div key={kpi.label} className={`${kpi.bg} rounded-xl border border-border p-4`}>
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Cards by List */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">{t("dashboard.cardsByList")}</h3>
                <div className="space-y-2">
                  {Object.entries(data.stats.byList).map(([name, count]) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 truncate">{name}</span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${(count / maxListCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cards by Priority */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">{t("dashboard.cardsByPriority")}</h3>
                <div className="space-y-2">
                  {(["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const).map((p) => {
                    const count = data.stats.byPriority[p] || 0;
                    const colors: Record<string, string> = { URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-yellow-500", LOW: "bg-blue-500", NONE: "bg-gray-300" };
                    const maxP = Math.max(...Object.values(data.stats.byPriority), 1);
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-24">{priorityLabel(p)}</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div className={`${colors[p]} h-4 rounded-full transition-all`} style={{ width: `${(count / maxP) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cards by Board */}
            <div className="bg-card rounded-xl border border-border p-4 mb-6">
              <h3 className="text-sm font-semibold mb-3">{t("dashboard.cardsByBoard")}</h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(data.stats.byBoard).sort(([, a], [, b]) => b - a).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium truncate">{name}</span>
                    <span className="text-lg font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Updated */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">{t("dashboard.recentlyUpdated")}</h3>
              <div className="space-y-2">
                {data.cards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      {card.isCompleted && <span className="text-emerald-500">✓</span>}
                      <span className="text-sm">{card.title}</span>
                      {card.priority !== "NONE" && <span className={`text-[10px] px-1.5 py-0.5 rounded ${card.priority === "URGENT" ? "bg-red-100 text-red-700" : card.priority === "HIGH" ? "bg-orange-100 text-orange-700" : card.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{priorityLabel(card.priority)}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(card.updatedAt, locale)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
