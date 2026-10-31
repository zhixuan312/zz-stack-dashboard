'use client';

import Link from 'next/link';
import { cn } from '../../../lib/cn';
import { FORMATTERS } from '../../../lib/format';
import { heldTicks, niceTicks } from '../scale';
import { useSize } from '../use-size';

export type DivergingItem = { key: string; label: React.ReactNode; value: number | null; href?: string; estimate?: boolean };

/** About the width of one character of a figure or a level (`text-2xs`), in px, and the space between it and its neighbour. */
const CH = 6.5, GAP = 4;

/** A rise with its plus, a fall with the true minus, zero as it is. */
const signed = (n: number) => (n > 0 ? `+${FORMATTERS.count(n)}` : n < 0 ? `−${FORMATTERS.count(-n)}` : '0');

/**
 * Signed rows either side of one zero line, on a scale symmetric about it: a net change by category, a gain or a loss
 * by customer. A rise extends right, a fall left, each its share of its half of the plot. The bars are the neutral
 * population and one row, the one the card is about, takes the accent; no row is coloured by its sign, since the side
 * already says it and a status colour would read as an alarm.
 *
 * A `domain` holds the scale at ±domain, so charts side by side compare row by row. A magnitude past it widens the
 * scale to that magnitude rather than clipping its bar, and the chart says so in words, naming the row.
 */
