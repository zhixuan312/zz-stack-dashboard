'use client';

import { useState, type KeyboardEvent } from 'react';
import { cn } from '../../../lib/cn';
import { useMeridian } from '../meridian/index';
import { Readout } from '../readout';
import { niceTicks, SERIES_VAR, stackPart } from '../scale';
import { useSize } from '../use-size';

/** `null` is a period with no data: it keeps its slot, draws no column and reads `noData`, never zero. */
export type Column = { key: string; label: string; value: number | null };
export type StackedColumn = { key: string; label: string; values: (number | null)[] };
/**
 * A part of a stacked column. `color` is a categorical slot (1 to 6) for parts that are identities, teams or several
 * usual outcomes, which one hue cannot tell apart; `tone` is a state, for an outcome that needs somebody. A chart takes
 * one or the other: coral and saffron read as a warning beside a real one.
 */
export type ColumnPart = { key: string; label: string; color?: number; tone?: 'neutral' | 'warning' | 'critical' };

type Shared = {
  /** The key of the one column the card is about. */
  highlight?: string;
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
export type ColumnChartProps = Shared & (
  | { columns: Column[]; parts?: undefined }
  /** `values` holds one value a part, in the parts' order, the first at the bottom. */
  | { columns: StackedColumn[]; parts: ColumnPart[] }
);

/**
 * The measures in pixels: the space between columns, the least a column keeps before that space gives way, the
 * narrowest column that keeps its value at rest, and the most parts drawn.
 */
const GAP = 2, THIN = 1, REST = 36, MOST = 4;
/** About the width of one character of a value at rest (`text-2xs`), in px: enough to tell whether a label fits its column. */
const CH = 6.5;
/**
 * The plot widths past which `n` columns stand another pixel apart, up to `GAP`: each is the width at which every
 * column still has `THIN` of its own. A chart with more columns than room closes its gaps before it outgrows its box,
 * and a whole pixel at a time, since a fraction of one is drawn as a gap here and none there.
 */
const opens = (n: number) => Array.from({ length: n > 1 ? GAP : 0 }, (_, k) => n * THIN + (k + 1) * (n - 1));
/**
 * The gap as the rows carry it: an expression of a row's own width, so it is right in the server's HTML, before any
 * width is measured. Each term steps from nothing to a pixel as the row passes one of the widths above.
 */
const gapOf = (n: number) => (n > 1 ? `calc(${opens(n).map((w) => `clamp(0px, (100% - ${w}px) * 1000, 1px)`).join(' + ')})` : '0px');
const TONES = { neutral: 'var(--chart-neutral-strong)', warning: 'var(--warning)', critical: 'var(--critical)' };
const count = (n: number) => n.toLocaleString('en-US');
/** A value that is missing, or below zero, is no contribution to its column. */
const amount = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0);

/** A column as drawn: its parts' values, `null` where a part has no data, and whether the whole column has none. */
type Bar = { key: string; label: string; values: (number | null)[]; total: number; none: boolean };
type Drawn = { key: string; label: string; tone: 'accent' | 'series' | keyof typeof TONES; color: string };

/**
 * The parts as drawn and each column's value for them. Past four parts nobody tells the colours apart, so the fourth
 * drawn is "Other", the sum of the fourth and every later one. Parts with neither a slot nor a tone share the accent,
 * each by its place in the stack. Once any part names a slot or a tone the parts are identities or outcomes: a part
 * with a slot takes it, a part with a tone takes the tone, and one with neither (Other among them) is the neutral, so
 * the accent never stands beside a categorical or a status colour. Where a part already is the neutral (`tone:
 * 'neutral'`, a usual outcome beside one that needs somebody), one with neither is the quieter neutral, so the two
 * usual parts are told apart and Other stays the quietest (#67).
 */
