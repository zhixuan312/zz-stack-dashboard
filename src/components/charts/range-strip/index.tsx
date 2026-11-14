'use client';

import Link from 'next/link';
import { cn } from '../../../lib/cn';
import { FORMATTERS } from '../../../lib/format';
import { heldTicks } from '../scale';

export type RangeItem = { key: string; label: React.ReactNode; from: number | null; to: number | null; href?: string };

/** About the width of one character of a figure or a level (`text-2xs`), in px, and the space between it and its neighbour. */
const CH = 6.5, GAP = 4;
/** The strip's row height and the segment's own height inside it. */
const ROW = 20, SEGMENT = 8;

/**
 * A range per row, on one shared scale: each row's own span from `from` to `to`, with both ends marked, against one or
 * two reference levels drawn as lines across every row. It answers "each endpoint's lowest and median latency for the
 * day, against the 350 ms ceiling" — a form the catalogue's other charts lose: grouped columns show the two values and
 * not the range, Bar list draws one value, and Diverging bars is signed about zero.
 *
 * A missing end is drawn as missing, never as zero: a row with only a `to` has a segment that starts at the plot's edge
 * with an open end, and the table says which end is absent. A `domain` holds the scale so charts side by side compare
 * row by row; a value outside it widens the scale rather than being clipped, and the chart says so.
 */
