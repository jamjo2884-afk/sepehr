
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFlowToast } from "@/components/flowboard/toast";
import { useLanguage } from "@/i18n/flowboard/context";
import { formatDate } from "@/i18n/flowboard/dates";

interface CardTemplateItem {
  id: string; name: string; description?: string; title: string; cardDesc?: string;
  priority: string; coverColor?: string; labels: string; checklists: string;
  createdAt: string; updatedAt: string;
}
interface Workspace { id: string; name: string; slug: string; role: string; }
interface Board { id: string; title: string; lists: { id: string; title: string }[]; }

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const { t, locale } = useLanguage();
  const [templates, setTemplates] = useState<CardTemplateItem[]>([]);
  const [, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplateItem | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [usingTemplate, setUsingTemplate] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const r = await fetch("/api/flowboard/auth/session");
      if (!r.ok) { /* No redirect needed in Media Deck */; return; }
      const d = await r.json();
      setWorkspaces(d.workspaces);
      if (d.workspaces.length > 0 && !currentWorkspace) setCurrentWorkspace(d.workspaces[0]);
    } catch { /* No redirect needed in Media Deck */; }
  }, [router, currentWorkspace]);

  const fetchTemplates = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/card-templates?workspaceId=${currentWorkspace.id}`);
      if (r.ok) setTemplates(await r.json());
    } finally { setLoading(false); }
  }, [currentWorkspace]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const fetchBoards = async () => {
    if (!currentWorkspace) return;
    try {
      const r = await fetch(`/api/flowboard/workspaces/${currentWorkspace.id}/boards`);
      if (r.ok) {
        const bd = await r.json();
        const bwl = await Promise.all(bd.map(async (b: { id: string; title: string }) => {
          const lr = await fetch(`/api/flowboard/boards/${b.id}/lists`);
          if (lr.ok) {
            const ls = await lr.json();
            return { ...b, lists: ls.map((l: { id: string; title: string }) => ({ id: l.id, title: l.title })) };
          }
          return { ...b, lists: [] };
        }));
        setBoards(bwl);
      }
    } catch {}
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(t("templates.deleteConfirm", { name: templateName }))) return;
    setDeletingId(templateId);
    try {
      const r = await fetch(`/api/flowboard/card-templates/${templateId}`, { method: "DELETE" });
      if (r.ok) { toast(t("success.templateDeleted"), "success"); setTemplates((p) => p.filter((tpl) => tpl.id !== templateId)); }
      else toast(t("error.deleteFailed"), "error");
    } catch { toast(t("error.deleteFailed"), "error"); }
    finally { setDeletingId(null); }
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate || !selectedBoardId || !selectedListId || usingTemplate) return;
    setUsingTemplate(true);
    try {
      const r = await fetch(`/api/flowboard/card-templates/${selectedTemplate.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: selectedBoardId, listId: selectedListId }),
      });
      if (r.ok) {
        const c = await r.json();
        toast(t("success.cardCreatedFromTemplate"), "success");
        setShowUseDialog(false);
        router.push(`/boards/${selectedBoardId}?card=${c.id}`);
      } else toast(t("error.templateFailed"), "error");
    } catch { toast(t("error.templateFailed"), "error"); }
    finally { setUsingTemplate(false); }
  };

  const openUseDialog = async (template: CardTemplateItem) => {
    setSelectedTemplate(template);
    setSelectedBoardId(null);
    setSelectedListId(null);
    setShowUseDialog(true);
    await fetchBoards();
  };

  const parseJson = (j: string) => { try { return JSON.parse(j); } catch { return []; } };
  const pColor = (p: string) => p === "URGENT" ? "bg-red-100 text-red-700" : p === "HIGH" ? "bg-orange-100 text-orange-700" : p === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : p === "LOW" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground";
  const pLabel = (p: string) => t(`priority.${p.toLowerCase()}` as any);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("templates.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("templates.count", { count: templates.length })}</p>
        </div>
      </header>
      <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("templates.noTemplates")}</h3>
              <p className="text-muted-foreground text-sm mb-4">{t("templates.createFromCard")}</p>
              <Link href="/tasks/boards" className="text-primary text-sm hover:underline">{t("templates.goToBoards")}</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => {
                const ld = parseJson(tpl.labels);
                const cls = parseJson(tpl.checklists);
                const ti = cls.reduce((a: number, cl: { items?: unknown[] }) => a + (cl.items?.length ?? 0), 0);
                return (
                  <div key={tpl.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all">
                    {tpl.coverColor && <div className="h-2 -mx-4 -mt-4 mb-3 rounded-t-xl" style={{ backgroundColor: tpl.coverColor }} />}
                    <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{tpl.name}</h3>
                    {tpl.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{tpl.description}</p>}
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t("templates.cardTitle")}</span> {tpl.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {tpl.priority !== "NONE" && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pColor(tpl.priority)}`}>{pLabel(tpl.priority)}</span>}
                        {cls.length > 0 && <span className="text-[10px] text-muted-foreground">☑ {cls.length} {t("templates.checklists")}, {ti} {t("templates.items")}</span>}
                      </div>
                      {ld.length > 0 && <div className="flex gap-0.5">{ld.map((l: { name: string; color: string }, i: number) => <span key={i} className="h-1.5 w-8 rounded-full" style={{ backgroundColor: l.color }} title={l.name} />)}</div>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">{t("templates.created")} {formatDate(tpl.createdAt, locale)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => openUseDialog(tpl)} className="flex-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover font-medium">{t("templates.use")}</button>
                      <button onClick={() => handleDelete(tpl.id, tpl.name)} disabled={deletingId === tpl.id} className="px-3 py-1.5 text-xs text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 disabled:opacity-50">{deletingId === tpl.id ? "..." : t("templates.delete")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      {showUseDialog && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUseDialog(false)}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">{t("templates.useTemplate")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("templates.creatingFrom")} &quot;{selectedTemplate.name}&quot;</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("templates.board")}</label>
                <select value={selectedBoardId ?? ""} onChange={(e) => { setSelectedBoardId(e.target.value || null); setSelectedListId(null); }} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">{t("templates.selectBoard")}</option>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              {selectedBoardId && (
                <div>
                  <label className="text-sm font-medium mb-1 block">{t("templates.list")}</label>
                  <select value={selectedListId ?? ""} onChange={(e) => setSelectedListId(e.target.value || null)} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">{t("templates.selectList")}</option>
                    {boards.find((b) => b.id === selectedBoardId)?.lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>
              )}
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{t("templates.willCreate")}</p>
                <ul className="text-xs text-foreground space-y-0.5">
                  <li>• {t("templates.titlePreview")}: {selectedTemplate.title}</li>
                  {selectedTemplate.cardDesc && <li>• {t("cards.description")}: {selectedTemplate.cardDesc.slice(0, 60)}{selectedTemplate.cardDesc.length > 60 ? "..." : ""}</li>}
                  {selectedTemplate.priority !== "NONE" && <li>• {t("templates.priorityPreview")}: {pLabel(selectedTemplate.priority)}</li>}
                  {parseJson(selectedTemplate.checklists).length > 0 && <li>• {t("templates.checklistsPreview")}: {parseJson(selectedTemplate.checklists).length}</li>}
                  <li>• {t("templates.statusPreview")}: {t("templates.incompleteFresh")}</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowUseDialog(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t("common.cancel")}</button>
              <button onClick={handleUseTemplate} disabled={!selectedBoardId || !selectedListId || usingTemplate} className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50">{usingTemplate ? t("templates.creatingCard") : t("templates.createCard")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
