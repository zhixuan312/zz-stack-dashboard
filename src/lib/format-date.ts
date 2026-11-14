// Relative with its extension, and the collection seam imports this module under plain Node (a store fixture and the
// multi-process test) where the `@/` alias does not resolve.
import { app } from '../app.config.ts';
import { parseCalendarDate } from './calendar-date.ts';
/**
 * Every date this product displays goes through this module. Nothing calls
 * `toLocaleDateString` directly.
 *
 * The timezone is a cross-cutting invariant, not a display preference: the
 * reporting periods and the daily buckets are cut on the same boundary, so a
 * "day" in the chart and a "day" in the totals are the same day.
 *
 * The reporting timezone is `app.timezone` in src/app.config.ts, set once.
 * Whatever you pick, pick it deliberately: aggregate your buckets on the same
 * boundary server-side, or the chart and the totals will disagree by a day at
 * the edges and nothing in the UI will explain why.
 */
const DISPLAY_TIMEZONE = app.timezone;

type DateInput = Date | string | number;

function toDate(input: DateInput): Date | null {
  // A literal calendar day must exist: Date alone silently rolls February 30 into March.
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return parseCalendarDate(input);
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Built once: an Intl formatter costs far more to construct than to use, and a table formats a date per row. */
let FMT: Intl.DateTimeFormat | null = null;

function parts(d: Date): Record<string, string> {
  FMT ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(FMT.formatToParts(d).map((p) => [p.type, p.value]));
}

/** What a day formatter prints: a calendar date (`2026-10-01`) as the day it names, an instant as its day in DISPLAY_TIMEZONE. */
function dayParts(input: DateInput): Record<string, string> | null {
  const calendar = typeof input === 'string' ? calendarParts(input) : null;
  if (calendar) return calendar;
  const d = toDate(input);
  return d ? parts(d) : null;
}

/** One formatter per timezone, built once for the reason `FMT` is. */
const DAY_OF = new Map<string, Intl.DateTimeFormat>();

/**
 * The calendar day an instant falls on in the reporting timezone, `2026-06-09`: the day a daily row of it is kept under,
 * and the today a period of days ends before. Never `toISOString().slice(0, 10)`, which is the day in UTC. Empty for an
 * input that is not a date.
 */
export function dayOf(input: DateInput, timeZone: string = DISPLAY_TIMEZONE): string {
  const d = toDate(input);
  if (!d) return '';
  let fmt = DAY_OF.get(timeZone);
  if (!fmt) DAY_OF.set(timeZone, (fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })));
  return fmt.format(d);
}

/**
 * The calendar day a stored value names, `2026-06-30`. A bare `YYYY-MM-DD` is already a day and is kept as written, wherever
 * the product reports from; an instant is its day in the reporting timezone, through `dayOf`. Null for a value that is not
 * a date. Every cut of a stored date — an aggregate's window and bucket, a drill's address — uses this one rule, so a day
 * in a table, a day in a total and a day in an agent's window are the same day.
 */
export function dayOfValue(value: unknown, timeZone: string = DISPLAY_TIMEZONE): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseCalendarDate(value) ? value : null;
  const day = dayOf(value, timeZone);
  return day === '' ? null : day;
}

/** `09 Jun 2026` */
export function formatDate(input: DateInput): string {
  const p = dayParts(input);
  return p ? `${p.day.padStart(2, '0')} ${p.month} ${p.year}` : String(input);
}

/** `01 Oct`: a chart's axis or a badge, where the year is noise and the padded day keeps a column of cells aligned. A day
 * inside a sentence is `formatDay`. */
export function formatShortDate(input: DateInput): string {
  const p = dayParts(input);
  return p ? `${p.day.padStart(2, '0')} ${p.month}` : String(input);
}

/** `1 Oct`: a day inside a sentence, where a padded "01 Oct" reads like a table cell. Tables and axes keep formatDate. */
export function formatDay(input: DateInput): string {
  const p = dayParts(input);
  return p ? `${Number(p.day)} ${p.month}` : String(input);
}

/** `09 Jun 2026, 08:04` */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/**
 * A calendar date, `2026-10-01` with no time, names a day and not an instant: a cell of a calendar is that day
 * wherever the product reports from. Read as midnight UTC and printed in DISPLAY_TIMEZONE it would be the day before
 * west of UTC, so every day formatter here (`formatDate`, `formatShortDate`, `formatDay` and the two below) reads the
 * date's own year, month and day.
 */
let DAY_FMT: Intl.DateTimeFormat | null = null;

function calendarParts(date: string): Record<string, string> | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = toDate(date);
  if (!d) return null;
  DAY_FMT ??= new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  return Object.fromEntries(DAY_FMT.formatToParts(d).map((p) => [p.type, p.value]));
}

/** The calendar day `n` days after `date` (before it when negative), both YYYY-MM-DD: whole days, whatever the timezone. */
export function shiftDay(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** `Thu 1 Oct 2026`: a calendar date as the day it names, with its weekday. */
export function formatCalendarDate(date: string): string {
  const p = calendarParts(date);
  return p ? `${p.weekday} ${p.day} ${p.month} ${p.year}` : date;
}

/** `Oct`: the month a calendar date is in, for the name above a calendar's column. */
export function formatCalendarMonth(date: string): string {
  return calendarParts(date)?.month ?? date;
}

/** `just now` · `5 min ago` · `3 h ago` · `7 d ago` · then an absolute date. */
export function formatRelative(input: DateInput, now: Date): string {
  const d = toDate(input);
  if (!d) return String(input);
  const deltaMs = now.getTime() - d.getTime();
  if (deltaMs < 60_000) return 'just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} d ago`;
  return formatDate(d);
}