export function RangeStrip({
  items,
  label,
  format = FORMATTERS.count,
  references = [],
  domain,
  highlight,
  highlightLabel,
  className,
}: {
  items: RangeItem[];
  label: string;
  format?: (n: number) => string;
  /** One or two levels every row is read against: the ceiling, the target, last week's median. */
  references?: { value: number; label: string }[];
  /** A stated range the scale includes, so charts side by side share their levels. */
  domain?: [number, number];
  /** The key of the one row worth pointing at. Omit it and every strip is neutral. */
  highlight?: string;
  /** What makes that row the one worth pointing at, in a word: "The widest range". Said on its row. */
  highlightLabel?: string;
  className?: string;
}) {
  const values = items.flatMap((r) => [r.from, r.to]).filter((v): v is number => v !== null);
  const held = domain && domain[1] > domain[0] ? domain : null;
  const lowest = Math.min(...values, ...references.map((r) => r.value), held ? held[0] : Infinity);
  const highest = Math.max(...values, ...references.map((r) => r.value), held ? held[1] : -Infinity);
  // The scale is the held range while every value is inside it; otherwise the lowest and highest levels that take them
  // all, and the line above the rows says the held range was widened.
  const widened = Boolean(held && (lowest < held[0] || highest > held[1]));
  const levels = held && !widened ? [held[0], held[1]] : ((): number[] => {
    const got = heldTicks(Number.isFinite(lowest) ? lowest : 0, Number.isFinite(highest) ? highest : 1);
    return got.length >= 2 ? got : [got[0] ?? 0, (got[0] ?? 0) + 1];
  })();
  const [low, top] = [levels[0], levels[levels.length - 1]];
  const span = top - low || 1;
  const at = (v: number) => ((v - low) / span) * 100;
  // Each end of a row keeps room for the widest figure that stands beyond it, as Diverging bars does.
  const figures = items.flatMap((r) => [r.from === null ? '—' : format(r.from), r.to === null ? '—' : format(r.to)]);
  const gutter = Math.max(...figures.map((f) => f.length), 1) * CH + GAP;
  const named = (r: RangeItem) => (typeof r.label === 'string' || typeof r.label === 'number' ? String(r.label) : null);
  const ends = (r: RangeItem) => (r.from === null ? `up to ${r.to === null ? 'no value' : format(r.to)}` : r.to === null ? `from ${format(r.from)}` : `${format(r.from)} to ${format(r.to)}`);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {widened ? <p data-widened className="text-2xs text-ink-3">{`Scale widened from ${format(held![0])}–${format(held![1])} to ${format(low)}–${format(top)}`}</p> : null}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
        {/* The reference lines cross every row, not the first one only: `row-span-full` reaches from the first row to the
            last, and the rows behind it are transparent, so one element per level covers the whole plot. */}
        <div aria-hidden className="pointer-events-none col-start-2 row-span-full row-start-1" style={{ paddingInline: gutter }}>
          <div className="relative h-full">
            {references.map((r) => (
              <span key={r.label} data-reference-line className="absolute inset-y-0 w-px bg-chart-axis" style={{ left: `${at(r.value)}%` }} />
            ))}
          </div>
        </div>
        <ul aria-label={label} className="col-span-2 col-start-1 row-start-1 grid grid-cols-subgrid gap-y-3">
          {items.map((r, n) => {
            const hot = r.key === highlight;
            // A missing end reaches the plot's edge on that side: a segment from zero would claim a measured zero. Only a
            // row with neither end draws no strip.
            const missing = r.from === null && r.to === null;
            const left = r.from === null ? 0 : at(r.from);
            const right = r.to === null ? 100 : at(r.to);
            return (
              <li key={r.key} data-row={r.key} className="group/row col-span-2 grid grid-cols-subgrid items-center" title={[named(r), ends(r), hot ? highlightLabel : null].filter(Boolean).join(' · ')}>
                {r.href ? (
                  <Link href={r.href} className={cn('hit row-link flex min-w-0 text-sm', hot ? 'font-medium text-ink' : 'text-ink-2')}>
                    <span className="truncate">{r.label}</span>
                  </Link>
                ) : (
                  <span className={cn('min-w-0 truncate text-sm', hot ? 'font-medium text-ink' : 'text-ink-2')}>{r.label}</span>
                )}
                <div className="relative" style={{ height: ROW }}>
                  {/* The plot, inset by the gutter each end keeps for its figure, so a marker at 100% stands inside the chart. */}
                  <div className="relative h-full" style={{ paddingInline: gutter }}>
                    <div className="relative h-full">
                      {!missing ? (
                        <div
                          data-strip
                          className={cn('grow-x absolute top-1/2 -translate-y-1/2 rounded-full', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/row:bg-chart-neutral-strong')}
                          style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%`, height: SEGMENT, ['--i' as string]: n }}
                        />
                      ) : null}
                      {/* Both ends marked: an end that is missing gets no mark, so a range with one end still reads as one. */}
                      {r.from !== null ? <span aria-hidden data-end="from" className={cn('absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1', hot ? 'bg-accent ring-accent' : 'bg-chart-neutral-strong ring-line-strong')} style={{ left: `${at(r.from)}%` }} /> : null}
                      {r.to !== null ? <span aria-hidden data-end="to" className={cn('absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1', hot ? 'bg-accent ring-accent' : 'bg-chart-neutral-strong ring-line-strong')} style={{ left: `${at(r.to)}%` }} /> : null}
                    </div>
                  </div>
                  <span data-figure className={cn('t-num absolute top-1/2 -translate-y-1/2 text-2xs leading-5 whitespace-nowrap', hot ? 'font-medium text-ink' : 'text-ink-2')} style={{ right: 0 }}>{ends(r)}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div aria-hidden className="col-start-2" style={{ paddingInline: gutter }}>
          <div className="relative h-4">
            {levels.map((t) => (
              <span key={t} data-level className="t-num absolute -translate-x-1/2 text-2xs leading-4 whitespace-nowrap text-ink-3" style={{ left: `${at(t)}%` }}>{format(t)}</span>
            ))}
            {references.map((r) => (
              <span key={r.label} data-reference className="t-num absolute -translate-x-1/2 text-2xs leading-4 whitespace-nowrap text-ink-2" style={{ left: `${at(r.value)}%` }}>{format(r.value)}</span>
            ))}
          </div>
        </div>
      </div>
      {references.length ? (
        <p className="text-2xs text-ink-3">{references.map((r) => `${r.label} at ${format(r.value)}`).join(' · ')}</p>
      ) : null}
    </div>
  );
}
