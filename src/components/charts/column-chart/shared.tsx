'use client';

import { useState, type KeyboardEvent } from 'react';
import { cn } from '../../../lib/cn';
import { useMeridian } from '../meridian/index';
import { heldTicks, niceTicks, ticksBetween, type SeriesSlot } from '../scale';

// What every form of the Column chart shares: its data, its measures, its cursor, its axis and its labels. The grouped
// form loads on demand (`./grouped`), so what it shares with the others lives here and neither imports the other.

/** `null` is a period with no data: it keeps its slot, draws no column and reads `noData`, never zero. `estimate` is a
 *  figure not yet measured: its column is hatched and reads "estimate". */
export type Column = { key: string; label: string; value: number | null; estimate?: boolean };
export type StackedColumn = { key: string; label: string; values: (number | null)[]; estimate?: boolean };
/**
 * A part of a stacked column. `color` is a categorical slot (1 to 6) for parts that are identities, teams or several
 * usual outcomes, which one hue cannot tell apart; `tone` is a state, for an outcome that needs somebody. A chart takes
 * one or the other: coral and saffron read as a warning beside a real one.
 */
export type ColumnPart = { key: string; label: string; color?: SeriesSlot; tone?: 'neutral' | 'warning' | 'critical' };
/** A part of a grouped column: an identity (In and Out, this year and last), drawn in its categorical slot, in order
 *  unless it names one. Never a tone: the parts stand side by side and are not a whole or an outcome. */
export type GroupedPart = { key: string; label: string; color?: SeriesSlot };

export type Shared = {
  /** The key of the one column the card is about. */
  highlight?: string;
  /** What makes that column the one the card is about, in a word: "the day of the incident", "the period on trial". The
   *  chart says it wherever the column is read, so the accent is not a colour a reader has to guess (issue #94). */
  highlightLabel?: string;
  /** One ISO date per column, to share the page's Meridian. */
  dates?: string[];
  /** The last column is a period still in progress: it is drawn unfinished and reads "so far". */
  running?: boolean;
  /** How a column's value reads, above it, in the readout and in the table. It must tell neighbouring columns apart. */
  format?: (n: number) => string;
  /** How a period with no data reads, wherever its value would: "No data" unless the product names it otherwise. */
  noData?: string;
  /** The values are counts: every tick is a whole number, so a top of 1 draws no level at 0.5 (#72). */
  whole?: boolean;
  /** How a tick reads: an axis formatter, true at every tick (`AXIS_FORMATTERS` in `@/lib/format`). Without one the axis
   * reads as `format` does, which is right only while `format` is exact: one that rounds prints a tick it does not stand at. */
  axisFormat?: (n: number) => string;
  /** A held scale, as the Trend chart's: the plot ends at this range, so charts read side by side share their levels. A
   *  column is read by its height, so the plot is drawn from zero, or from `min` when it is under zero. A value outside
   *  the range is never cropped: the scale widens to take it and the chart says so (#136). */
  domain?: [number, number];
  /** Pixels for the plot, or `fill` to take the height its card gives it (never under 220px). */
  height?: number | 'fill';
  label: string;
  /** A static pointed column in the Atlas; real charts take theirs from the pointer, the keys and the Meridian. */
  'data-preview-index'?: number;
  /** Label every nth column from the first, for a scale with its own rhythm: 6 puts hours at 00, 06, 12, 18. By
   * default labels count back from the last column, as many as fit. */
  labelEvery?: number;
  className?: string;
};

/**
 * The measures in pixels: the space between columns, the least a column keeps before that space gives way, and the
 * narrowest column (a grouped part's bar) that keeps its value at rest.
 */
export const GAP = 2, THIN = 1, REST = 36;
/**
 * The width of one character, in px, at the three sizes this chart measures words at. They differ because the type does:
 * a value at rest and a category label are set small and tight, an axis tick a little wider, and a tick's gutter carries
 * its own padding. One number for all three would be wrong for two of them.
 */
export const CH = 6.5;
/** One character of an axis tick, which the plot's left gutter is measured in. */
const TICK_CH = 6.4;
/** One character of a category label under the columns, which decides how many of them fit. */
const LABEL_CH = 6.2;
/**
 * The plot widths past which `n` columns stand another pixel apart, up to `GAP`: each is the width at which every
 * column still has `THIN` of its own. A chart with more columns than room closes its gaps before it outgrows its box,
 * and a whole pixel at a time, since a fraction of one is drawn as a gap here and none there.
 */
export const opens = (n: number) => Array.from({ length: n > 1 ? GAP : 0 }, (_, k) => n * THIN + (k + 1) * (n - 1));
/**
 * The gap as the rows carry it: an expression of a row's own width, so it is right in the server's HTML, before any
 * width is measured. Each term steps from nothing to a pixel as the row passes one of the widths above.
 */
export const gapOf = (n: number) => (n > 1 ? `calc(${opens(n).map((w) => `clamp(0px, (100% - ${w}px) * 1000, 1px)`).join(' + ')})` : '0px');
// Whatever is centred on a column and may be wider than it starts with the first column and ends with the last, so
// nothing runs past the plot; inside those, a narrower one is still centred.
export const placed = (i: number, n: number) => (i === n - 1 ? 'right-0 flex min-w-full justify-center' : i === 0 ? 'left-0 flex min-w-full justify-center' : 'left-1/2 -translate-x-1/2');

/**
 * The scale over the values read, and the gutter its labels take. A value under zero, where `signed` allows one, takes
 * the scale under zero for it, so a column hangs from the zero line (#78). A `domain` holds the scale to a stated range,
 * as the Trend chart's does: the levels end at both ends while every value is inside, and widen to take one outside,
 * which the caller announces from `widened`.
 */
