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

/** Day of the week for a YYYY-MM-DD date, 0 for Sunday, read in UTC so the date string is the day it names. */
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** The steady state of day `index` in a series that follows the week: the median of the other days on the same weekday. */
export function sameWeekdayBaseline(values: number[], dates: string[], index: number): number {
  const day = weekday(dates[index]);
  return median(values.filter((_, i) => i !== index && weekday(dates[i]) === day));
}

/** Fewer than this many observations make a percentage or a percentile a guess, and the context says so. */
export const SMALL_SAMPLE = 30;
