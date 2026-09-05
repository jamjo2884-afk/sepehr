
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { CardDetailModal } from "./card-modal";
import { useFlowToast } from "@/components/flowboard/toast";
import { useLanguage } from "@/i18n/flowboard/context";
import { formatDateShort } from "@/i18n/flowboard/dates";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface CardLabel {
  label: { id: string; name: string; color: string };
}

interface CardMember {
  user: { id: string; name: string; avatarUrl?: string };
}

interface Card {
  id: string;
  title: string;
  description?: string;
  listId?: string;
  position: number;
  priority: string;
  dueDate?: string;
  startDate?: string;
  coverColor?: string;
  coverImage?: string;
  isCompleted: boolean;
  labels: CardLabel[];
  members: CardMember[];
  checklists?: { items: { isCompleted: boolean }[] }[];
  _count: { comments: number; attachments: number; checklists: number };
}

interface List {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface BoardData {
  id: string;
  title: string;
  description?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  workspace: { id: string; name: string };
  members: { user: User }[];
  labels: { label: Label }[];
}

interface ArchivedData {
  lists: { id: string; title: string; cardCount: number; updatedAt: string }[];
  cards: { id: string; title: string; listTitle: string; dueDate?: string; updatedAt: string }[];
}

const BACKGROUND_COLORS = [
  { color: "#0079bf", label: "Blue" },
  { color: "#d29034", label: "Orange" },
  { color: "#519839", label: "Green" },
  { color: "#b04632", label: "Red" },
  { color: "#89609e", label: "Purple" },
  { color: "#cd5a91", label: "Pink" },
  { color: "#4bbf6b", label: "Lime" },
  { color: "#00aecc", label: "Teal" },
  { color: "#172b4d", label: "Dark" },
  { color: "#344563", label: "Navy" },
];

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;
  const { toast } = useFlowToast();
  const { t, locale } = useLanguage();

  const [board, setBoard] = useState<BoardData | null>(null);  const [lists, setLists] = useState<List[]>([]);
  const [, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterMembers, setFilterMembers] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<"all" | "overdue" | "dueToday" | "dueThisWeek">("all");
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Drag state
  const [draggedCard, setDraggedCard] = useState<{ card: Card; listId: string } | null>(null);
  const [draggedList, setDraggedList] = useState<List | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [dragOverCardIndex, setDragOverCardIndex] = useState<number | null>(null);