export function scaleOf(read: number[], signed: boolean, whole: boolean, af: (n: number) => string, domain?: [number, number]) {
  const data = read.length ? read : [0];
  const top0 = Math.max(0, ...data), bottom0 = Math.min(0, ...data);
  const held = domain && domain[1] > domain[0] ? domain : null;
  // A column is read by its height, so a held scale is drawn from zero, as the Trend chart draws an area or a stack; a
  // range under zero is drawn from its own floor, since a fall hangs from the zero line.
  const end = held ? Math.min(held[0], 0) : 0;
  const inside = held ? bottom0 >= end && top0 <= held[1] : false;
  const count = 3;
  const levels = held && inside ? heldTicks(end, held[1], count) : null;
  const ticks = levels
    ? (whole ? levels.filter((t, i, all) => Number.isInteger(t) || !i || i === all.length - 1) : levels)
    : held ? ticksBetween(Math.min(end, bottom0), Math.max(held[1], top0), count, whole)
      : signed && bottom0 < 0 ? ticksBetween(bottom0, top0, count, whole) : niceTicks(top0 > 0 ? top0 : 1, count, whole);
  const low = ticks[0], top = ticks[ticks.length - 1];
  /** A level's height in the scale, as a share of it from the bottom. */
  const at100 = (v: number) => ((v - low) / (top - low)) * 100;
  const widened = held && !inside ? `Scale widened from ${af(end)}\u2013${af(held[1])} to ${af(low)}\u2013${af(top)}` : '';
  return { ticks, low, top, at100, signed: low < 0, left: Math.max(...ticks.map((t) => af(t).length)) * TICK_CH + 10, widened };
}

/**
 * The cursor: one column, moved by the pointer and the keys, and with `dates` the page's Meridian. `local` says this
 * chart is the one being pointed at: a chart that only follows another chart's cursor marks the day and keeps its
 * readout to itself, as the Trend chart does.
 */
export function useCursor(n: number, dates: string[] | undefined, previewIndex: number | undefined) {
  const meridian = useMeridian(dates ?? []);
  const [own, setOwn] = useState<number | null>(null);
  const [local, setLocal] = useState(false);
  const timed = Boolean(dates && dates.length === n);
  const active = previewIndex ?? (timed ? meridian.index : own);
  const set = (i: number | null) => { (timed ? meridian.setIndex : setOwn)(i); setLocal(i !== null); };
  const keys = (e: KeyboardEvent) => {
    const k = e.key;
    if (!n || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') return set(null);
    const cur = active ?? n - 1;
    set(k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, cur + (k === 'ArrowLeft' ? -1 : 1))));
  };
  return { active, set, keys, local, timed };
}

/** The axis: a gridline and a label at each tick, the one at zero `chart-axis`. */
export function Ticks({ ticks, at100, af, left }: { ticks: number[]; at100: (v: number) => number; af: (n: number) => string; left: number }) {
  return ticks.map((t) => (
    <div key={t} aria-hidden className="absolute right-0 flex items-center" style={{ left: 0, bottom: `${at100(t)}%`, transform: 'translateY(50%)' }}>
      <span data-tick className="t-num w-(--w) pr-2.5 text-right text-2xs leading-4 text-ink-3" style={{ ['--w' as string]: `${left}px` }}>{af(t)}</span>
      <span className={cn('h-px flex-1', t === 0 ? 'bg-chart-axis' : 'bg-chart-grid')} />
    </div>
  ));
}

/**
 * The labels under the columns. A category left unlabelled cannot be told apart, so categories each keep a label, cut
 * to their own column, once a column has room for a few letters; dates keep their rhythm and skip. The row keeps its
 * height for the frame its labels wait, so nothing under it moves. With `estimate`, the key to the hatch stands under it.
 */
export function Labels({ bars, active, width, left, timed, every, settled, estimate }: {
  bars: { key: string; label: string }[];
  active: number | null;
  width: number;
  left: number;
  timed: boolean;
  every?: number;
  settled: boolean;
  estimate: boolean;
}) {
  const n = bars.length;
  const longest = Math.max(...bars.map((b) => b.label.length));
  const fit = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((width - left) / (longest * LABEL_CH + 16)))));
  const each = !timed && !every && (width - left) / n >= 36;
  return (
    <>
      <div aria-hidden className="mt-2 flex min-h-4 text-2xs text-ink-3" style={{ paddingLeft: left, columnGap: gapOf(n) }}>
        {settled && bars.map((b, i) => (
          <span key={b.key} className="relative h-4 min-w-0 flex-1">
            {active === i ? (
              <span className={cn('absolute z-10', placed(i, n))}><span className="rounded-xs bg-surface px-1 whitespace-nowrap text-ink">{b.label}</span></span>
            ) : each ? (
              <span className="block truncate px-0.5 text-center">{b.label}</span>
            ) : (every ? i % (every * Math.ceil(fit / every)) === 0 : (n - 1 - i) % fit === 0) ? (
              <span className={cn('absolute whitespace-nowrap', placed(i, n))}>{b.label}</span>
            ) : null}
          </span>
        ))}
      </div>
      {estimate ? <p data-estimate-key className="mt-1 text-2xs text-ink-3" style={{ paddingLeft: left }}>Hatched: estimate</p> : null}
    </>
  );
}

/**
 * A part's colour as a square. The palest part of a stack is the accent at a fifth of its strength, a whisper on the
 * card, and a swatch is the one mark whose whole job is to be seen: the hairline around it does that without
 * flattening the order of the tones, as the line behind a stacked Trend chart's swatch does.
 */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cn('size-2.5 shrink-0 rounded-[3px] ring-1 ring-ink-3', className)} style={{ background: color }} />;
}
