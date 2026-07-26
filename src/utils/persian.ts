import { toJalaali } from 'jalaali-js';
import {
  PERSIAN_DIGITS,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS,
} from '@/constants/ui.constants';

/** Convert Latin/Arabic digits in a string to Persian digits. */
export function toPersianDigits(value: string | number): string {
  const normalized = String(value).replace(/[٠-٩]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0x6c0 + 0x0030),
  );
  return normalized.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits in a string to Latin digits. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x6c0));
}

/** Format a number with grouping separators and Persian digits. */
export function formatNumber(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
  monthName: string;
}

/** Convert a Gregorian Date to Jalali (Persian) date parts. */
export function toJalali(date: Date): JalaliDateParts {
  const { jy, jm, jd } = toJalaali(date);
  return {
    year: jy,
    month: jm,
    day: jd,
    monthName: PERSIAN_MONTHS[jm - 1],
  };
}

/** Format a Date as a Persian (Jalali) date string with Persian digits. */
export function formatJalaliDate(
  date: Date,
  options: { withWeekday?: boolean } = {},
): string {
  const parts = toJalali(date);
  const day = toPersianDigits(parts.day);
  const month = parts.monthName;
  const year = toPersianDigits(parts.year);
  const base = `${day} ${month} ${year}`;
  if (!options.withWeekday) return base;
  const weekday = PERSIAN_WEEKDAYS[date.getDay() === 6 ? 0 : date.getDay() + 1];
  return `${weekday}، ${base}`;
}

/** Format a Date as a Persian time string (HH:MM) with Persian digits. */
export function formatPersianTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${hh}:${mm}`);
}

/** Relative time in Persian (e.g. "۳ دقیقه پیش"). */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'لحظاتی پیش';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  return formatJalaliDate(date);
}
