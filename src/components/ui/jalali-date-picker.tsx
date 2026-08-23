'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
  'مرداد', 'شهریور', 'مهر', 'آبان',
  'آذر', 'دی', 'بهمن', 'اسفند',
];

const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const TODAY_JALALI = (() => {
  const now = new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a Shamsi date string like '1405-06-01' into {jy, jm, jd} */
function parseShamsiDate(str: string | null | undefined): { jy: number; jm: number; jd: number } | null {
  if (!str) return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

/** Format as '1405-06-01' */
function formatShamsiDate(jy: number, jm: number, jd: number): string {
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

/** Generate calendar grid for a given Jalali month */
function getMonthGrid(jy: number, jm: number): (number | null)[][] {
  const daysInMonth = jalaaliMonthLength(jy, jm);
  // Convert first day of month to Gregorian to get weekday
  const g = toGregorian(jy, jm, 1);
  const firstDayOfWeek = new Date(g.gy, g.gm - 1, g.gd).getDay(); // 0=Sun
  // Convert to Saturday-start week (Iranian): Sat=0, Sun=1, ... Fri=6
  const startOffset = (firstDayOfWeek + 1) % 7;

  const grid: (number | null)[][] = [];
  let week: (number | null)[] = new Array(startOffset).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    grid.push(week);
  }

  return grid;
}

// ─── Component Props ─────────────────────────────────────────────────────────

interface JalaliDatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  className?: string;
  dir?: 'rtl' | 'ltr';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ',
  className,
  dir = 'rtl',
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = parseShamsiDate(value);
  const [viewYear, setViewYear] = useState(parsed?.jy ?? TODAY_JALALI.jy);
  const [viewMonth, setViewMonth] = useState(parsed?.jm ?? TODAY_JALALI.jm);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const grid = getMonthGrid(viewYear, viewMonth);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 1) {
      setViewMonth(12);        setViewYear((y: number) => y - 1);
    } else {        setViewMonth((m: number) => m - 1);
    }
  }, [viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 12) {
      setViewMonth(1);        setViewYear((y: number) => y + 1);
    } else {        setViewMonth((m: number) => m + 1);
    }
  }, [viewMonth]);

  const goToToday = useCallback(() => {
    setViewYear(TODAY_JALALI.jy);
    setViewMonth(TODAY_JALALI.jm);
  }, []);

  const selectDate = useCallback(
    (day: number) => {
      const dateStr = formatShamsiDate(viewYear, viewMonth, day);
      onChange(dateStr);
      setOpen(false);
    },
    [viewYear, viewMonth, onChange],
  );

  const clearDate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange],
  );

  const displayValue = parsed
    ? `${parsed.jd} ${JALALI_MONTHS[parsed.jm - 1]} ${parsed.jy}`
    : '';

  return (
    <div ref={ref} className={cn('relative', className)} dir={dir}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (parsed) {
            setViewYear(parsed.jy);
            setViewMonth(parsed.jm);
          }
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none',
          'focus:border-primary/50 transition-colors',
          !displayValue && 'text-muted-foreground',
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        <span className="flex-1 text-left font-mono" dir="ltr">
          {displayValue || placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={clearDate}
            className="rounded p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </button>

      {/* Calendar Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-72 rounded-xl border border-border bg-surface shadow-xl p-3',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {/* Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-primary hover:underline"
              >
                امروز
              </button>
              <span className="text-sm font-medium select-none">
                {JALALI_MONTHS[viewMonth - 1]} {viewYear}
              </span>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {JALALI_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-0">
            {grid.map((week, wi) =>
              week.map((day, di) => {
                if (day === null) {
                  return <div key={`${wi}-${di}`} className="h-9" />;
                }

                const isSelected =
                  parsed?.jy === viewYear &&
                  parsed?.jm === viewMonth &&
                  parsed?.jd === day;

                const isToday =
                  TODAY_JALALI.jy === viewYear &&
                  TODAY_JALALI.jm === viewMonth &&
                  TODAY_JALALI.jd === day;

                return (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    onClick={() => selectDate(day)}
                    className={cn(
                      'h-9 w-full rounded-md text-sm font-mono transition-colors',
                      'hover:bg-primary/10 focus:bg-primary/10 outline-none',
                      isSelected &&
                        'bg-primary text-primary-foreground hover:bg-primary',
                      isToday &&
                        !isSelected &&
                        'font-bold text-primary ring-1 ring-primary/30',
                    )}
                  >
                    {day}
                  </button>
                );
              }),
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-2 flex gap-1 border-t border-border pt-2">
            <QuickPickButton
              label="فردا"
              onClick={() => {
                let dy = TODAY_JALALI.jd + 1;
                let dm = TODAY_JALALI.jm;
                let dyr = TODAY_JALALI.jy;
                if (dy > jalaaliMonthLength(dyr, dm)) {
                  dy = 1;
                  dm = dm === 12 ? 1 : dm + 1;
                  if (dm === 1) dyr += 1;
                }
                onChange(formatShamsiDate(dyr, dm, dy));
                setOpen(false);
              }}
            />
            <QuickPickButton
              label="هفته دیگر"
              onClick={() => {
                let dy = TODAY_JALALI.jd + 7;
                let dm = TODAY_JALALI.jm;
                let dyr = TODAY_JALALI.jy;
                const maxDays = jalaaliMonthLength(dyr, dm);
                while (dy > maxDays) {
                  dy -= maxDays;
                  dm = dm === 12 ? 1 : dm + 1;
                  if (dm === 1) dyr += 1;
                }
                onChange(formatShamsiDate(dyr, dm, dy));
                setOpen(false);
              }}
            />
            <QuickPickButton
              label="ماه دیگر"
              onClick={() => {
                let dm = TODAY_JALALI.jm + 1;
                let dyr = TODAY_JALALI.jy;
                let dy = TODAY_JALALI.jd;
                if (dm > 12) {
                  dm = 1;
                  dyr += 1;
                }
                const maxDays = jalaaliMonthLength(dyr, dm);
                if (dy > maxDays) dy = maxDays;
                onChange(formatShamsiDate(dyr, dm, dy));
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Pick Button ───────────────────────────────────────────────────────

function QuickPickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
    >
      {label}
    </button>
  );
}