  // New list/card creation
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);

  // Card detail modal
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Editing list title
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState("");

  // Board settings
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  // Archived items
  const [showArchived, setShowArchived] = useState(false);
  const [archivedData, setArchivedData] = useState<ArchivedData | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkTargetListId, setBulkTargetListId] = useState<string | null>(null);
  const [bulkPriority, setBulkPriority] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const boardScrollRef = useRef<HTMLDivElement>(null);
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const [boardRes, listsRes, sessionRes] = await Promise.all([
        fetch(`/api/flowboard/boards/${boardId}`),
        fetch(`/api/flowboard/boards/${boardId}/lists`),
        fetch("/api/flowboard/auth/session"),
      ]);

      if (!sessionRes.ok) {
        /* No redirect needed in Media Deck */;
        return;
      }

      const sessionData = await sessionRes.json();
      setUser(sessionData.user);

      if (boardRes.ok) {
        setBoard(await boardRes.json());
      }

      if (listsRes.ok) {
        setLists(await listsRes.json());
      }
    } catch {
      /* No redirect needed in Media Deck */;
    } finally {
      setLoading(false);
    }
  }, [boardId, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Open a card directly when arriving via ?card=<id> (e.g. from global
  // search results or My Work). The modal fetches the card by its own id.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get("card");
    if (cardId) setSelectedCardId(cardId);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target as Node)) {
        setShowBoardMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ============================================================
  // CARD DRAG AND DROP
  // ============================================================

  const handleCardDragStart = (e: React.DragEvent, card: Card, listId: string) => {
    setDraggedCard({ card, listId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.4";
    }, 0);
  };

  const handleCardDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedCard(null);
    setDragOverListId(null);
    setDragOverCardIndex(null);
  };

  const handleCardDragOver = (e: React.DragEvent, listId: string, cardIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverListId(listId);
    setDragOverCardIndex(cardIndex);
  };

  const handleCardDrop = async (e: React.DragEvent, targetListId: string, targetIndex: number) => {
    e.preventDefault();
    if (!draggedCard) return;

    const { card, listId: sourceListId } = draggedCard;

    setLists((prev) => {
      const newLists = prev.map((l) => ({ ...l, cards: [...l.cards] }));
      const sourceList = newLists.find((l) => l.id === sourceListId);
      if (sourceList) {
        sourceList.cards = sourceList.cards.filter((c) => c.id !== card.id);
      }
      const targetList = newLists.find((l) => l.id === targetListId);
      if (targetList) {
        const insertAt = Math.min(targetIndex, targetList.cards.length);
        targetList.cards.splice(insertAt, 0, { ...card, listId: targetListId });
        targetList.cards.forEach((c, i) => { c.position = i; });
      }
      return newLists;
    });

    setDraggedCard(null);
    setDragOverListId(null);
    setDragOverCardIndex(null);

    try {
      await fetch(`/api/flowboard/cards/${card.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: targetListId, position: targetIndex }),
      });
    } catch {
      fetchBoard();
    }
  };

  const handleListDropZone = (e: React.DragEvent, listId: string) => {
    if (draggedCard) {
      const list = lists.find((l) => l.id === listId);
      handleCardDrop(e, listId, list?.cards.length ?? 0);
    }
  };

  // ============================================================
  // LIST DRAG AND DROP
  // ============================================================

  const handleListDragStart = (e: React.DragEvent, list: List) => {
    setDraggedList(list);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/list", list.id);
  };

  const handleListDragOver = (e: React.DragEvent, listId: string) => {
    if (draggedList && draggedList.id !== listId) {
      e.preventDefault();
      setDragOverListId(listId);
    }
  };

  const handleListDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    if (!draggedList || draggedList.id === targetListId) return;

    const sourceIndex = lists.findIndex((l) => l.id === draggedList.id);
    const targetIndex = lists.findIndex((l) => l.id === targetListId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newLists = [...lists];
    const [moved] = newLists.splice(sourceIndex, 1);
    newLists.splice(targetIndex, 0, moved);
    newLists.forEach((l, i) => { l.position = i; });
    setLists(newLists);
    setDraggedList(null);
    setDragOverListId(null);

    try {
      await fetch(`/api/flowboard/boards/${boardId}/lists`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists: newLists.map((l) => ({ id: l.id, position: l.position })) }),
      });
    } catch {
      fetchBoard();
    }
  };

  // ============================================================
  // LIST OPERATIONS
  // ============================================================

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    try {
      const res = await fetch(`/api/flowboard/boards/${boardId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newListTitle.trim() }),
      });

      if (res.ok) {
        const list = await res.json();
        setLists((prev) => [...prev, { ...list, cards: [] }]);
        setNewListTitle("");
        setShowNewList(false);
        toast("List created", "success");
      }
    } catch {
      toast("Failed to create list", "error");
    }
  };

  const handleRenameList = async (listId: string) => {
    if (!editingListTitle.trim()) return;

    try {
      await fetch(`/api/lists/${listId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingListTitle.trim() }),
      });
      setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title: editingListTitle.trim() } : l)));
    } catch {
      fetchBoard();
    }
    setEditingListId(null);
  };

  const handleArchiveList = async (listId: string) => {
    try {
      await fetch(`/api/lists/${listId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      setLists((prev) => prev.filter((l) => l.id !== listId));
      toast("List archived", "success");
    } catch {
      toast("Failed to archive list", "error");
    }
  };

  // ============================================================
  // CARD OPERATIONS
  // ============================================================

  const handleCreateCard = async (listId: string) => {
    if (!newCardTitle.trim() || creatingCard) return;
    setCreatingCard(true);

    try {
      const res = await fetch(`/api/flowboard/boards/${boardId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newCardTitle.trim(), listId }),
      });

      if (res.ok) {
        const card = await res.json();
        setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, card] } : l)));
        setNewCardTitle("");
      }
    } catch {
      toast("Failed to create card", "error");
    } finally {
      setCreatingCard(false);
    }
  };

  // ============================================================
  // BOARD OPERATIONS
  // ============================================================

  const handleBoardBackground = async (backgroundColor: string) => {
    try {
      await fetch(`/api/flowboard/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundColor }),
      });
      setBoard((prev) => (prev ? { ...prev, backgroundColor } : prev));
      setShowBackgroundPicker(false);
    } catch {
      toast("Failed to update background", "error");
    }
  };

  const handleArchiveBoard = async () => {
    if (!confirm("Archive this board? You can restore it later from the boards page.")) return;
    try {
      await fetch(`/api/flowboard/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      toast("Board archived", "success");
      router.push("/tasks/boards");
    } catch {
      toast("Failed to archive board", "error");
    }
  };

  const fetchArchived = async () => {
    setLoadingArchived(true);
    try {
      const res = await fetch(`/api/flowboard/boards/${boardId}/archived`);
      if (res.ok) {
        setArchivedData(await res.json());
      }
    } finally {
      setLoadingArchived(false);
    }
  };

  const handleRestoreList = async (listId: string) => {
    try {
      await fetch(`/api/lists/${listId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: false }),
      });
      toast("List restored", "success");
      fetchArchived();
      fetchBoard();
    } catch {
      toast("Failed to restore list", "error");
    }
  };

  const handleRestoreCard = async (cardId: string) => {
    try {
      await fetch(`/api/flowboard/cards/${cardId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: false }),
      });
      toast("Card restored", "success");
      fetchArchived();
      fetchBoard();
    } catch {
      toast("Failed to restore card", "error");
    }
  };

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  const toggleSelectCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const selectAllCards = () => {
    const allIds = lists.flatMap((l) => l.cards.map((c) => c.id));
    setSelectedCardIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedCardIds(new Set());
    setSelectMode(false);
    setBulkAction(null);
  };

  const handleBulkAction = async () => {
    if (selectedCardIds.size === 0 || !bulkAction) return;
    const cardIds = Array.from(selectedCardIds);

    const confirmMessages: Record<string, string> = {
      archive: t("bulk.archiveConfirm", { count: String(cardIds.length) }),
      complete: t("bulk.completeConfirm", { count: String(cardIds.length) }),
    };
    if (confirmMessages[bulkAction] && !confirm(confirmMessages[bulkAction])) return;

    setBulkProcessing(true);
    try {
      const body: Record<string, unknown> = {
        cardIds,
        operation: bulkAction,
      };
      if (bulkAction === "move" && bulkTargetListId) body.targetListId = bulkTargetListId;
      if (bulkAction === "priority" && bulkPriority) body.priority = bulkPriority;

      const res = await fetch("/api/flowboard/cards/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast(t("bulk.cardsUpdated", { count: String(cardIds.length) }), "success");
        deselectAll();
        fetchBoard();
      } else {
        const data = await res.json();
        toast(data.error || "Bulk operation failed", "error");
      }
    } catch {
      toast("Failed to perform bulk operation", "error");
    } finally {
      setBulkProcessing(false);
    }
  };


  // ============================================================
  // FILTERING
  // ============================================================

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filteredLists = lists.map((list) => ({
    ...list,
    cards: list.cards.filter((card) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(query);
        const matchesDesc = card.description?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (filterLabels.length > 0) {
        const cardLabelIds = card.labels.map((cl) => cl.label.id);
        if (!filterLabels.some((id) => cardLabelIds.includes(id))) return false;
      }
      if (filterMembers.length > 0) {
        const cardMemberIds = card.members.map((cm) => cm.user.id);
        if (!filterMembers.some((id) => cardMemberIds.includes(id))) return false;
      }
      if (filterDueDate !== "all") {
        if (!card.dueDate) return false;
        const due = new Date(card.dueDate);
        if (filterDueDate === "overdue" && due >= today) return false;
        if (filterDueDate === "dueToday") {
          const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
          if (dueDay.getTime() !== today.getTime()) return false;
        }
        if (filterDueDate === "dueThisWeek" && (due < today || due > weekEnd)) return false;
      }
      if (filterPriority.length > 0) {
        if (!filterPriority.includes(card.priority)) return false;
      }
      return true;
    }),
  }));

  const hasActiveFilters = filterLabels.length > 0 || filterMembers.length > 0 || filterDueDate !== "all" || filterPriority.length > 0;

  const boardLabels = board?.labels.map((bl) => bl.label) ?? [];
  const boardMembers = board?.members.map((bm) => bm.user) ?? [];

  const getBoardStyle = () => {
    if (board?.backgroundImage)
      return { backgroundImage: `url(${board.backgroundImage})`, backgroundSize: "cover" as const };
    if (board?.backgroundColor) return { backgroundColor: board.backgroundColor };
    return { backgroundColor: "#0079bf" };
  };

  // Helper: get checklist completion for a card
  const getCardChecklistInfo = (card: Card) => {
    const checklists = card.checklists ?? [];
    if (checklists.length === 0) return null;
    let done = 0, total = 0;
    for (const cl of checklists) {
      for (const item of cl.items) {
        total++;
        if (item.isCompleted) done++;
      }
    }
    if (total === 0) return null;
    return { done, total, pct: Math.round((done / total) * 100) };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={getBoardStyle()}>
        <div className="text-white/80 text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("error.boardNotFound")}</h2>
          <button onClick={() => router.push("/tasks/boards")} className="text-primary hover:underline">
            {t("error.backToBoards")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={getBoardStyle()}>
      {/* Board header */}
      <header className="h-12 bg-black/15 backdrop-blur-sm flex items-center px-4 gap-3 flex-shrink-0">
        <button onClick={() => router.push("/tasks/boards")} className="text-white/80 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className="text-white font-semibold text-lg truncate">{board.title}</h1>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <button onClick={() => setShowSearch(!showSearch)} className="text-white/70 hover:text-white p-1.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          {showSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards..."
              autoFocus
              className="absolute right-0 top-full mt-1 w-64 px-3 py-2 rounded-lg bg-white text-foreground text-sm shadow-lg border border-border focus:outline-none focus:ring-2 focus:ring-white/50 z-50"
              onBlur={() => { if (!searchQuery) setShowSearch(false); }}
            />
          )}
        </div>

        {/* Filter */}
        <div className="relative" ref={filterMenuRef}>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`text-white/70 hover:text-white p-1.5 rounded ${hasActiveFilters ? "bg-white/30" : ""}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          {showFilter && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-border p-4 z-50">
              <h4 className="text-sm font-semibold text-foreground mb-3">Filter by</h4>

              {/* Labels */}
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Labels</label>
                <div className="flex flex-wrap gap-1">
                  {boardLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => setFilterLabels((prev) => prev.includes(label.id) ? prev.filter((id) => id !== label.id) : [...prev, label.id])}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${filterLabels.includes(label.id) ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                      style={{ backgroundColor: label.color, color: "white" }}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Members */}
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Members</label>
                <div className="flex flex-wrap gap-1">
                  {boardMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setFilterMembers((prev) => prev.includes(member.id) ? prev.filter((id) => id !== member.id) : [...prev, member.id])}
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${filterMembers.includes(member.id) ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Due date</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: "all" as const, label: t("filter.all") },
                    { value: "overdue" as const, label: t("filter.overdue") },
                    { value: "dueToday" as const, label: t("filter.dueToday") },
                    { value: "dueThisWeek" as const, label: t("filter.dueThisWeek") },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterDueDate(opt.value)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${filterDueDate === opt.value ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Priority</label>
                <div className="flex flex-wrap gap-1">
                  {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPriority((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${filterPriority.includes(p) ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={() => { setFilterLabels([]); setFilterMembers([]); setFilterDueDate("all"); setFilterPriority([]); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Archived items */}
        <button
          onClick={() => { setShowArchived(true); fetchArchived(); }}
          className="text-white/70 hover:text-white p-1.5"
          title={t("archived.title")}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>

        {/* Board menu */}
        <div className="relative" ref={boardMenuRef}>
          <button onClick={() => setShowBoardMenu(!showBoardMenu)} className="text-white/70 hover:text-white p-1.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showBoardMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-border py-1 z-50">
              <button
                onClick={() => { setShowBackgroundPicker(true); setShowBoardMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                Change background
              </button>
              <button
                onClick={() => { handleArchiveBoard(); setShowBoardMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
              >
                Archive board
              </button>
            </div>
          )}
        </div>

        {/* Members avatars */}
        <div className="flex -space-x-2 ml-2">
          {boardMembers.slice(0, 5).map((member) => (
            <div
              key={member.id}
              className="w-8 h-8 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold border-2 border-black/20"
              title={member.name}
            >
              {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
          ))}
          {boardMembers.length > 5 && (
            <div className="w-8 h-8 rounded-full bg-black/30 text-white text-xs flex items-center justify-center font-bold border-2 border-black/20">
              +{boardMembers.length - 5}
            </div>
          )}
        </div>

        {/* Select mode toggle */}
        <button
          onClick={() => { if (selectMode) deselectAll(); else { setSelectMode(true); setSelectedCardIds(new Set()); } }}
          className={`text-white/70 hover:text-white p-1.5 rounded ${selectMode ? "bg-white/30" : ""}`}
          title={t("cards.selectCards")}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </header>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="bg-white border-b border-border px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-muted-foreground">
            {selectedCardIds.size} {selectedCardIds.size !== 1 ? t("common.cards") : t("common.cards")} {t("cards.cardsSelected")}
          </span>
          <button onClick={selectAllCards} className="text-xs text-primary hover:underline">Select all</button>
          <button onClick={deselectAll} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          <div className="flex-1" />
          {selectedCardIds.size > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={bulkAction ?? ""}
                onChange={(e) => setBulkAction(e.target.value || null)}
                className="px-2 py-1 text-sm rounded-lg border border-border bg-white"
              >
                <option value="">{t("cards.chooseAction")}</option>
                <option value="archive">Archive</option>
                <option value="complete">Mark complete</option>
                <option value="move">Move to list</option>
                <option value="priority">Set priority</option>
              </select>

              {bulkAction === "move" && (
                <select
                  value={bulkTargetListId ?? ""}
                  onChange={(e) => setBulkTargetListId(e.target.value || null)}
                  className="px-2 py-1 text-sm rounded-lg border border-border bg-white"
                >
                  <option value="">{t("bulk.selectList")}</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              )}

              {bulkAction === "priority" && (
                <select
                  value={bulkPriority ?? ""}
                  onChange={(e) => setBulkPriority(e.target.value || null)}
                  className="px-2 py-1 text-sm rounded-lg border border-border bg-white"
                >
                  <option value="">{t("bulk.selectPriority")}</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="NONE">None</option>
                </select>
              )}

              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || bulkProcessing || (bulkAction === "move" && !bulkTargetListId) || (bulkAction === "priority" && !bulkPriority)}
                className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50"
              >
                {bulkProcessing ? "Processing..." : "Apply"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Board lists */}
      <div ref={boardScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden p-4 board-scroll">
        <div className="flex gap-3 h-full items-start">
          {filteredLists.map((list) => (
            <div
              key={list.id}
              className={`w-72 flex-shrink-0 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm flex flex-col max-h-full ${
                dragOverListId === list.id && draggedList ? "ring-2 ring-white/50" : ""
              }`}
              draggable
              onDragStart={(e) => handleListDragStart(e, list)}
              onDragOver={(e) => handleListDragOver(e, list.id)}
              onDrop={(e) => handleListDrop(e, list.id)}
            >
              {/* List header */}
              <div className="px-3 py-2.5 flex items-center gap-2">
                {editingListId === list.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleRenameList(list.id); }} className="flex-1">
                    <input
                      type="text"
                      value={editingListTitle}
                      onChange={(e) => setEditingListTitle(e.target.value)}
                      onBlur={() => handleRenameList(list.id)}
                      autoFocus
                      className="w-full px-2 py-1 text-sm font-semibold rounded border border-primary bg-white focus:outline-none"
                    />
                  </form>
                ) : (
                  <h3
                    className="flex-1 text-sm font-semibold text-foreground cursor-pointer hover:bg-black/5 px-2 py-1 rounded"
                    onClick={() => { setEditingListId(list.id); setEditingListTitle(list.title); }}
                  >
                    {list.title}
                  </h3>
                )}
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{list.cards.length}</span>
                <div className="relative group">
                  <button className="text-muted-foreground hover:text-foreground p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-border py-1 z-50 hidden group-hover:block">
                    <button onClick={() => { setEditingListId(list.id); setEditingListTitle(list.title); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                      Rename
                    </button>
                    <button onClick={() => handleArchiveList(list.id)} className="w-full px-3 py-1.5 text-left text-sm text-amber-700 hover:bg-amber-50">
                      Archive
                    </button>
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div
                className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px]"
                onDragOver={(e) => { e.preventDefault(); if (draggedCard) setDragOverListId(list.id); }}
                onDrop={(e) => handleListDropZone(e, list.id)}
              >
                {list.cards.map((card, index) => {
                  const checklistInfo = getCardChecklistInfo(card);
                  const overdue = card.dueDate && !card.isCompleted && new Date(card.dueDate) < today;

                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, card, list.id)}
                      onDragEnd={handleCardDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, list.id, index)}
                      className={`bg-white rounded-lg shadow-sm border p-2.5 cursor-pointer card-hover ${
                        selectedCardIds.has(card.id) ? "ring-2 ring-primary border-primary/50" : "border-black/5"
                      } ${dragOverListId === list.id && dragOverCardIndex === index ? "ring-2 ring-primary/50" : ""} ${draggedCard?.card.id === card.id ? "opacity-40" : ""}`}
                      onClick={(e) => {
                        if (selectMode) {
                          e.stopPropagation();
                          toggleSelectCard(card.id);
                        } else {
                          setSelectedCardId(card.id);
                        }
                      }}
                    >
                      {/* Selection checkbox */}
                      {selectMode && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedCardIds.has(card.id) ? "bg-primary border-primary text-white" : "border-gray-300"
                          }`}>
                            {selectedCardIds.has(card.id) && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Cover */}
                      {card.coverColor && (
                        <div className="h-1.5 -mx-2.5 -mt-2.5 mb-2 rounded-t-lg" style={{ backgroundColor: card.coverColor }} />
                      )}

                      {/* Labels */}
                      {card.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {card.labels.map((cl) => (
                            <span key={cl.label.id} className="h-1.5 w-10 rounded-full" style={{ backgroundColor: cl.label.color }} />
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <p className="text-sm text-foreground leading-snug">{card.title}</p>

                      {/* Card footer */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Priority */}
                        {card.priority !== "NONE" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            card.priority === "URGENT" ? "bg-red-100 text-red-700" :
                            card.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                            card.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {card.priority}
                          </span>
                        )}

                        {/* Due date — stronger overdue indicator */}
                        {card.dueDate && (
                          <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            overdue
                              ? "bg-red-100 text-red-700 font-semibold"
                              : new Date(card.dueDate) < weekEnd
                              ? "bg-amber-50 text-amber-700"
                              : "text-muted-foreground"
                          }`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDateShort(card.dueDate, locale)}
                          </span>
                        )}

                        {/* Start date */}
                        {card.startDate && !card.dueDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {formatDateShort(card.startDate, locale)}
                          </span>
                        )}

                        {/* Checklist progress */}
                        {checklistInfo && (
                          <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            checklistInfo.done === checklistInfo.total ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground"
                          }`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            {checklistInfo.done}/{checklistInfo.total}
                          </span>
                        )}

                        {/* Indicators */}
                        <div className="flex items-center gap-2 ml-auto text-muted-foreground">
                          {card._count.comments > 0 && (
                            <span className="text-[10px] flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {card._count.comments}
                            </span>
                          )}
                          {card._count.attachments > 0 && (
                            <span className="text-[10px] flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {card._count.attachments}
                            </span>
                          )}
                        </div>

                        {/* Members */}
                        {card.members.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {card.members.slice(0, 3).map((cm) => (
                              <div
                                key={cm.user.id}
                                className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold border border-white"
                                title={cm.user.name}
                              >
                                {cm.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add card */}
              {addingCardToList === list.id ? (
                <div className="px-2 pb-2">
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateCard(list.id); }}>
                    <textarea
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Enter a title for this card..."
                      autoFocus
                      disabled={creatingCard}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreateCard(list.id); }
                        if (e.key === "Escape") { setAddingCardToList(null); setNewCardTitle(""); }
                      }}
                    />
                    <div className="flex gap-1 mt-1">
                      <button type="submit" disabled={!newCardTitle.trim() || creatingCard} className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-hover disabled:opacity-50">
                        {creatingCard ? t("common.loading") : t("action.addCard")}
                      </button>
                      <button type="button" onClick={() => { setAddingCardToList(null); setNewCardTitle(""); }} className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCardToList(list.id)}
                  className="w-full px-3 py-2 text-sm text-left text-muted-foreground hover:bg-black/5 rounded-b-xl flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t("action.addCard")}
                </button>
              )}
            </div>
          ))}

          {/* Add list */}
          <div className="w-72 flex-shrink-0">
            {showNewList ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3">
                <form onSubmit={handleCreateList}>
                  <input type="text" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder="Enter list title..." autoFocus className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-1 mt-2">
                    <button type="submit" disabled={!newListTitle.trim()} className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-hover disabled:opacity-50">Add list</button>
                    <button type="button" onClick={() => { setShowNewList(false); setNewListTitle(""); }} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <button onClick={() => setShowNewList(true)} className="w-full py-2.5 px-3 bg-white/30 hover:bg-white/40 text-white rounded-xl text-sm font-medium text-left flex items-center gap-1 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t("action.addList")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card detail modal */}
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          boardMembers={boardMembers}
          boardLabels={boardLabels}
          boardLists={lists.map((l) => ({ id: l.id, title: l.title }))}
          onClose={() => { setSelectedCardId(null); fetchBoard(); }}
          onCardUpdated={() => fetchBoard()}
        />
      )}

      {/* Background picker modal */}
      {showBackgroundPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBackgroundPicker(false)}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6 animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t("boards.background")}</h3>
            <div className="grid grid-cols-5 gap-2">
              {BACKGROUND_COLORS.map((bg) => (
                <button
                  key={bg.color}
                  onClick={() => handleBoardBackground(bg.color)}
                  className={`h-12 rounded-lg transition-all hover:scale-105 ${
                    board?.backgroundColor === bg.color ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: bg.color }}
                  title={bg.label}
                />
              ))}
            </div>
            <button
              onClick={() => setShowBackgroundPicker(false)}
              className="mt-4 w-full py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Archived items panel */}
      {showArchived && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50" onClick={() => setShowArchived(false)}>
          <div className="bg-white h-full w-96 shadow-2xl animate-slide-in overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("archived.title")}</h3>
              <button onClick={() => setShowArchived(false)} className="text-muted-foreground hover:text-foreground p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {loadingArchived ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !archivedData || (archivedData.lists.length === 0 && archivedData.cards.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("archived.noItems")}</p>
              ) : (
                <>
                  {archivedData.lists.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("archived.lists")}</h4>
                      <div className="space-y-2">
                        {archivedData.lists.map((list) => (
                          <div key={list.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{list.title}</p>
                              <p className="text-xs text-muted-foreground">{list.cardCount} {t("common.cards")}</p>
                            </div>
                            <button
                              onClick={() => handleRestoreList(list.id)}
                              className="px-3 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary-hover"
                            >
                              {t("common.restore")}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {archivedData.cards.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("archived.cards")}</h4>
                      <div className="space-y-2">
                        {archivedData.cards.map((card) => (
                          <div key={card.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{card.title}</p>
                              <p className="text-xs text-muted-foreground">in {card.listTitle}</p>
                            </div>
                            <button
                              onClick={() => handleRestoreCard(card.id)}
                              className="px-3 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary-hover flex-shrink-0 ml-2"
                            >
                              {t("common.restore")}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
