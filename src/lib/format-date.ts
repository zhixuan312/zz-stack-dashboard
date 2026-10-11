import { app } from '../app.config';
/**
 * Every date this product displays goes through this module. Nothing calls
 * `toLocaleDateString` directly.
 *
 * The timezone is a cross-cutting invariant, not a display preference: the
 * reporting periods and the daily buckets are cut on the same boundary, so a
 * "day" in the chart and a "day" in the totals are the same day.
 *
 * TEMPLATE KNOB — set this to your product's reporting timezone once, here.
 * Whatever you pick, pick it deliberately: aggregate your buckets on the same
 * boundary server-side, or the chart and the totals will disagree by a day at
 * the edges and nothing in the UI will explain why.
 */
const DISPLAY_TIMEZONE = app.timezone;

type DateInput = Date | string | number;

function toDate(input: DateInput): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
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

/** `09 Jun 2026` */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}`;
}

/** `1 Oct`: a day inside a sentence, where a padded "01 Oct" reads like a table cell. Tables and axes keep formatDate. */
export function formatDay(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${Number(p.day)} ${p.month}`;
}

/** `09 Jun 2026, 08:04` */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
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
