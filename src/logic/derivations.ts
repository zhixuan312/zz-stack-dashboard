/**
 * The figures a card draws, worked out once, here, from the values the card was given. A derivation takes values and
 * never a card's props: the trend's is a bands-by-days matrix of numbers, the composition's the parts' `value` alone.
 * A figure defined once is the same figure on every surface, and a card keeps its own props and calls the function with
 * the numbers it holds.
 *
 * Only the figures defined here are exported. `summarise`, `afterStart` and `runOf` keep their own modules and their own
 * importers: re-exporting them from this file would put them in the chunk of every card that needs one figure from here,
 * which is weight no card asked for.
 */

/**
 * The comparison a metric tile states as "2.7× usual": the reading over the baseline it is measured against, to one
 * decimal. Nothing when there is no baseline to compare with, and the tile then says nothing.
 */
export function comparison(reading: number, baseline: number): string | null {
  return baseline ? (reading / baseline).toFixed(1) : null;
}

/**
 * A stacked trend's per-day totals: `bands` is one row a series and one number a day, oldest first, so a day's total is
 * the sum down its column. A missing value is no contribution that day, and a day on which no band has a value has no
 * total (`null`): nothing was measured, which is not a total of zero.
 */
export function trendTotals(bands: readonly (readonly (number | null)[])[]): (number | null)[] {
  const days = Math.max(0, ...bands.map((band) => band.length));
  const totals: (number | null)[] = Array.from({ length: days }, () => null);
  for (const band of bands) band.forEach((value, i) => { if (value !== null && value !== undefined) totals[i] = (totals[i] ?? 0) + value; });
  return totals;
}

/**
 * How long an incident lasted: the milliseconds from its start to an instant, its resolution for the whole incident.
 * An instant before the start is negative, which is the truth of the record rather than a duration to hide.
 */
export function elapsed(started: string, at: string): number {
  return new Date(at).getTime() - new Date(started).getTime();
}

/** The most parts a stack draws apart: past it, the last drawn is "Other", the rest summed. */
export const MOST_PARTS = 4;

/**
 * A stacked column's parts past the ones a reader can tell apart. `parts` is one row a part and one value a column, the
 * first column at index 0, and `values` is at most `most` rows: the first `most - 1` as they are, then one row that sums
 * the rest, `null` in a column where every one of them had no data. `kept` and `folded` say how many parts were drawn
 * as themselves, so the caller labels the folded row.
 */
export function columnFold(
  parts: readonly (readonly (number | null)[])[],
  most = MOST_PARTS,
): { values: (number | null)[][]; kept: number; folded: boolean } {
  const folded = parts.length > most;
  const kept = folded ? most - 1 : parts.length;
  const columns = Math.max(0, ...parts.map((part) => part.length));
  const row = (part: readonly (number | null)[]) => Array.from({ length: columns }, (_, c) => part[c] ?? null);
  const rows = parts.slice(0, kept).map(row);
  if (!folded) return { values: rows, kept, folded };
  const rest = parts.slice(kept);
  rows.push(Array.from({ length: columns }, (_, c) => {
    const values = rest.map((part) => part[c] ?? null);
    return values.every((value) => value === null) ? null : values.reduce<number>((a, b) => a + (b ?? 0), 0);
  }));
  return { values: rows, kept, folded };
}

/**
 * A composition bar's own denominator: every part's `value` above zero, and never zero, so an empty bar still divides by
 * one and draws nothing rather than a part of no whole. A part below zero is no share of a whole and adds nothing, so
 * signed parts never turn the shares of the rest negative.
 */
export function compositionTotal(parts: readonly { value: number }[]): number {
  return parts.reduce((total, part) => total + Math.max(0, part.value), 0) || 1;
}
