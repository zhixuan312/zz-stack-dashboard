import type { Column } from '@/components/patterns/data-table';

/**
 * The console's table rule, applied to Meridian's columns: the first column reads left, the last right, and every
 * column between is centred, header and cell alike. One rule for every table, so no page decides it again. A column
 * of running text says `align: 'left'` and keeps it: prose is never centred or pushed right.
 *
 * **The second half of the rule, and it is not about alignment.** `DataTable`'s `truncate` wraps the value in
 * Meridian's `Cut` and nothing else — no `title`, no way back — so a value that identifies a record and is cut has no tail anywhere on
 * the page. Since it was written down here rather than at the one site that needed it, it holds for every cell:
 *
 * - **An identifier never truncates silently.** A slug, a path, an id, a stable key, an address, a subject: the tail is
 *   usually the distinguishing part — `2026-09-22-payout-schedule` keeps its date at the front and its name at the end —
 *   so the cell sets `title` with the whole value, and where the column has room it wraps
 *   (`whitespace-normal [overflow-wrap:anywhere]`) instead of cutting. `initiative.tsx` did this first; the rule was
 *   written there and did not reach the team slug, the member's address, the bell's entry or the evaluator's stable
 *   key until it was moved here.
 * - **A description may truncate, and carries `title` too.** A refusal sentence, a plugin's blurb: shortening one is a
 *   layout decision, and the reader can still ask for the rest.
 */
export function aligned<R>(columns: Column<R>[]): Column<R>[] {
  return columns.map((c, i) => ({ ...c, align: c.align ?? (i === 0 ? 'left' : i === columns.length - 1 ? 'right' : 'center') }));
}
