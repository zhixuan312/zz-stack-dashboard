/**
 * A weekly figure against the week before, as Usage and Knowledge health both say it: the week the cards are about, the
 * change, and a share's change in points. One copy for both pages, because two drifted: Usage's change ignored a week
 * under its sample, which Knowledge health's refused (review round 2, R2-C54).
 */
import type { PeriodFigure, Window } from '@/lib/platform-shapes';

/** The last whole week a series holds, by its index: the week the cards are about; -1 when none is whole. */
export function lastWhole<T extends { window: Window }>(weeks: T[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].window.complete) return i;
  return -1;
}

type Pair = { last: PeriodFigure; previous: PeriodFigure };

/** A week's change on the week before, as a fraction, or null when either has no figure that stands beside the other:
 *  no value, a value of nothing to divide by, or a value the gateway marks (too few to judge, among them). */
export function changeOf({ last, previous }: Pair): number | null {
  const [a, b] = [last.figure, previous.figure];
  return a.value === null || b.value === null || b.value === 0 || a.why || b.why ? null : (a.value - b.value) / b.value;
}

/** A share's change on the week before in points, the difference of the two shares, as Status gives one; null where
 *  `changeOf` is. A share's change is never a percentage of itself, which a reader takes for points. */
export function pointsOf({ last, previous }: Pair): number | null {
  const [a, b] = [last.figure, previous.figure];
  return a.value === null || b.value === null || a.why || b.why ? null : a.value - b.value;
}

const ONE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
/** A change in points, its direction left to the arrow or the word before it: `5.0 pts`. */
export const pointsIn = (n: number): string => `${ONE.format(Math.abs(n))} pts`;