function stack(columns: StackedColumn[], parts: ColumnPart[]) {
  const fold = parts.length > MOST;
  const listed: ColumnPart[] = fold ? [...parts.slice(0, MOST - 1), { key: 'other', label: 'Other' }] : parts;
  const named = parts.some((p) => p.tone || p.color);
  const neutralTaken = parts.some((p) => p.tone === 'neutral' && !p.color);
  const drawn: Drawn[] = listed.map((p, k) => (
    p.color ? { key: p.key, label: p.label, tone: 'series', color: SERIES_VAR(p.color) }
      : named ? { key: p.key, label: p.label, tone: p.tone ?? 'neutral', color: p.tone ? TONES[p.tone] : neutralTaken ? 'var(--chart-neutral)' : TONES.neutral }
        : { key: p.key, label: p.label, tone: 'accent', color: stackPart(k, listed.length) }
  ));
  const bars = columns.map((c): Bar => {
    // A part with no data stays `null`, so it is read as no data; it adds nothing to the total of the parts that were read.
    const all = parts.map((_, k) => (c.values[k] === null ? null : amount(c.values[k])));
    const rest = all.slice(MOST - 1);
    const values = fold ? [...all.slice(0, MOST - 1), rest.every((v) => v === null) ? null : rest.reduce<number>((a, b) => a + (b ?? 0), 0)] : all;
    return { key: c.key, label: c.label, values, total: values.reduce<number>((a, b) => a + (b ?? 0), 0), none: all.every((v) => v === null) };
  });
  return { drawn, bars };
}

/**
 * Counts side by side: one column per category or per period. Every column is the neutral population and one, the one
 * the card is about, takes the accent. Given `dates` (one per column), it joins the page's Meridian: pointing at a
 * column points every chart on the page at that day.
 *
 * `parts` is the other form: each column is a whole split into its parts, the first at the bottom. Parts of one kind
 * share the accent, deepest at the bottom; outcomes carry a tone each. The axis, the value above a column and the
 * table's last cell are the total, and the readout names every part.
 *
 * `running` says the last column is a period still in progress. It is not a fact like the columns before it, so it is
 * drawn at half strength inside a dashed outline, and wherever it is read it says "so far".
 *
 * The plot is one Tab stop: Left and Right move a cursor a column, Home and End go to the ends, Escape lets go. It is
 * the cursor the pointer moves, and it is announced to screen readers.
 */