export function DivergingBars({
  items,
  label,
  format = signed,
  domain,
  order = 'value',
  highlight,
  highlightLabel,
  axis = true,
  className,
}: {
  items: DivergingItem[];
  label: string;
  format?: (n: number) => string;
  /** The half-width the scale holds, so charts compare row by row. A magnitude past it widens the scale and says so. */
  domain?: number;
  /** `value`: the largest rise first and the largest fall last, no data after every value. `given`: as passed. */
  order?: 'value' | 'given';
  /** The key of the one row worth pointing at. Omit it and every bar is neutral. */
  highlight?: string;
  /** What makes that row the one worth pointing at, in a word: "The largest fall". Said on its row. */
  highlightLabel?: string;
  axis?: boolean;
  className?: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  // Stable, so equal values keep the order given.
  const rows = order === 'given' ? items : [...items].sort((a, b) => (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0) || (b.value ?? 0) - (a.value ?? 0));
  const largest = Math.max(0, ...rows.map((r) => (r.value === null ? 0 : Math.abs(r.value))));
  const held = domain !== undefined && domain > 0 ? domain : undefined;
  const top = held === undefined ? niceTicks(largest).at(-1)! : Math.max(held, largest);
  const widened = held !== undefined && largest > held ? rows.find((r) => r.value !== null && Math.abs(r.value) === top) : undefined;
  const levels = held === undefined ? heldTicks(-top, top) : widened ? [-top, ...heldTicks(-held, held), top] : heldTicks(-held, held);
  const figure = (v: number | null) => (v === null ? '—' : format(v));
  // A row's label is its name in words when it is text; the widening line names a row with a node label by its key.
  const named = (r: DivergingItem) => (typeof r.label === 'string' || typeof r.label === 'number' ? String(r.label) : null);
  // Each end keeps room for the widest figure, which stands just beyond its bar.
  const gutter = Math.max(...rows.map((r) => figure(r.value).length), 1) * CH + GAP;
  const at = (t: number) => ((t + top) / (2 * top)) * 100;
  // A level whose words would touch a neighbour's at the measured width keeps its gridline and hides its words: the
  // ends and zero first, then each other level from zero outward.
  const shown = new Set(width ? [levels[0], 0, levels.at(-1)!] : levels);
  if (width) {
    const clear = (a: number, b: number) => (Math.abs(at(a) - at(b)) / 100) * width >= ((format(a).length + format(b).length) * CH) / 2 + GAP;
    for (const side of [levels.filter((t) => t > 0), levels.filter((t) => t < 0).reverse()]) {
      let last = 0;
      for (const t of side.slice(0, -1)) if (clear(t, last) && clear(t, side.at(-1)!)) shown.add((last = t));
    }
  }
  const plot = { paddingInline: gutter };
  // A row with no figure, null or zero, has nothing to hatch, so it is not an estimate.
  const estimate = (r: DivergingItem) => Boolean(r.estimate && r.value);
  const estimated = rows.some(estimate);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {widened ? <p data-widened className="text-2xs text-ink-3">{`Scale widened to ${format(top)} to show ${named(widened) ?? widened.key}`}</p> : null}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
        <div aria-hidden className="pointer-events-none col-start-2 row-start-1" style={plot}>
          <div className="relative h-full">
            {(axis ? levels : [0]).map((t) => (
              <span key={t} data-gridline className={cn('absolute inset-y-0 w-px', t === 0 ? 'bg-chart-axis' : 'bg-chart-grid')} style={{ left: `${at(t)}%` }} />
            ))}
          </div>
        </div>
        <ul aria-label={label} className="col-span-2 col-start-1 row-start-1 grid grid-cols-subgrid gap-y-3">
          {rows.map((r, n) => {
            const hot = r.key === highlight;
            const v = r.value;
            const rise = v === null || v >= 0;
            const share = v === null ? 0 : (Math.abs(v) / top) * 100;
            return (
              <li key={r.key} data-row={r.key} className="group/row col-span-2 grid grid-cols-subgrid items-center" title={[named(r), figure(v), hot ? highlightLabel : null, estimate(r) ? 'estimate' : null].filter(Boolean).join(' · ')}>
                {r.href ? (
                  // The row's look at rest, the accent under the pointer and the focus ring on the keyboard.
                  <Link href={r.href} className={cn('hit row-link flex min-w-0 text-sm', hot ? 'font-medium text-ink' : 'text-ink-2')}>
                    <span className="truncate">{r.label}</span>
                  </Link>
                ) : (
                  <span className={cn('min-w-0 truncate text-sm', hot ? 'font-medium text-ink' : 'text-ink-2')}>{r.label}</span>
                )}
                <div className="h-5" style={plot}>
                  <div className="relative h-full">
                    <div className={cn('absolute inset-y-0', rise ? 'right-0 left-1/2' : 'right-1/2 left-0')}>
                      {v ? (
                        <div
                          data-bar
                          data-side={rise ? 'rise' : 'fall'}
                          data-estimate={estimate(r) ? '' : undefined}
                          className={cn(
                            'grow-x absolute inset-y-1 transition-colors duration-(--dur-hover)',
                            rise ? 'left-0 rounded-r-[4px]' : 'right-0 origin-right rounded-l-[4px]',
                            hot ? 'bg-accent' : 'bg-chart-neutral group-hover/row:bg-chart-neutral-strong',
                          )}
                          style={{ width: `${share}%`, ['--i' as string]: n }}
                        />
                      ) : null}
                      <span
                        data-figure
                        className={cn('t-num absolute inset-y-0 text-2xs leading-5 whitespace-nowrap', hot ? 'font-medium text-ink' : 'text-ink-2')}
                        style={rise ? { left: `calc(${share}% + ${GAP}px)` } : { right: `calc(${share}% + ${GAP}px)` }}
                      >
                        {figure(v)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {axis ? (
          <div aria-hidden className="col-start-2" style={plot}>
            <div ref={ref} className="relative h-4">
              {levels.map((t) => (
                <span key={t} data-level className={cn('t-num absolute -translate-x-1/2 text-2xs leading-4 whitespace-nowrap text-ink-3', !shown.has(t) && 'invisible')} style={{ left: `${at(t)}%` }}>
                  {format(t)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {estimated ? <p data-estimate-key className="text-2xs text-ink-3">Hatched: estimate</p> : null}
    </div>
  );
}
