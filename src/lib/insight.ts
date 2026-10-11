/**
 * What a person cannot see at a glance, worked out by code so every reader gets the same figure: the person, the MCP
 * view's model and the console's assistant (decision 0011). Pure functions over plain numbers; no formatting, no dates
 * beyond the YYYY-MM-DD strings a daily series carries. The model interprets these; it never recomputes them.
 */

/** The middle value; `NaN` for none. */
export function median(values: number[]): number {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** The median absolute deviation: the spread a few wild days cannot inflate, unlike the standard deviation. */
function mad(values: number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** A day far from its steady state: its value, the steady state, the ratio and the robust z-score. */
type Deviation = { index: number; value: number; baseline: number; ratio: number; z: number };

/**
 * The days whose value sits at least `z` robust deviations from the median of `values` (1.4826 × MAD makes it comparable
 * to a standard deviation on normal data). Days with no spread to measure against are never flagged, so a flat series
 * raises nothing. `direction` keeps only rises or only falls.
 */
export function deviations(values: number[], { z = 3.5, direction = 'both' as 'up' | 'down' | 'both' } = {}): Deviation[] {
  const base = median(values);
  const spread = 1.4826 * mad(values);
  if (!Number.isFinite(base) || !(spread > 0)) return [];
  return values.flatMap((value, index) => {
    const score = (value - base) / spread;
    const kept = Math.abs(score) >= z && (direction === 'both' || (direction === 'up' ? score > 0 : score < 0));
    return kept ? [{ index, value, baseline: base, ratio: base ? value / base : NaN, z: score }] : [];
  });
}

/** Consecutive indices grouped into runs: [3, 4, 9] → [[3, 4], [9]]. */
export function runs(indices: number[]): number[][] {
  const out: number[][] = [];
  for (const i of [...indices].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && i === last.at(-1)! + 1) last.push(i);
    else out.push([i]);
  }
  return out;
}

/** Day of the week for a YYYY-MM-DD date, 0 for Sunday, read in UTC so the date string is the day it names. */
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * The weekly shape of a daily series: the median of weekends against the median of weekdays. `null` when the series is
 * shorter than two weeks, too short to tell a week from noise.
 */
export function weekendRatio(values: number[], dates: string[]): number | null {
  if (values.length < 14) return null;
  const end = values.filter((_, i) => [0, 6].includes(weekday(dates[i])));
  const work = values.filter((_, i) => ![0, 6].includes(weekday(dates[i])));
  const a = median(end), b = median(work);
  return a > 0 && b > 0 ? a / b : null;
}

/** The steady state of day `index` in a series that follows the week: the median of the other days on the same weekday. */
export function sameWeekdayBaseline(values: number[], dates: string[], index: number): number {
  const day = weekday(dates[index]);
  return median(values.filter((_, i) => i !== index && weekday(dates[i]) === day));
}

/** The part that contributes most to a total, and its share of it. `null` for an empty or zero total. */
export function largest<T>(items: T[], value: (t: T) => number): { item: T; share: number } | null {
  const total = items.reduce((s, t) => s + value(t), 0);
  if (!items.length || !(total > 0)) return null;
  const item = items.reduce((m, t) => (value(t) > value(m) ? t : m));
  return { item, share: value(item) / total };
}

/** Fewer than this many observations make a percentage or a percentile a guess, and the context says so. */
export const SMALL_SAMPLE = 30;
