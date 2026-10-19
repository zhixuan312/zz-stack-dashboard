/**
 * The fake gateway's clock and calendar. Every timestamp is an offset from the moment the server started, so a page
 * reads "3 hours ago" whatever day verify runs on, fixed for the life of the process, so two requests for the same
 * record always agree. Every day, week, month, quarter and year is cut on midnight in the reporting timezone, the one
 * the console prints its dates in, as the gateway cuts its own in `ZZ_TZ` (`periodsOf` in console/work-figures.ts): a
 * week runs Monday 00:00 to Monday 00:00 there, and a record is counted in the period that holds its instant.
 */
const START = Date.now();

/** The reporting timezone, the console's own (`app.timezone` in src/app.config.ts, which tests/sweep-calendar.test.ts
 *  holds equal); named here because zz-stack's checks import the fake with plain `node`. */
export const TIMEZONE = 'Asia/Singapore';

/** An instant `hours` before the server started, as the gateway spells one (ISO 8601, UTC). */
export const ago = (hours: number) => new Date(START - hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Milliseconds since the epoch at the server's start, for bucketed series. */
export const now = () => START;

const DAY = 86_400_000;
export type Grain = 'day' | 'week' | 'month' | 'quarter' | 'year';

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
/** The wall clock an instant reads in the reporting timezone, written as if it were that time in UTC. */
function wall(ms: number): number {
  const p = Object.fromEntries(PARTS.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) + (((ms % 1000) + 1000) % 1000);
}
/** The instant a wall-clock reading in the reporting timezone names: its offset taken off, read again at the guess so a
 *  zone that changes its offset lands on the right side of the change. */
function instant(w: number): number {
  const guess = w - (wall(w) - w);
  return w - (wall(guess) - guess);
}

/** The calendar date an instant falls on in the reporting timezone (`YYYY-MM-DD`). */
export const localDay = (ms: number): string => new Date(wall(ms)).toISOString().slice(0, 10);

/** The instant a calendar date begins in the reporting timezone. */
export const midnight = (date: string): number => instant(Date.parse(`${date}T00:00:00Z`));

/** The weekday (Monday 0) and hour an instant falls on in the reporting timezone. */
export function weekdayHour(ms: number): [weekday: number, hour: number] {
  const w = new Date(wall(ms));
  return [(w.getUTCDay() + 6) % 7, w.getUTCHours()];
}

/** The start of the period at `grain` that holds `ms`: its first day's midnight, a week's being its Monday's. */
export function startOf(ms: number, grain: Grain): number {
  const w = new Date(wall(ms));
  const [y, m, d] = [w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()];
  const first = grain === 'day' ? Date.UTC(y, m, d) : grain === 'week' ? Date.UTC(y, m, d - ((w.getUTCDay() + 6) % 7))
    : grain === 'month' ? Date.UTC(y, m, 1) : grain === 'quarter' ? Date.UTC(y, Math.floor(m / 3) * 3, 1) : Date.UTC(y, 0, 1);
  return instant(first);
}

/** The start of the period at `grain` after the one that begins at `start`, `n` of them on (back with a negative `n`). */
export function nextStart(start: number, grain: Grain, n = 1): number {
  const w = new Date(wall(start));
  const [y, m, d] = [w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()];
  return instant(grain === 'day' ? Date.UTC(y, m, d + n) : grain === 'week' ? Date.UTC(y, m, d + 7 * n)
    : grain === 'month' ? Date.UTC(y, m + n, 1) : grain === 'quarter' ? Date.UTC(y, m + 3 * n, 1) : Date.UTC(y + n, 0, 1));
}

/** A calendar date `days` before the server started, in the reporting timezone (`YYYY-MM-DD`). */
export const day = (days: number) => localDay(START - days * DAY);
