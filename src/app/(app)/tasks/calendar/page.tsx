// @ts-nocheck
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFlowToast } from "@/components/flowboard/toast";
import { useLanguage } from "@/i18n/flowboard/context";
import {
  getJalaliMonthInfo,
  jalaliToGregorian,
  gregorianToJalali,
  getDaysInJalaliMonth,
  getFirstDayOfJalaliMonth,
  toPersianDigits,
  formatMonthYear,
  formatWeekday,
  formatCardDate,
} from "@/i18n/flowboard/dates";

interface Card {
  id: string;
  title: string;
  description?: string;
  listId: string;
  list: { id: string; title: string };
  board: { id: string; title: string };
  position: number;
  priority: string;
  dueDate?: string;
  startDate?: string;
  isCompleted: boolean;
  labels: { label: { id: string; name: string; color: string } }[];
  members: { user: { id: string; name: string; avatarUrl?: string } }[];
  _count: { comments: number; checklists: number; attachments: number };
}

interface WorkspaceData { cards: Card[]; }

const PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export default function CalendarPage() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const { t, locale } = useLanguage();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  // For English: use Gregorian year/month directly
  // For Persian: store Jalali year/month, convert to Gregorian for data lookup
  const [gregorianDate, setGregorianDate] = useState(new Date());
  const [jalaliYear, setJalaliYear] = useState(0);
  const [jalaliMonth, setJalaliMonth] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const sessionRes = await fetch("/api/flowboard/auth/session");
      if (!sessionRes.ok) { /* No redirect needed in Media Deck */; return; }
      const session = await sessionRes.json();
      const workspaceId = session.workspaces?.[0]?.id;
      if (!workspaceId) return;
      const res = await fetch(`/api/flowboard/workspaces/${workspaceId}/cards`);
      if (res.ok) { const data: WorkspaceData = await res.json(); setCards(data.cards); }
    } catch { toast("Failed to load calendar", "error"); }
    finally { setLoading(false); }
  }, [router, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialize Jalali state
  useEffect(() => {
    if (locale === "fa") {
      const jalali = gregorianToJalali(new Date());
      setJalaliYear(jalali.year);
      setJalaliMonth(jalali.month);
    }
  }, [locale]);

  // Get current display state based on locale
  const isJalali = locale === "fa";
  const displayYear = isJalali ? jalaliYear : gregorianDate.getFullYear();
  const displayMonth = isJalali ? jalaliMonth : gregorianDate.getMonth();

  // Get calendar grid based on locale
  const getCalendarGrid = () => {
    if (isJalali) {
      const days = getDaysInJalaliMonth(jalaliYear, jalaliMonth);
      const firstDay = getFirstDayOfJalaliMonth(jalaliYear, jalaliMonth);
      const grid: (number | null)[] = [];
      for (let i = 0; i < firstDay; i++) grid.push(null);
      for (let d = 1; d <= days; d++) grid.push(d);
      return grid;
    }
    // Gregorian
    const year = gregorianDate.getFullYear();
    const month = gregorianDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const grid: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    return grid;
  };

  // Convert calendar day to a date string for card matching
  const dayToDateKey = (day: number): string => {
    if (isJalali) {
      const gregorian = jalaliToGregorian(jalaliYear, jalaliMonth, day);
      return gregorian.toISOString().split("T")[0];
    }
    return `${gregorianDate.getFullYear()}-${String(gregorianDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Group cards by date
  const cardsByDate: Record<string, Card[]> = {};
  for (const card of cards) {
    if (card.dueDate) {
      const dateKey = new Date(card.dueDate).toISOString().split("T")[0];
      if (!cardsByDate[dateKey]) cardsByDate[dateKey] = [];
      cardsByDate[dateKey].push(card);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => {
    if (isJalali) {
      if (jalaliMonth === 0) { setJalaliMonth(11); setJalaliYear(jalaliYear - 1); }
      else setJalaliMonth(jalaliMonth - 1);
    } else {
      const d = new Date(gregorianDate);
      d.setMonth(d.getMonth() - 1);
      setGregorianDate(d);
    }
  };

  const nextMonth = () => {
    if (isJalali) {
      if (jalaliMonth === 11) { setJalaliMonth(0); setJalaliYear(jalaliYear + 1); }
      else setJalaliMonth(jalaliMonth + 1);
    } else {
      const d = new Date(gregorianDate);
      d.setMonth(d.getMonth() + 1);
      setGregorianDate(d);
    }
  };

  const goToday = () => {
    if (isJalali) {
      const jalali = gregorianToJalali(new Date());
      setJalaliYear(jalali.year);
      setJalaliMonth(jalali.month);
    } else {
      setGregorianDate(new Date());
    }
  };

  const weekdays = formatWeekday(true, locale);
  const calendarGrid = getCalendarGrid();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">{t("calendar.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <button onClick={() => router.push("/tasks/boards")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={locale === "fa" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
        <h1 className="font-semibold text-lg">{t("nav.calendar")}</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={locale === "fa" ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>
          <span className="font-semibold text-foreground min-w-[160px] text-center">
            {formatMonthYear(displayMonth, displayYear, locale)}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={locale === "fa" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
            </svg>
          </button>
          <button onClick={goToday} className="px-3 py-1 text-sm rounded-lg border border-border hover:bg-muted ml-2">
            {t("common.today")}
          </button>
        </div>
      </header>

      <div className="p-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-7 gap-px mb-px">
          {weekdays.map((day, idx) => (
            <div key={idx} className="text-xs font-semibold text-muted-foreground uppercase text-center py-2">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden">
          {calendarGrid.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="bg-card min-h-[100px]" />;

            const dateKey = dayToDateKey(day);
            const dayCards = cardsByDate[dateKey] || [];
            const isToday = dateKey === today;
            const isOverdue = new Date(dateKey) < new Date() && !isToday;

            return (
              <div key={dateKey} className={`bg-card min-h-[100px] p-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${isToday ? "ring-2 ring-primary/50" : ""}`} onClick={() => setSelectedDate(selectedDate === dateKey ? null : dateKey)}>
                <div className={`text-xs font-medium mb-1 px-1 ${isToday ? "text-primary font-bold" : isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {isJalali ? toPersianDigits(day) : day}
                </div>
                <div className="space-y-0.5">
                  {dayCards.slice(0, 3).map((card) => (
                    <div key={card.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${
                      card.isCompleted ? "bg-emerald-100 text-emerald-700 line-through" :
                      isOverdue ? "bg-red-100 text-red-700" :
                      "bg-primary/10 text-primary"
                    }`} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                      {card.title}
                    </div>
                  ))}
                  {dayCards.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">
                      +{dayCards.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-lg mx-4 mb-4 rounded-xl shadow-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{formatCardDate(selectedDate, locale)}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-muted-foreground hover:text-foreground p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {(cardsByDate[selectedDate] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("calendar.noCards")}</p>
              ) : (
                <div className="space-y-2">
                  {(cardsByDate[selectedDate] || []).map((card) => (
                    <button key={card.id} onClick={() => setSelectedCardId(card.id)} className="w-full text-left p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                      <p className="text-sm font-medium">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{card.board.title} › {card.list.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