export function ColumnChart({
  highlight,
  dates,
  running = false,
  format = count,
  noData = 'No data',
  whole = false,
  axisFormat,
  height = 200,
  label,
  labelEvery: every,
  'data-preview-index': previewIndex,
  className,
  ...form
}: ColumnChartProps) {
  const [box, { width }] = useSize<HTMLElement>();
  const meridian = useMeridian(dates ?? []);
  const [own, setOwn] = useState<number | null>(null);
  // Whether this chart is the one being pointed at: a chart that only follows another chart's cursor marks the day and
  // keeps its readout to itself, as the Trend chart does.
  const [local, setLocal] = useState(false);
  const { drawn, bars } = form.parts ? stack(form.columns, form.parts) : { drawn: null, bars: form.columns.map((c): Bar => ({ key: c.key, label: c.label, values: [c.value], total: c.value ?? 0, none: c.value === null })) };
  const n = bars.length;
  const timed = Boolean(dates && dates.length === n);
  const active = previewIndex ?? (timed ? meridian.index : own);
  const set = (i: number | null) => { (timed ? meridian.setIndex : setOwn)(i); setLocal(i !== null); };
  const fill = height === 'fill';
  const soFar = running ? n - 1 : -1;

  // A period with no data has no height, so the scale is the periods that have one.
  const ticks = niceTicks(Math.max(1, ...bars.filter((b) => !b.none).map((b) => b.total)), 3, whole);
  const top = ticks[ticks.length - 1];
  const af = axisFormat ?? format;
  const left = Math.max(...ticks.map((t) => af(t).length)) * 6.4 + 10;
  const longest = Math.max(...bars.map((b) => b.label.length));
  const fit = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((width - left) / (longest * 6.2 + 16)))));
  // A category left unlabelled cannot be told apart, so categories each keep a label, cut to their own column, once
  // a column has room for a few letters; dates keep their rhythm and skip.
  const every1 = !timed && !every && (width - left) / n >= 36;
  // The gap in pixels at this width, as the rows' own expression resolves it: all of GAP wherever there is room.
  const gap = opens(n).filter((w) => width - left > w).length;
  // A column wide enough for a figure keeps its value above it at rest; a narrower one shows it when pointed at.
  const column = n ? (width - left - gap * (n - 1)) / n : 0;
  const rest = column >= REST;
  // Whatever is centred on a column and may be wider than it starts with the first column and ends with the last, so
  // nothing runs past the plot; inside those, a narrower one is still centred.
  /** A value as it reads; a period with no data reads the product's word, and "so far" with it while it is running. */
  const value = (v: number | null, running = false) => (v === null ? (running ? `${noData} so far` : noData) : format(v));
  const totalOf = (b: Bar, i: number) => value(b.none ? null : b.total, i === soFar);
  const placed = (i: number) => (i === n - 1 ? 'right-0 flex min-w-full justify-center' : i === 0 ? 'left-0 flex min-w-full justify-center' : 'left-1/2 -translate-x-1/2');

  const keys = (e: KeyboardEvent) => {
    const k = e.key;
    if (!n || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') return set(null);
    const cur = active ?? n - 1;
    set(k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, cur + (k === 'ArrowLeft' ? -1 : 1))));
  };

  const at = active !== null && active >= 0 && active < n ? active : null;
  const on = at === null ? null : bars[at];
  // The readout stands after a column in the first half of the plot and before one in the second.
  const after = at !== null && at * 2 < n - 1;
  /** The column pointed at, in words: the table's own order, the first part first. */
  // A period with no data says "so far" in its word, so the reading does not say it twice.
  const reading = on && at !== null
    ? on.none
      ? `${on.label}: ${totalOf(on, at)}`
      : `${on.label}: ${drawn ? `${drawn.map((p, k) => `${p.label} ${value(on.values[k])}`).join(', ')}, Total ${format(on.total)}` : format(on.total)}${at === soFar ? ', so far' : ''}`
    : null;

  return (
    <figure ref={box} aria-label={label} className={cn('relative min-w-0 select-none', fill && 'flex min-h-55 flex-1 flex-col', className)} onPointerLeave={() => set(null)}>
      {drawn && drawn.length > 1 ? (
        <ul data-legend aria-hidden className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" style={{ paddingLeft: left }}>
          {drawn.map((p) => <li key={p.key} className="flex items-center gap-1.5"><Swatch color={p.color} />{p.label}</li>)}
        </ul>
      ) : null}
      <div
        data-plot
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the arrow keys to read one column.`}
        onKeyDown={keys}
        onBlur={() => set(null)}
        className={cn('relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent', fill && 'min-h-0 flex-1')}
        style={fill ? undefined : { height }}
      >
        {/* The scale, out of the flow, so a column's share resolves against the plot whatever gave the plot its height.
            It stands inside the plot's box with room for all it draws around itself: 28px over the top tick, the height of
            a pointed value and its 4px off the column, and 8px under the zero tick, the half line its label hangs. So the
            focus ring, 4px outside the box, crosses nothing the plot draws, and nothing moves when the width arrives. */}
        <div className="absolute inset-x-0 top-7 bottom-2">
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute right-0 flex items-center" style={{ left: 0, bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>
              <span data-tick className="t-num w-(--w) pr-2.5 text-right text-2xs leading-4 text-ink-3" style={{ ['--w' as string]: `${left}px` }}>{af(t)}</span>
              <span className={cn('h-px flex-1', t === 0 ? 'bg-chart-axis' : 'bg-chart-grid')} />
            </div>
          ))}
          <div className="absolute inset-y-0 right-0 flex items-end" style={{ left, columnGap: gapOf(n) }}>
            {bars.map((b, i) => {
              const pointed = active === i;
              const hot = pointed || (active === null && b.key === highlight);
              const shown = drawn ? drawn.map((p, k) => ({ p, v: b.values[k] ?? 0 })).filter(({ v }) => v > 0) : [];
              const unfinished = i === soFar;
              // Plain, the pointed value is the chart's readout and takes the tooltip's plane; stacked, the panel is.
              const tip = pointed && !drawn;
              // At rest a label is held to its column. A running period with no data whose words do not fit says "So far",
              // never "No data…" cut mid-word; the tooltip, the readout, the announcement and the table say it whole (#71).
              const full = totalOf(b, i);
              const text = !tip && b.none && unfinished && full.length * CH > column ? 'So far' : full;
              return (
                <div
                  key={b.key}
                  data-column={b.key}
                  data-active={pointed ? '' : undefined}
                  data-running={unfinished ? '' : undefined}
                  data-no-data={b.none ? '' : undefined}
                  // A figure wider than its column is cut at rest, and keeps the whole of itself where the pointer finds it.
                  title={rest && text.length * 7 > column ? text : undefined}
                  className="group/col relative flex h-full min-w-0 flex-1 items-end"
                  onPointerEnter={() => set(i)}
                  onPointerDown={() => set(i)}
                >
                  {/* The column's box: its share of the scale, and never shorter than its parts and its outline can be drawn. A
                      period with no data has no height: it keeps its slot with a dashed hairline just above the baseline,
                      and its word stands over it where a value would. A track the height of the scale was the tallest mark
                      on the chart, and the eye went to the one period that had nothing to say. */}
                  <div data-box className="relative w-full" style={{ height: b.none ? '0%' : `${(Math.max(0, b.total) / top) * 100}%`, minHeight: (drawn ? Math.max(0, shown.length * 4 - 1) : b.total > 0 ? 2 : 0) + (unfinished ? 2 : 0) }}>
                    <div
                      className={cn(
                        'grow-y relative h-full rounded-t-[4px]',
                        drawn && 'transition-[box-shadow] duration-(--dur-hover)',
                        drawn && hot && 'z-1 ring-2 ring-ink',
                        // A period still running: a dashed outline, open at the baseline, around a fill at half strength. The
                        // outline has a pixel of its own and a pixel of the card inside it, so it covers no part and holds
                        // its contrast whatever it surrounds; it is what keeps a faded column a column on a dark card. It
                        // needs 4px of its own; in a narrower column it ends with the column and never runs past the plot.
                        unfinished && 'ml-[min(0px,calc(100%-4px))] border border-b-0 border-dashed border-ink p-px pb-0',
                      )}
                      style={{ ['--i' as string]: i }}
                    >
                      {b.none ? (
                        <div data-no-data-mark aria-hidden className="absolute inset-x-0 bottom-0.5 border-t border-dashed border-line-strong" />
                      ) : drawn ? (
                        // A 1px gap between parts lets the card through: the hairline that keeps neighbours apart.
                        <div className={cn('flex h-full flex-col-reverse gap-px', unfinished && 'opacity-50')}>
                          {shown.map(({ p, v }, k) => (
                            <div
                              key={p.key}
                              data-part={p.key}
                              data-tone={p.tone}
                              data-top={k === shown.length - 1 ? '' : undefined}
                              className={cn('w-full basis-0', k === shown.length - 1 && 'rounded-t-[4px]')}
                              // Shares of the column, so a column of fractions fills its box as a column of millions does.
                              style={{ flexGrow: (v / b.total) * 100, minHeight: 3, background: p.color }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className={cn('h-full w-full rounded-t-[4px] transition-colors duration-(--dur-hover)', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/col:bg-chart-neutral-strong', unfinished && 'opacity-50')} />
                      )}
                    </div>
                    {rest || pointed ? (
                      // One element at rest and pointed at, so its entrance never replays. At rest the value is held to its
                      // column; the tooltip, and a total shown only on pointing, may be wider than theirs.
                      <span aria-hidden className={cn('pointer-events-none absolute bottom-full mb-1', rest && 'fade-in', tip || !rest ? cn('z-10', placed(i)) : 'inset-x-0')}>
                        <span
                          className={cn(
                            't-num block text-2xs leading-4',
                            tip
                              ? 'rounded-sm bg-surface-inverse px-1.5 py-1 font-medium whitespace-nowrap text-ink-inverse shadow-overlay'
                              : rest
                                ? cn('truncate text-center', pointed ? 'font-medium text-ink' : 'text-ink-3')
                                : 'font-medium whitespace-nowrap text-ink',
                          )}
                        >
                          <span data-value>{text}</span>
                          {tip && unfinished && !b.none ? ' · so far' : null}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {on && at !== null && drawn ? (
          <Readout at={left + at * (column + gap) + (after ? column : 0)} after={after} visible={local || previewIndex !== undefined}>
            <p className="t-eyebrow mb-1.5 break-words">{on.label}{at === soFar ? ' · so far' : null}</p>
            {/* The parts top to bottom, as they sit in the column, a part at zero included, then the total. */}
            {drawn.map((p, k) => ({ p, k })).reverse().map(({ p, k }) => (
              <p key={p.key} className="flex flex-wrap items-start gap-x-2 text-xs leading-6">
                <Swatch color={p.color} className="mt-1.75" />
                <span className="min-w-0 flex-1 break-words text-ink-2">{p.label}</span>
                <span className="t-num ml-auto min-w-0 break-words font-medium text-ink">{value(on.values[k], on.none && at === soFar)}</span>
              </p>
            ))}
            <p className="mt-1 flex items-center gap-2 border-t border-line pt-1 text-xs leading-6">
              <span className="text-ink-2">Total</span>
              <span className="t-num ml-auto pl-4 font-semibold text-ink">{totalOf(on, at)}</span>
            </p>
          </Readout>
        ) : null}
      </div>
      <div aria-hidden className="mt-2 flex text-2xs text-ink-3" style={{ paddingLeft: left, columnGap: gapOf(n) }}>
        {bars.map((b, i) => (
          <span key={b.key} className="relative h-4 min-w-0 flex-1">
            {active === i ? (
              <span className={cn('absolute z-10', placed(i))}><span className="rounded-xs bg-surface px-1 whitespace-nowrap text-ink">{b.label}</span></span>
            ) : every1 ? (
              <span className="block truncate px-0.5 text-center">{b.label}</span>
            ) : (every ? i % (every * Math.ceil(fit / every)) === 0 : (n - 1 - i) % fit === 0) ? (
              <span className={cn('absolute whitespace-nowrap', placed(i))}>{b.label}</span>
            ) : null}
          </span>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{reading}</p>
      <table className="sr-only">
        <caption>{label}</caption>
        {drawn ? <thead><tr><th scope="col">Period</th>{drawn.map((p) => <th key={p.key} scope="col">{p.label}</th>)}<th scope="col">Total</th></tr></thead> : null}
        <tbody>
          {bars.map((b, i) => (
            <tr key={b.key}>
              <th scope="row">{b.label}{i === soFar ? ', so far' : null}</th>
              {drawn ? b.values.map((v, k) => <td key={drawn[k].key}>{value(v, b.none && i === soFar)}</td>) : null}
              <td>{totalOf(b, i)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * A part's colour as a square. The palest part of a stack is the accent at a fifth of its strength, a whisper on the
 * card, and a swatch is the one mark whose whole job is to be seen: the hairline around it does that without
 * flattening the order of the tones, as the line behind a stacked Trend chart's swatch does.
 */
function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cn('size-2.5 shrink-0 rounded-[3px] ring-1 ring-ink-3', className)} style={{ background: color }} />;
}
