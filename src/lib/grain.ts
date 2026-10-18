/**
 * The grain a series of periods arrives in, the one rule every page and every context that names one reads. The
 * gateway's `grainFor` (services/gateway/src/console/work-figures.ts) cuts a window by week up to 26 of them, by month
 * up to three years and by quarter beyond, and every period it answers runs from its start to its end whatever part
 * of it was observed, so the first one says which.
 */
import type { Window } from './platform-shapes';

export type Grain = 'week' | 'month' | 'quarter';

const DAY = 86_400_000;

/** A week is seven days, an hour either way at a clock change; a month at most 31; a quarter at least 89. A series with
 *  no period yet is named by the shortest grain. */
export function grainOf(windows: readonly Pick<Window, 'from' | 'to'>[]): Grain {
  if (!windows.length) return 'week';
  const days = (Date.parse(windows[0].to) - Date.parse(windows[0].from)) / DAY;
  return days <= 8 ? 'week' : days <= 32 ? 'month' : 'quarter';
}
