'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import { cn } from '../../../lib/cn';
import { Readout } from '../readout';
import { SERIES_VAR, stackPart } from '../scale';
import { useSettled } from '../use-settled';
import { useSize } from '../use-size';
import { columnFold } from '../../../logic/derivations';
import { FORMATTERS } from '../../../lib/format';
import { CH, gapOf, Labels, opens, placed, REST, scaleOf, Swatch, Ticks, useCursor, type Column, type ColumnPart, type GroupedPart, type Shared, type StackedColumn } from './shared';

export type { Column, ColumnPart, GroupedPart, StackedColumn };

export type ColumnChartProps = Shared & (
  | { columns: Column[]; parts?: undefined; grouped?: undefined }
  /** `values` holds one value a part, in the parts' order, the first at the bottom. */
  | { columns: StackedColumn[]; parts: ColumnPart[]; grouped?: undefined }
  /** `values` holds one value a part, in the parts' order, the first on the left. */
  | { columns: StackedColumn[]; parts: GroupedPart[]; grouped: true }
);
type Ungrouped = Exclude<ColumnChartProps, { grouped: true }>;

// The grouped form is a chunk of its own: a route whose charts never pass `grouped` does not load it.
const GroupedColumns = dynamic(() => import('./grouped').then((m) => m.GroupedColumns));

/**
 * Past this many columns a plain chart draws each finished column as one element, its bar the element's own `::before`,
 * and grows them as one row: a year of 52 windows at 7D, three such charts on Home, committed about a thousand
 * elements in the frame of the period tap and dropped it on a mid-range phone.
 */
const DENSE = 30;
const TONES = { neutral: 'var(--chart-neutral-strong)', warning: 'var(--warning)', critical: 'var(--critical)' };
/** A part that is missing, or below zero, is no contribution to its column: parts make up a whole. */
const amount = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0);

