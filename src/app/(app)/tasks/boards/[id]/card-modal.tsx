// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { useFlowToast } from "@/components/flowboard/toast";
import { useLanguage } from "@/i18n/flowboard/context";

interface CardDetail {
  id: string;
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
  startDate?: string;
  coverColor?: string;
  isCompleted: boolean;
  isArchived: boolean;
  list: { id: string; title: string };
  board: { id: string; title: string; workspaceId: string };
  creator: { id: string; name: string; email: string; avatarUrl?: string };
  members: { user: { id: string; name: string; email: string; avatarUrl?: string } }[];
  labels: { label: { id: string; name: string; color: string } }[];
  checklists: {
    id: string;
    title: string;
    items: {
      id: string;
      content: string;
      isCompleted: boolean;
      assignee?: { id: string; name: string; avatarUrl?: string };
    }[];
  }[];
  comments: {
    id: string;
    content: string;
    isEdited: boolean;
    createdAt: string;
    author: { id: string; name: string; avatarUrl?: string };
  }[];
  activities: {
    id: string;
    type: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string; avatarUrl?: string };
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    createdAt: string;
    uploader: { id: string; name: string };
  }[];
}

interface CardDetailModalProps {
  cardId: string;
  boardMembers: { id: string; name: string; email: string; avatarUrl?: string }[];
  boardLabels: { id: string; name: string; color: string }[];
  boardLists?: { id: string; title: string }[];
  onClose: () => void;
  onCardUpdated: () => void;
}

