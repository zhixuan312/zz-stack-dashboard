/**
 * How a Platform context names the rows of its page: each name or title whole, never cut mid-word, as many as its budget
 * holds, and the rest counted. A cut name reads as a different name, and a title cut mid-word reads as a slip, so a long
 * one costs the roster a row rather than its last letters.
 */
import type { SharedContext } from '@/lib/shared-context';
import { budgeted } from './context';

/**
 * The context `build(n)` makes, naming at most `n` rows in the line `roster(n)` writes, with the most rows, up to `max`,
 * that keep that line inside the budget. `budgeted` drops what comes after it first, as it always does; a roster that
 * does not fit with one row is dropped whole, and the budget's own line says the page has more.
 */
export function rostered(build: (n: number) => SharedContext, roster: (n: number) => string, max: number): SharedContext {
  for (let n = max; n > 1; n--) {
    const told = budgeted(build(n));
    if (told.insights.some((i) => i.text.includes(roster(n)))) return told;
  }
  return budgeted(build(1));
}
