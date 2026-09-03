import type { Locale } from "./translations";

// Persian month names
const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

// English month names
const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Persian month short names
const PERSIAN_MONTHS_SHORT = [
  "فرو", "اردی", "خرد", "تیر", "مرد", "شهر",
  "مهر", "آبا", "آذر", "دی", "بهم", "اسف",
];

// Persian digits mapping
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

// Simple Jalali conversion functions (no external dependency needed)
function gregorianToJalaliInternal(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gy;
  if (gm > 2) gy2 += 1;
  let days = 355666 + (365 * gy2) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm: jm - 1, jd };
}

function jalaliToGregorianInternal(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  jm += 1;
  const jy1 = jy - 979;
  const jm1 = jm - 1;
  const jd1 = jd - 1;
  const days = 365 * jy1 + Math.floor(jy1 / 33) * 8 + Math.floor(((jy1 % 33) + 3) / 4) + 78 + jd1 + (jm1 < 7 ? (jm1) * 31 : ((jm1 - 7) * 30 + 186));
  let gy = 1600 + 4 * Math.floor(days / 1461);
  let remainingDays = days % 1461;
  if (remainingDays >= 366) {
    gy += Math.floor((remainingDays - 1) / 365);
    remainingDays = (remainingDays - 1) % 365;
  }
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gm = 1;
  while (gm < 13 && remainingDays >= g_d_m[gm]) gm++;
  const gd = remainingDays - g_d_m[gm - 1] + 1;
  return { gy, gm: gm - 1, gd };
}

// Simple Jalali month lengths
function jalaliDaysInMonth(jy: number, jm: number): number {
  if (jm < 6) return 31;
  if (jm < 11) return 30;
  // Esfand: 29 in normal years, 30 in leap years
  const leap = ((jy + 2346) % 2820) * 8 + 4;
  return leap < 2820 ? 29 : 30;
}

function jalaliFirstDayOfWeek(jy: number, jm: number): number {
  const g = jalaliToGregorianInternal(jy, jm, 1);
  return new Date(g.gy, g.gm, g.gd).getDay();
}

export function formatDate(dateStr: string | Date, locale: Locale): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  if (locale === "fa") {
    const j = gregorianToJalaliInternal(date.getFullYear(), date.getMonth(), date.getDate());
    return `${j.jd} ${PERSIAN_MONTHS[j.jm]} ${toPersianDigits(j.jy)}`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(dateStr: string | Date, locale: Locale): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  if (locale === "fa") {
    const j = gregorianToJalaliInternal(date.getFullYear(), date.getMonth(), date.getDate());
    return `${toPersianDigits(j.jd)} ${PERSIAN_MONTHS_SHORT[j.jm]} ${toPersianDigits(j.jy)}`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(dateStr: string | Date, locale: Locale): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const time = date.toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (locale === "fa") {
    const j = gregorianToJalaliInternal(date.getFullYear(), date.getMonth(), date.getDate());
    return `${toPersianDigits(j.jd)} ${PERSIAN_MONTHS[j.jm]} ${toPersianDigits(j.jy)}، ${time}`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + time;
}

export function formatRelativeDate(dateStr: string | Date, locale: Locale): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (locale === "fa") {
    if (diffDays === 0) return "امروز";
    if (diffDays === 1) return "فردا";
    if (diffDays === -1) return "دیروز";
    if (diffDays > 1) return `${toPersianDigits(diffDays)} روز دیگر`;
    if (diffDays < -1) return `${toPersianDigits(Math.abs(diffDays))} روز پیش`;
    return "";
  }

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `in ${diffDays} days`;
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  return "";
}

export function formatMonthYear(month: number, year: number, locale: Locale): string {
  if (locale === "fa") {
    const g = new Date(year, month, 15);
    const j = gregorianToJalaliInternal(g.getFullYear(), g.getMonth(), g.getDate());
    return `${PERSIAN_MONTHS[j.jm]} ${toPersianDigits(j.jy)}`;
  }
  return `${ENGLISH_MONTHS[month]} ${year}`;
}

export function formatWeekday(short: boolean, locale: Locale): string[] {
  const enWeekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const enWeekdaysFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const faWeekdaysShort = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
  const faWeekdaysFull = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

  if (locale === "fa") {
    return short ? faWeekdaysShort : faWeekdaysFull;
  }
  return short ? enWeekdaysShort : enWeekdaysFull;
}

export function getJalaliMonthInfo(gregorianYear: number, gregorianMonth: number) {
  const date = new Date(gregorianYear, gregorianMonth, 1);
  const j = gregorianToJalaliInternal(date.getFullYear(), date.getMonth(), date.getDate());
  const daysInMonth = jalaliDaysInMonth(j.jy, j.jm);
  const firstDayOfWeek = jalaliFirstDayOfWeek(j.jy, j.jm);
  return { jYear: j.jy, jMonth: j.jm, daysInMonth, firstDayOfWeek };
}

export function jalaliToGregorian(jYear: number, jMonth: number, jDay: number): Date {
  const g = jalaliToGregorianInternal(jYear, jMonth, jDay);
  return new Date(g.gy, g.gm, g.gd);
}

export function gregorianToJalali(date: Date): { year: number; month: number; day: number } {
  const j = gregorianToJalaliInternal(date.getFullYear(), date.getMonth(), date.getDate());
  return { year: j.jy, month: j.jm, day: j.jd };
}

export function getJalaliMonthNames(): string[] {
  return [...PERSIAN_MONTHS];
}

export function getJalaliMonthShortNames(): string[] {
  return [...PERSIAN_MONTHS_SHORT];
}

export function getDaysInJalaliMonth(year: number, month: number): number {
  return jalaliDaysInMonth(year, month);
}

export function getFirstDayOfJalaliMonth(year: number, month: number): number {
  return jalaliFirstDayOfWeek(year, month);
}

export function toInputDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

export function fromInputDate(inputDate: string): Date | null {
  if (!inputDate) return null;
  return new Date(inputDate + "T00:00:00");
}

export function formatCardDate(dateStr: string | Date | undefined, locale: Locale): string {
  if (!dateStr) return "";
  return formatDate(dateStr, locale);
}