export function CardDetailModal({
  cardId,
  boardMembers,
  boardLabels,
  boardLists = [],
  onClose,
  onCardUpdated,
}: CardDetailModalProps) {
  const { toast } = useFlowToast();
  const { t, locale } = useLanguage();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMoveTo, setShowMoveTo] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [showNewChecklist, setShowNewChecklist] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
        setTitle(data.title);
        setDescription(data.description || "");
      }
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const updateCard = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchCard();
        onCardUpdated();
      }
    } catch {
      toast("Failed to update card", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: !card?.isArchived }),
      });
      if (res.ok) {
        toast(card?.isArchived ? t("success.cardRestored") : t("success.cardArchived"), "success");
        if (card?.isArchived) {
          // Was archived, now restored — stay in modal
          fetchCard();
          onCardUpdated();
        } else {
          // Was active, now archived — close modal
          onClose();
          onCardUpdated();
        }
      }
    } catch {
      toast("Failed to archive card", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCard = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}/copy`, {
        method: "POST",
      });
      if (res.ok) {
        toast("Card copied", "success");
        onCardUpdated();
      }
    } catch {
      toast("Failed to copy card", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToList = async (targetListId: string) => {
    if (!card || targetListId === card.list.id) {
      setShowMoveTo(false);
      return;
    }
    setSaving(true);
    try {
      // Get current max position in target list
      const res = await fetch(`/api/flowboard/cards/${cardId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: targetListId, position: 0 }),
      });
      if (res.ok) {
        toast("Card moved", "success");
        setShowMoveTo(false);
        fetchCard();
        onCardUpdated();
      }
    } catch {
      toast("Failed to move card", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTitleSave = () => {
    if (title.trim() && title !== card?.title) {
      updateCard({ title: title.trim() });
    }
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (description !== (card?.description || "")) {
      updateCard({ description: description.trim() || null });
    }
    setEditingDescription(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        setNewComment("");
        fetchCard();
      }
    } catch {
      toast("Failed to add comment", "error");
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingCommentText.trim() }),
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentText("");
        fetchCard();
      }
    } catch {
      toast("Failed to edit comment", "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Comment deleted", "success");
        fetchCard();
      }
    } catch {
      toast("Failed to delete comment", "error");
    }
  };

  const handleAddLabel = async (labelId: string) => {
    try {
      await fetch(`/api/flowboard/cards/${cardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      setShowAddLabel(false);
      fetchCard();
      onCardUpdated();
    } catch {
      toast("Failed to add label", "error");
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    try {
      await fetch(`/api/flowboard/cards/${cardId}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      fetchCard();
      onCardUpdated();
    } catch {
      toast("Failed to remove label", "error");
    }
  };

  const handleToggleMember = async (userId: string) => {
    const isMember = card?.members.some((m) => m.user.id === userId);
    try {
      await fetch(`/api/flowboard/cards/${cardId}/members`, {
        method: isMember ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setShowAddMember(false);
      fetchCard();
    } catch {
      toast("Failed to update member", "error");
    }
  };

  const handleToggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    try {
      await fetch(`/api/checklist-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !isCompleted }),
      });
      fetchCard();
      onCardUpdated();
    } catch {
      toast("Failed to update item", "error");
    }
  };

  const handleAddChecklistItem = async (checklistId: string, content: string) => {
    try {
      await fetch(`/api/checklists/${checklistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      fetchCard();
    } catch {
      toast("Failed to add item", "error");
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      await fetch(`/api/checklist-items/${itemId}`, { method: "DELETE" });
      fetchCard();
    } catch {
      toast("Failed to delete item", "error");
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim()) return;

    try {
      await fetch(`/api/flowboard/cards/${cardId}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newChecklistTitle.trim() }),
      });
      setNewChecklistTitle("");
      setShowNewChecklist(false);
      fetchCard();
    } catch {
      toast("Failed to create checklist", "error");
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm("Delete this checklist?")) return;
    try {
      await fetch(`/api/checklists/${checklistId}`, { method: "DELETE" });
      fetchCard();
      onCardUpdated();
    } catch {
      toast("Failed to delete checklist", "error");
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/flowboard/cards/${cardId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast("Template created", "success");
        setShowSaveTemplate(false);
        setTemplateName("");
        setTemplateDesc("");
      } else {
        toast("Failed to create template", "error");
      }
    } catch {
      toast("Failed to create template", "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const getChecklistProgress = (checklist: CardDetail["checklists"][0]) => {
    if (checklist.items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = checklist.items.filter((i) => i.isCompleted).length;
    return { done, total: checklist.items.length, pct: Math.round((done / checklist.items.length) * 100) };
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl w-full max-w-3xl mx-4 p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-8 pb-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl mx-4 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cover */}
        {card.coverColor && <div className="h-24 rounded-t-xl" style={{ backgroundColor: card.coverColor }} />}

        {/* Archived banner */}
        {card.isArchived && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-sm text-amber-700 font-medium">{t("cards.archivedBanner")}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="flex-1">
              {editingTitle ? (
                <form onSubmit={(e) => { e.preventDefault(); handleTitleSave(); }}>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                    onBlur={handleTitleSave}
                    className="w-full text-xl font-semibold px-2 py-1 rounded border border-primary focus:outline-none"
                  />
                </form>
              ) : (
                <h2 className="text-xl font-semibold cursor-pointer hover:bg-muted px-2 py-1 rounded -ml-2" onClick={() => setEditingTitle(true)}>
                  {card.title}
                </h2>
              )}
              <p className="text-sm text-muted-foreground mt-1 px-2">
                in list <span className="font-medium">{card.list.title}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-2 flex gap-6">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setActiveTab("details")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("cards.details")}
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "activity"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("cards.activity")} ({card.activities.length})
              </button>
            </div>

            {activeTab === "details" ? (
              <>
                {/* Labels display */}
                {card.labels.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("cards.labels")}</h4>
                    <div className="flex flex-wrap gap-1">
                      {card.labels.map((cl) => (
                        <span
                          key={cl.label.id}
                          className="px-3 py-1 rounded-full text-xs text-white font-medium cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: cl.label.color }}
                          onClick={() => handleRemoveLabel(cl.label.id)}
                          title={t("common.clickToRemove")}
                        >
                          {cl.label.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members display */}
                {card.members.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("cards.members")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {card.members.map((m) => (
                        <div
                          key={m.user.id}
                          className="flex items-center gap-2 px-2 py-1 bg-muted rounded-lg text-sm cursor-pointer hover:bg-muted/80"
                          onClick={() => handleToggleMember(m.user.id)}
                          title={t("common.clickToRemove")}
                        >
                          <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                            {m.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                          {m.user.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    {t("cards.description")}
                  </h4>
                  {editingDescription ? (
                    <div>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        autoFocus
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                      <div className="flex gap-1 mt-2">
                        <button onClick={handleDescriptionSave} className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-hover">
                          Save
                        </button>
                        <button
                          onClick={() => { setDescription(card.description || ""); setEditingDescription(false); }}
                          className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setEditingDescription(true)} className="px-3 py-2 rounded-lg bg-muted text-sm cursor-pointer hover:bg-muted/80 min-h-[60px]">
                      {card.description ? (
                        <p className="whitespace-pre-wrap">{card.description}</p>
                      ) : (
                        <span className="text-muted-foreground">Add a more detailed description...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Checklists */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {t("cards.checklists")}
                  </h4>
                    <button onClick={() => setShowNewChecklist(true)} className="text-xs text-primary hover:underline">
                      + Add checklist
                    </button>
                  </div>

                  {showNewChecklist && (
                    <form onSubmit={handleCreateChecklist} className="flex gap-1 mb-3">
                      <input
                        type="text"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        placeholder="Checklist title..."
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button type="submit" disabled={!newChecklistTitle.trim()} className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50">
                        Add
                      </button>
                      <button type="button" onClick={() => { setShowNewChecklist(false); setNewChecklistTitle(""); }} className="px-3 py-1.5 text-sm text-muted-foreground">
                        Cancel
                      </button>
                    </form>
                  )}

                  {card.checklists.map((checklist) => {
                    const progress = getChecklistProgress(checklist);
                    return (
                      <div key={checklist.id} className="mb-4 bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{checklist.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{progress.done}/{progress.total}</span>
                            <button
                              onClick={() => handleDeleteChecklist(checklist.id)}
                              className="text-xs text-destructive hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5 mb-3">
                          <div
                            className="bg-success h-1.5 rounded-full transition-all"
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                        <div className="space-y-1">
                          {checklist.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 group">
                              <label className="flex items-center gap-2 cursor-pointer hover:bg-white/50 px-2 py-1 rounded flex-1">
                                <input
                                  type="checkbox"
                                  checked={item.isCompleted}
                                  onChange={() => handleToggleChecklistItem(item.id, item.isCompleted)}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className={`text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                  {item.content}
                                </span>
                              </label>
                              <button
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                className="text-xs text-destructive opacity-0 group-hover:opacity-100 hover:underline px-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <ChecklistItemInput onAdd={(content) => handleAddChecklistItem(checklist.id, content)} />
                      </div>
                    );
                  })}

                  {card.checklists.length === 0 && !showNewChecklist && (
                    <p className="text-sm text-muted-foreground">No checklists yet.</p>
                  )}
                </div>

                {/* Comments */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {t("cards.comments")} ({card.comments.length})
                  </h4>

                  <form onSubmit={handleAddComment} className="mb-4">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <button type="submit" disabled={!newComment.trim()} className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-hover disabled:opacity-50">
                        Save
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {card.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {comment.author.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{comment.author.name}</span>
                            <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                            {comment.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                            <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-xs text-destructive hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {editingCommentId === comment.id ? (
                            <div className="mt-1">
                              <textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 text-sm rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                autoFocus
                              />
                              <div className="flex gap-1 mt-1">
                                <button onClick={() => handleEditComment(comment.id)} className="px-2 py-0.5 bg-primary text-white text-xs rounded">Save</button>
                                <button onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }} className="px-2 py-0.5 text-xs text-muted-foreground">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {t("cards.attachments")} ({card.attachments.length})
                  </h4>

                  {/* Upload button */}
                  <div className="mb-3">
                    <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm text-muted-foreground">Upload a file</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setSaving(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch(`/api/flowboard/cards/${cardId}/attachments`, {
                              method: "POST",
                              body: formData,
                            });
                            if (res.ok) {
                              toast("File uploaded", "success");
                              fetchCard();
                              onCardUpdated();
                            } else {
                              const data = await res.json();
                              toast(data.error || "Upload failed", "error");
                            }
                          } catch {
                            toast("Failed to upload file", "error");
                          } finally {
                            setSaving(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Attachment list */}
                  {card.attachments.length > 0 && (
                    <div className="space-y-2">
                      {card.attachments.map((att) => {
                        const isImage = att.fileType.startsWith("image/");
                        return (
                          <div key={att.id} className="bg-muted rounded-lg overflow-hidden">
                            {/* Image preview */}
                            {isImage && (
                              <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={att.fileUrl}
                                  alt={att.fileName}
                                  className="w-full h-32 object-cover"
                                  loading="lazy"
                                />
                              </a>
                            )}
                            <div className="flex items-center gap-3 p-2">
                              {isImage ? null : (
                                <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              <div className="flex-1 min-w-0">
                                <a
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:underline truncate block"
                                >
                                  {att.fileName}
                                </a>
                                <p className="text-xs text-muted-foreground">
                                  {(att.fileSize / 1024).toFixed(1)} KB · {formatDate(att.createdAt)}
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete "${att.fileName}"?`)) return;
                                  try {
                                    const res = await fetch(`/api/flowboard/cards/${cardId}/attachments`, {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ attachmentId: att.id }),
                                    });
                                    if (res.ok) {
                                      toast("Attachment deleted", "success");
                                      fetchCard();
                                    }
                                  } catch {
                                    toast("Failed to delete attachment", "error");
                                  }
                                }}
                                className="text-xs text-destructive hover:underline flex-shrink-0"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Activity Tab */
              <div className="space-y-3">
                {card.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
                ) : (
                  card.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {activity.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user.name}</span>{" "}
                          <span className="text-muted-foreground">{activity.content}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-48 flex-shrink-0 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t("cards.details")}</h4>

            {/* Move to */}
            <div className="relative">
              <button
                onClick={() => setShowMoveTo(!showMoveTo)}
                disabled={saving}
                className="w-full px-3 py-1.5 text-sm text-left rounded-lg border border-border hover:bg-muted disabled:opacity-50"
              >
                {t("cards.moveTo")}
              </button>
              {showMoveTo && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-border rounded-lg shadow-xl z-50 py-1">
                  {boardLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleMoveToList(list.id)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                        list.id === card.list.id ? "bg-primary/5 text-primary font-medium" : ""
                      }`}
                    >
                      {list.id === card.list.id && <span className="text-primary">✓</span>}
                      {list.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("cards.priority")}</label>
              <select
                value={card.priority}
                onChange={(e) => updateCard({ priority: e.target.value })}
                disabled={saving}
                className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="NONE">None</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("cards.dueDate")}</label>
              <input
                type="date"
                value={card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateCard({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                disabled={saving}
                className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("cards.startDate")}</label>
              <input
                type="date"
                value={card.startDate ? new Date(card.startDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateCard({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                disabled={saving}
                className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Cover color */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("cards.labels")}</label>
              <div className="flex flex-wrap gap-1">
                {["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", null].map((color) => (
                  <button
                    key={color ?? "none"}
                    onClick={() => updateCard({ coverColor: color })}
                    className={`w-8 h-6 rounded border-2 ${card.coverColor === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color ?? "#e2e8f0" }}
                  >
                    {!color && <span className="text-xs text-muted-foreground">✕</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Complete toggle */}
            <button
              onClick={() => updateCard({ isCompleted: !card.isCompleted })}
              disabled={saving}
              className={`w-full px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                card.isCompleted
                  ? "bg-success text-white border-success"
                  : "bg-white text-foreground border-border hover:bg-muted"
              }`}
            >
              {card.isCompleted ? "✓ " + t("cards.completed") : t("cards.complete")}
            </button>

            <hr className="border-border" />

            {/* Members */}
            <div>
              <button              onClick={() => setShowAddMember(!showAddMember)}
              className="w-full px-3 py-1.5 text-sm text-left rounded-lg border border-border hover:bg-muted"
            >
              {t("cards.members")}
            </button>
              {showAddMember && (
                <div className="mt-1 bg-white border border-border rounded-lg shadow-lg p-2 space-y-1">
                  {boardMembers.map((member) => {
                    const isMember = card.members.some((m) => m.user.id === member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => handleToggleMember(member.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isMember ? "bg-primary/10" : "hover:bg-muted"}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                          {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                        <span className="flex-1 text-left truncate">{member.name}</span>
                        {isMember && <span className="text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Labels */}
            <div>
              <button              onClick={() => setShowAddLabel(!showAddLabel)}
              className="w-full px-3 py-1.5 text-sm text-left rounded-lg border border-border hover:bg-muted"
            >
              {t("cards.labels")}
            </button>
              {showAddLabel && (
                <div className="mt-1 bg-white border border-border rounded-lg shadow-lg p-2 space-y-1">
                  {boardLabels.map((label) => {
                    const isLabel = card.labels.some((cl) => cl.label.id === label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => (isLabel ? handleRemoveLabel(label.id) : handleAddLabel(label.id))}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted"
                      >
                        <span className="w-6 h-4 rounded-full" style={{ backgroundColor: label.color }} />
                        <span className="flex-1 text-left">{label.name}</span>
                        {isLabel && <span className="text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Copy */}
            <button
              onClick={handleCopyCard}
              disabled={saving}
              className="w-full px-3 py-1.5 text-sm text-left rounded-lg border border-border hover:bg-muted disabled:opacity-50"
            >
              {t("cards.copyCard")}
            </button>

            {/* Save as template */}
            <button
              onClick={() => {
                setTemplateName(card.title);
                setTemplateDesc("");
                setShowSaveTemplate(true);
              }}
              disabled={saving}
              className="w-full px-3 py-1.5 text-sm text-left rounded-lg border border-border hover:bg-muted disabled:opacity-50"
            >
              {t("cards.saveAsTemplate")}
            </button>

            {/* Archive / Restore */}
            <button
              onClick={handleArchiveToggle}
              disabled={saving}
              className={`w-full px-3 py-1.5 text-sm text-left rounded-lg border disabled:opacity-50 ${
                card.isArchived
                  ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  : "border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              {card.isArchived ? t("cards.restoreCard") : t("cards.archiveCard")}
            </button>

            <hr className="border-border" />

            {/* Delete */}
            <button
              onClick={async () => {
                if (!confirm("Delete this card permanently? This cannot be undone.")) return;
                try {
                  await fetch(`/api/flowboard/cards/${cardId}`, { method: "DELETE" });
                  toast("Card deleted", "success");
                  onClose();
                  onCardUpdated();
                } catch {
                  toast("Failed to delete card", "error");
                }
              }}
              disabled={saving}
              className="w-full px-3 py-1.5 text-sm text-destructive rounded-lg border border-destructive/20 hover:bg-destructive/10 disabled:opacity-50"
            >
              {t("cards.deleteCard")}
            </button>
          </div>
        </div>
      </div>

      {/* Save as template dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowSaveTemplate(false)}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Save as template</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Template name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Bug Report Template"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Brief description of when to use this template..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will save the card&apos;s title, description, priority, labels, and checklist structure.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowSaveTemplate(false); setTemplateName(""); setTemplateDesc(""); }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                {savingTemplate ? t("common.saving") : t("templates.createTemplate")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItemInput({ onAdd }: { onAdd: (content: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add an item..."
        className="w-full px-2 py-1 text-sm rounded border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </form>
  );
}
