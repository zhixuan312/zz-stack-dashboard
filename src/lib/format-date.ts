/**
 * Every date this product displays goes through this module. Nothing calls
 * `toLocaleDateString` directly.
 *
 * COUPLED: `DISPLAY_TIMEZONE` is the reporting timezone, and the server-side
 * buckets must be aggregated on the same boundary. Otherwise a "day" in the
 * chart and a "day" in the totals differ by one at the edges, and nothing in
 * the UI explains why.
 */
export const DISPLAY_TIMEZONE = 'Asia/Singapore';

type DateInput = Date | string | number;

function toDate(input: DateInput): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parts(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

/** `09 Jun 2026` */
function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}`;
}

/** `09 Jun 2026, 08:04` */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** `08:04:31` */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return String(input);
  const p = parts(d);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/** `just now` · `5 min ago` · `3 h ago` · `7 d ago` · then an absolute date. */
export function formatRelative(input: DateInput, now: Date = new Date()): string {
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
