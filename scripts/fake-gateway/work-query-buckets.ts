/**
 * The calendar both of the fake gateway's prepared queries read a window's dates and buckets on, `/work/query`'s and
 * `/platform/query`'s, as the gateway's two read one module: the reporting timezone's days (clock.ts), the one every
 * fixture beside this file is cut in.
 *
 * A date names the whole of that day, so a window of dates runs from the first date's midnight up to the midnight after
 * the last. A bucket is a run of days: a day keyed by its date, a week by its Monday's date, a month by its year and
 * month, and a weekday by its English name. A window's buckets are every one it touches before its end or the cutoff,
 * whichever is earlier, so an empty one is still answered; a weekday's are the ones the window holds, Monday to Sunday.
 *
 * COUPLED: the gateway's `services/gateway/src/console/work-query-buckets.ts`, whose keys, labels and buckets this
 * copies. zz-stack's checks import this file with plain `node` through the queries, so nothing here is imported through
 * the console's path alias.
 */
import { localDay } from './clock.ts';

export const BUCKETS = ['day', 'week', 'month', 'weekday'] as const;
export type Bucket = (typeof BUCKETS)[number];
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a text is a calendar date, `YYYY-MM-DD`, that the calendar has. */
export function isDate(text: string): boolean {
  if (!DATE.test(text)) return false;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text;
}

/** The date a number of days after another. */
export const addDays = (date: string, n: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** A date's weekday, Monday first. */
const weekdayOf = (date: string): string => WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

/** The key of the bucket a date falls in. */
function keyOfDate(bucket: Bucket, date: string): string {
  if (bucket === 'day') return date;
  if (bucket === 'month') return date.slice(0, 7);
  if (bucket === 'weekday') return weekdayOf(date);
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

/** The first of the month after a date's, written out rather than through `Date.UTC`, which reads a year below 100 as 1900 on. */
function nextMonth(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  return m === 12 ? `${String(y + 1).padStart(4, '0')}-01-01` : `${date.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`;
}

/** The key of the bucket an instant falls in. */
export const bucketOf = (bucket: Bucket, ms: number): string => keyOfDate(bucket, localDay(ms));

/** Every bucket from one instant up to another, oldest first; a weekday's Monday to Sunday, those the span holds. */
export function bucketsOf(bucket: Bucket, fromMs: number, endMs: number): string[] {
  if (endMs <= fromMs) return [];
  const first = localDay(fromMs), last = localDay(endMs - 1);
  if (bucket === 'weekday') {
    const held = new Set<string>();
    for (let d = first; d <= last && held.size < 7; d = addDays(d, 1)) held.add(weekdayOf(d));
    return WEEKDAYS.filter((w) => held.has(w));
  }
  const keys: string[] = [];
  let d = bucket === 'month' ? `${first.slice(0, 7)}-01` : keyOfDate(bucket, first);
  while (d <= last) {
    keys.push(keyOfDate(bucket, d));
    d = bucket === 'day' ? addDays(d, 1) : bucket === 'week' ? addDays(d, 7) : nextMonth(d);
  }
  return keys;
}

/** How a bucket is named. */
export function bucketLabel(bucket: Bucket, key: string): string {
  if (bucket === 'week') return `Week from ${key}`;
  if (bucket === 'month') return `Month ${key}`;
  return key;
}