/** A column as drawn: its parts' values, `null` where a part has no data, and whether the whole column has none. */
type Bar = { key: string; label: string; values: (number | null)[]; total: number; none: boolean; est: boolean };
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
  // The parts' values, one row a part and one value a column, so the logic layer can fold the ones past the fourth.
  const matrix = parts.map((_, k) => columns.map((c) => (c.values[k] === null ? null : amount(c.values[k]))));
  const { values: foldedRows, kept, folded } = columnFold(matrix);
  const listed: ColumnPart[] = folded ? [...parts.slice(0, kept), { key: 'other', label: 'Other' }] : parts;
  const named = parts.some((p) => p.tone || p.color);
  const neutralTaken = parts.some((p) => p.tone === 'neutral' && !p.color);
  const drawn: Drawn[] = listed.map((p, k) => (
    p.color ? { key: p.key, label: p.label, tone: 'series', color: SERIES_VAR(p.color) }
      : named ? { key: p.key, label: p.label, tone: p.tone ?? 'neutral', color: p.tone ? TONES[p.tone] : neutralTaken ? 'var(--chart-neutral)' : TONES.neutral }
        : { key: p.key, label: p.label, tone: 'accent', color: stackPart(k, listed.length) }
  ));
  const bars = columns.map((c, j): Bar => {
    // A part with no data stays `null`, so it is read as no data; it adds nothing to the total of the parts that were read.
    const values = foldedRows.map((row) => row[j] ?? null);
    const none = values.every((v) => v === null);
    return { key: c.key, label: c.label, values, total: values.reduce<number>((a, b) => a + (b ?? 0), 0), none, est: Boolean(c.estimate) && !none };
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
 * `grouped` is the third: each column's parts are identities, In and Out or this year and last, standing side by side
 * in their categorical slots, with no total.
 *
 * `estimate` on a column says its figure is not yet measured: it is hatched and reads "estimate" wherever it is read.
 *
 * `running` says the last column is a period still in progress. It is not a fact like the columns before it, so it is
 * drawn at half strength inside a dashed outline, and wherever it is read it says "so far".
 *
 * The plot is one Tab stop: Left and Right move a cursor a column, Home and End go to the ends, Escape lets go. It is
 * the cursor the pointer moves, and it is announced to screen readers.
 */
export function ColumnChart(props: ColumnChartProps) {
  return props.grouped ? <GroupedColumns {...props} /> : <Columns {...props} />;
}

function Columns({
  highlight,
  highlightLabel,
  dates,
  running = false,
  format = FORMATTERS.count,
  noData = 'No data',
  whole = false,
  axisFormat,
  height = 200,
  label,
  labelEvery: every,
  'data-preview-index': previewIndex,
  className,
  ...form
}: Ungrouped) {
  const [box, { width }] = useSize<HTMLElement>();
  const { columns, parts } = form;
  const { drawn, bars } = useMemo(
    () => (parts ? stack(columns, parts) : { drawn: null, bars: columns.map((c): Bar => ({ key: c.key, label: c.label, values: [c.value], total: c.value ?? 0, none: c.value === null, est: Boolean(c.estimate) && c.value !== null })) }),
    [columns, parts],
  );
  const n = bars.length;
  const { active, set, keys, local, timed } = useCursor(n, dates, previewIndex);
  const fill = height === 'fill';
  const soFar = running ? n - 1 : -1;
  // The axis labels and the table follow the columns a frame later when the set of them changes (`useSettled`).
  const settled = useSettled(bars.map((b) => b.key).join('\n'));

  // A period with no data has no height, so the scale is the periods that have one. Plain, a value under zero is a
  // fall: the scale goes under zero for it and the column hangs from the zero line (#78). Stacked, parts make a whole.
  const af = axisFormat ?? format;
  const { ticks, low, top, at100, signed, left } = scaleOf(bars.filter((b) => !b.none).map((b) => b.total), !form.parts, whole, af);
  // The gap in pixels at this width, as the rows' own expression resolves it: all of GAP wherever there is room.
  const gap = opens(n).filter((w) => width - left > w).length;
  // A column wide enough for a figure keeps its value above it at rest; a narrower one shows it when pointed at.
  const column = n ? (width - left - gap * (n - 1)) / n : 0;
  const rest = column >= REST;
  const dense = n > DENSE && !signed;
  /** A value as it reads; a period with no data reads the product's word, and "so far" with it while it is running. */
  const value = useCallback((v: number | null, running = false) => (v === null ? (running ? `${noData} so far` : noData) : format(v)), [format, noData]);
  const totalOf = useCallback((b: Bar, i: number) => value(b.none ? null : b.total, i === soFar), [value, soFar]);
  // Moving the cursor re-renders the chart, and no row of its table changes with it, so the rows are built once per data.
  const caption = `${label}${highlight && highlightLabel ? `. ${drawn ? 'Ringed' : 'Accented'}: ${highlightLabel}` : ''}`;
  const table = useMemo(
    () => (settled ? <table className="sr-only">
      <caption>{caption}</caption>
      {drawn ? <thead><tr><th scope="col">Period</th>{drawn.map((p) => <th key={p.key} scope="col">{p.label}</th>)}<th scope="col">Total</th></tr></thead> : null}
      <tbody>
        {bars.map((b, i) => (
          <tr key={b.key}>
            <th scope="row">{b.label}{i === soFar ? ', so far' : null}{b.est ? ', estimate' : null}</th>
            {drawn ? b.values.map((v, k) => <td key={drawn[k].key}>{value(v, b.none && i === soFar)}</td>) : null}
            <td>{totalOf(b, i)}</td>
          </tr>
        ))}
      </tbody>
    </table> : null),
    [settled, caption, drawn, bars, soFar, value, totalOf],
  );

  const at = active !== null && active >= 0 && active < n ? active : null;
  const on = at === null ? null : bars[at];
  // The readout stands after a column in the first half of the plot and before one in the second.
  const after = at !== null && at * 2 < n - 1;
  /** The column pointed at, in words: the table's own order, the first part first. */
  // A period with no data says "so far" in its word, so the reading does not say it twice.
  const reading = on && at !== null
    ? on.none
      ? `${on.label}: ${totalOf(on, at)}`
      : `${on.label}: ${drawn ? `${drawn.map((p, k) => `${p.label} ${value(on.values[k])}`).join(', ')}, Total ${format(on.total)}` : format(on.total)}${at === soFar ? ', so far' : ''}${on.est ? ', estimate' : ''}`
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
        <div className={cn('absolute inset-x-0 top-7', signed ? 'bottom-7' : 'bottom-2')}>
          <Ticks ticks={ticks} at100={at100} af={af} left={left} />
          <div className={cn('absolute inset-y-0 right-0 flex', dense && 'grow-y')} style={{ left, columnGap: gapOf(n) }}>
            {bars.map((b, i) => {
              const pointed = active === i;
              const hot = pointed || (active === null && b.key === highlight);
              const shown = drawn ? drawn.map((p, k) => ({ p, v: b.values[k] ?? 0 })).filter(({ v }) => v > 0) : [];
              const unfinished = i === soFar;
              // A fall hangs from the zero line: it grows down, its round end and its value under it.
              const fall = signed && !b.none && b.total < 0;
              // Plain, the pointed value is the chart's readout and takes the tooltip's plane; stacked, the panel is.
              const tip = pointed && !drawn;
              // At rest a label is held to its column. A running period with no data whose words do not fit says "So far",
              // never "No data…" cut mid-word; the tooltip, the readout, the announcement and the table say it whole (#71).
              const full = totalOf(b, i);
              const text = !tip && b.none && unfinished && full.length * CH > column ? 'So far' : full;
              const plainFill = !b.none && !drawn && !unfinished;
              const valueLabel = rest || pointed ? (
                      // One element at rest and pointed at, so its entrance never replays. At rest the value is held to its
                      // column; the tooltip, and a total shown only on pointing, may be wider than theirs.
                      <span aria-hidden className={cn('pointer-events-none absolute', fall ? 'top-full mt-1' : 'bottom-full mb-1', rest && 'fade-in', tip || !rest ? cn('z-10', placed(i, n)) : 'inset-x-0')}>
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
                          {tip && b.est ? ' · estimate' : null}
                        </span>
                      </span>
              ) : null;
              const share = `${(Math.abs(b.total) / (top - low)) * 100}%`;
              if (dense && plainFill && !b.est) {
                // One element: the bar is its ::before, its share of the scale and never under 2px; the value, when it shows,
                // stands on a box of the bar's height.
                return (
                  <div
                    key={b.key}
                    data-column={b.key}
                    data-active={pointed ? '' : undefined}
                    title={[rest && text.length * 7 > column ? text : null, b.key === highlight ? highlightLabel : null].filter(Boolean).join(' · ') || undefined}
                    className={cn(
                      'group/col relative h-full min-w-0 flex-1 before:absolute before:inset-x-0 before:bottom-(--bar-at) before:h-(--bar-h) before:rounded-t-[4px] before:transition-colors before:duration-(--dur-hover)',
                      b.total !== 0 && 'before:min-h-[2px]',
                      hot ? 'before:bg-accent' : 'before:bg-chart-neutral hover:before:bg-chart-neutral-strong',
                    )}
                    style={{ ['--bar-h' as string]: share, ['--bar-at' as string]: `${at100(0)}%` }}
                    onPointerEnter={() => set(i)}
                    onPointerDown={() => set(i)}
                  >
                    {valueLabel ? <div className={cn('absolute inset-x-0', b.total !== 0 && 'min-h-[2px]')} style={{ bottom: `${at100(0)}%`, height: share }}>{valueLabel}</div> : null}
                  </div>
                );
              }
              return (
                <div
                  key={b.key}
                  data-column={b.key}
                  data-active={pointed ? '' : undefined}
                  data-running={unfinished ? '' : undefined}
                  data-no-data={b.none ? '' : undefined}
                  // A figure wider than its column is cut at rest, and keeps the whole of itself where the pointer finds it.
                  // The accented column says what makes it the one the card is about, beside its figure.
                  title={[rest && text.length * 7 > column ? text : null, b.key === highlight ? highlightLabel : null].filter(Boolean).join(' · ') || undefined}
                  className="group/col relative h-full min-w-0 flex-1"
                  onPointerEnter={() => set(i)}
                  onPointerDown={() => set(i)}
                >
                  {/* The column's box: its share of the scale, and never shorter than its parts and its outline can be drawn. A
                      period with no data has no height: it keeps its slot with a dashed hairline just above the baseline,
                      and its word stands over it where a value would. A track the height of the scale was the tallest mark
                      on the chart, and the eye went to the one period that had nothing to say. */}
                  <div
                    data-box
                    data-fall={fall ? '' : undefined}
                    className="absolute inset-x-0"
                    style={{
                      ...(fall ? { top: `${100 - at100(0)}%` } : { bottom: `${at100(0)}%` }),
                      height: b.none ? '0%' : share,
                      minHeight: (drawn ? Math.max(0, shown.length * 4 - 1) : b.total !== 0 ? 2 : 0) + (unfinished ? 2 : 0),
                    }}
                  >
                    <div
                      // An estimate is hatched over its own fill, so in a dense chart it is drawn as an element of its own.
                      data-estimate={plainFill && b.est ? '' : undefined}
                      className={cn(
                        // A dense chart grows its row as one; a column of its own grows only in a chart that is not.
                        !dense && 'grow-y', 'relative h-full',
                        fall ? 'rounded-b-[4px]' : 'rounded-t-[4px]',
                        // A finished plain column is its own fill: one element fewer a column, in a chart of 52 of them.
                        plainFill && cn('w-full transition-colors duration-(--dur-hover)', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/col:bg-chart-neutral-strong'),
                        drawn && 'transition-[box-shadow] duration-(--dur-hover)',
                        drawn && hot && 'z-1 ring-2 ring-ink',
                        // A period still running: a dashed outline, open at the baseline, around a fill at half strength. The
                        // outline has a pixel of its own and a pixel of the card inside it, so it covers no part and holds
                        // its contrast whatever it surrounds; it is what keeps a faded column a column on a dark card. It
                        // needs 4px of its own; in a narrower column it ends with the column and never runs past the plot.
                        unfinished && cn('ml-[min(0px,calc(100%-4px))] border border-dashed border-ink p-px', fall ? 'border-t-0 pt-0' : 'border-b-0 pb-0'),
                      )}
                      style={{ ['--i' as string]: i, ...(fall ? { transformOrigin: 'center top' } : null) }}
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
                              data-estimate={b.est ? '' : undefined}
                              className={cn('w-full basis-0', k === shown.length - 1 && 'rounded-t-[4px]')}
                              // Shares of the column, so a column of fractions fills its box as a column of millions does.
                              style={{ flexGrow: (v / b.total) * 100, minHeight: 3, backgroundColor: p.color }}
                            />
                          ))}
                        </div>
                      ) : plainFill ? null : (
                        <div data-estimate={b.est ? '' : undefined} className={cn('h-full w-full transition-colors duration-(--dur-hover)', fall ? 'rounded-b-[4px]' : 'rounded-t-[4px]', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/col:bg-chart-neutral-strong', 'opacity-50')} />
                      )}
                    </div>
                    {valueLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {on && at !== null && drawn ? (
          <Readout at={left + at * (column + gap) + (after ? column : 0)} after={after} visible={local || previewIndex !== undefined}>
            <p className="t-eyebrow mb-1.5 break-words">{on.label}{at === soFar ? ' · so far' : null}{on.est ? ' · estimate' : null}</p>
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
      <Labels bars={bars} active={active} width={width} left={left} timed={timed} every={every} settled={settled} estimate={bars.some((b) => b.est)} />
      <p className="sr-only" aria-live="polite">{reading}</p>
      {table}
    </figure>
  );
}
