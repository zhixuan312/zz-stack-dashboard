import Link from 'next/link';
import { cn } from '../../../lib/cn';
import { FORMATTERS, plural } from '../../../lib/format';
import { heldTicks, niceTicks } from '../scale';
import { Levels } from './levels';

export type BarItem = {
  key: string;
  label: React.ReactNode;
  value: number;
  meta?: React.ReactNode;
  href?: string;
  /** The figure the value is read against under `pair`: last week's, the target. `null` is one with no data. */
  compare?: number | null;
  /** The value is projected or partial, not measured: its bar is hatched and its row says so. */
  estimate?: boolean;
};

/**
 * A ranked list with a bar for each row: "by endpoint", "by customer". The bars are the neutral population and one
 * row, the one the card is about, takes the accent. Past `limit` rows, the rest fold into one "Others" row.
 *
 * A row with an `href` names a record that has a page, and its label is the one link to it: the bar and the figure
 * repeat what the label already opens, so they are not a second way there, and the folded row opens nothing.
 */
export function BarList({
  items,
  format = FORMATTERS.count,
  highlight,
  highlightLabel,
  limit = 6,
  total,
  max,
  order = 'value',
  axis = false,
  pair,
  label,
  className,
}: {
  items: BarItem[];
  format?: (n: number) => string;
  /** The key of the one row worth pointing at. Omit it and every bar is neutral. */
  highlight?: string;
  /** What makes that row the one worth pointing at, in a word: "The busiest hour". Said on its row, so the accent is
   *  not a colour a reader has to guess (issue #94). */
  highlightLabel?: string;
  limit?: number;
  /** `given` keeps the rows in the order passed, for an order that is the meaning (hours, stages): nothing folds. */
  order?: 'value' | 'given';
  /** Draws levels under the rows and a gridline through them at each. */
  axis?: boolean;
  /** Reads each row's `compare` beside its value, as an outline on the same scale, under a legend of the two. */
  pair?: { label: string; compareLabel: string };
  label: string;
  className?: string;
} & (
  | {
      /** The whole the rows are a share of: each bar's length is its value over this, and its share shows on hover. Left
       * out, bars are drawn against the largest row. */
      total?: number;
      max?: undefined;
    }
  /** A held scale: every bar is drawn against `max` (a capacity, 100%), so lists compare card to card. A row past it
   *  widens the scale to itself, and the list says so. No share is printed. */
  | { max: number; total?: undefined }
)) {
  const held = max !== undefined;
  // A held top not above zero is no scale to draw against, so the bars are drawn against one.
  const cap = held ? (max > 0 ? max : 1) : 0;
  const sorted = order === 'given' ? items : [...items].sort((a, b) => b.value - a.value);
  // One row past the limit is shown as itself: "1 other" hides a name to save no space. The fold sums the rows above
  // zero: a row below zero measures nothing, and summed signed it would cancel another's length. A held scale, a pair and an
  // order that is the meaning show every row: a fold would sum what they are read one by one for.
  const cut = order === 'given' || held || pair ? sorted.length : sorted.length === limit + 1 ? limit + 1 : limit;
  const shown = sorted.slice(0, cut);
  const rest = sorted.slice(cut);
  if (rest.length) shown.push({ key: '__others', label: `${rest.length} ${plural(rest.length, 'other')}`, value: rest.reduce((a, b) => a + Math.max(0, b.value), 0), estimate: rest.some((r) => r.estimate) });
  const data = shown.flatMap((i) => (pair && i.compare != null ? [i.value, i.compare] : [i.value]));
  const ticks = !axis ? null : held ? heldTicks(0, cap) : niceTicks(Math.max(total ?? 0, ...data));
  // Against the largest row, whatever its size: a floor of 1 drew shares and rates as stubs. The smallest positive number
  // only keeps an all-zero list from dividing by zero.
  const top = held ? Math.max(cap, ...data) : ticks ? ticks.at(-1)! : Math.max(Number.MIN_VALUE, total ?? 0, ...data);
  // A held scale keeps its levels and adds the widened top as one more, so the levels still read as the held ones.
  const levels = ticks && top > ticks.at(-1)! ? [...ticks, top] : ticks;
  // The first row in drawing order that stands at the widened top is named, so the reader knows which row moved it.
  const past = held && top > cap ? shown.find((i) => i.value === top || (pair && i.compare === top)) : undefined;
  const named = (it: BarItem) => (typeof it.label === 'string' || typeof it.label === 'number' ? String(it.label) : null);
  const estimated = shown.some((i) => i.estimate);
  // Once the list draws anything beside its rows, its root is a frame around them that takes `className`.
  const framed = !!(levels || past || estimated || pair);
  const list = (
    <ul aria-label={label} className={cn('flex flex-col gap-3.5', !framed && className)}>
      {shown.map((it, n) => {
        const hot = it.key === highlight;
        // The row says what it is as well as its share (issue #94): "42.1% of 1,204" on its own never named the row, and
        // a list with no total had no title at all. The label is the row's own word, so it is used when it is text.
        const share = total ? `${((Math.max(0, it.value) / total) * 100).toFixed(1)}% of ${format(total)}` : null;
        return (
          <li key={it.key} data-row={it.key} className="group/bar" title={[named(it), format(it.value), share, it.estimate ? 'estimate' : null, hot ? highlightLabel : null].filter(Boolean).join(' · ')}>
            {/* Positioned, the words and the bar paint over the axis's gridlines, which are positioned before them; the bar
                without the transform its animation gives it, under reduced motion, too. The words are lifted over the bar,
                so a link's 44px target under a finger, which reaches across the track, still takes the tap. */}
            <div className="relative z-1 mb-1.5 flex items-baseline gap-3 text-sm">
              {it.href ? (
                // The row's look at rest, the accent under the pointer and the focus ring on the keyboard. The hit area is
                // drawn outside the link, so the link does not clip: the label inside it truncates.
                <Link href={it.href} className={cn('hit row-link flex min-w-0 flex-1 hover:text-accent-ink', hot ? 'font-medium text-ink' : 'text-ink-2')}>
                  <span className="truncate">{it.label}</span>
                </Link>
              ) : (
                <span className={cn('min-w-0 flex-1 truncate', hot ? 'font-medium text-ink' : 'text-ink-2', it.key === '__others' && 'text-ink-3')}>{it.label}</span>
              )}
              {it.meta ? <span className="t-caption hidden sm:inline">{it.meta}</span> : null}
              <span data-figure className="t-num font-medium text-ink">
                {format(it.value)}
                {pair ? <span className="text-ink-3"> · {it.compare == null ? '—' : format(it.compare)}</span> : null}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fill-track">
              <div
                data-bar
                data-estimate={it.estimate || undefined}
                className={cn('grow-x relative h-full rounded-full transition-colors duration-(--dur-hover)', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/bar:bg-chart-neutral-strong')}
                style={{ width: `${(Math.max(0, it.value) / top) * 100}%`, ['--i' as string]: n }}
              />
            </div>
            {pair && it.compare != null ? <div data-compare className="mt-0.5 h-1.5 rounded-full border border-chart-neutral-strong" style={{ width: `${(Math.max(0, it.compare) / top) * 100}%` }} /> : null}
          </li>
        );
      })}
    </ul>
  );
  if (!framed) return list;
  return (
    <div className={className}>
      {pair ? (
        <ul data-legend className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-3 rounded-full bg-chart-neutral" />{pair.label}</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-3 rounded-full border border-chart-neutral-strong" />{pair.compareLabel}</li>
        </ul>
      ) : null}
      {levels ? (
        // The gridlines stand behind the rows, through all of them, at the levels named under them.
        <div className="relative">
          {levels.map((l) => <span key={l} data-gridline aria-hidden className={cn('absolute inset-y-0 w-px bg-chart-grid', l === top && '-translate-x-full')} style={{ left: `${(l / top) * 100}%` }} />)}
          {list}
        </div>
      ) : list}
      {levels ? <Levels levels={levels.map((l) => [format(l), l / top])} /> : null}
      {past ? <p data-widened className="mt-1.5 text-2xs text-ink-3">Scale widened to {format(top)} to show {named(past) ?? past.key}</p> : null}
      {estimated ? <p data-estimate-key className="mt-1.5 text-2xs text-ink-3">Hatched: estimate</p> : null}
    </div>
  );
}
