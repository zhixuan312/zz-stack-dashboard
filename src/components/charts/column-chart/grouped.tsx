'use client';

import { useCallback, useMemo } from 'react';
import { cn } from '../../../lib/cn';
import { Readout } from '../readout';
import { SERIES_SLOTS, SERIES_VAR, type SeriesSlot } from '../scale';
import { useSettled } from '../use-settled';
import { useSize } from '../use-size';
import { FORMATTERS } from '../../../lib/format';
import { CH, gapOf, Labels, opens, REST, scaleOf, Swatch, Ticks, useCursor, type GroupedPart, type Shared, type StackedColumn } from './shared';

export type GroupedColumnsProps = Shared & { columns: StackedColumn[]; parts: GroupedPart[]; grouped: true };

/**
 * The Column chart's grouped form: each column is a group of parts that are identities, In and Out or this year and
 * last, standing side by side with 1px of the card between them, each in its categorical slot. They are not a whole,
 * so nothing is summed: the axis is every part's value, under zero too, and no Total is drawn or read. A part with no
 * data keeps its slot with the dashed no-data hairline on the zero line and reads `noData`, over it at rest too, so it never
 * reads as a zero. Loaded on demand by `ColumnChart` when it is passed `grouped`.
 */
export function GroupedColumns({
  highlight,
  highlightLabel,
  dates,
  running = false,
  format = FORMATTERS.count,
  noData = 'No data',
  whole = false,
  axisFormat,
  domain,
  height = 200,
  label,
  labelEvery: every,
  'data-preview-index': previewIndex,
  className,
  columns,
  parts,
}: GroupedColumnsProps) {
  const [box, { width }] = useSize<HTMLElement>();
  const n = columns.length;
  const { active, set, keys, local, timed } = useCursor(n, dates, previewIndex);
  const fill = height === 'fill';
  const soFar = running ? n - 1 : -1;
  const settled = useSettled(columns.map((c) => c.key).join('\n'));
  // Each part takes its slot in order; one past the sixth has none, and is neutral, as a stack's Other is.
  const colors = parts.map((p, k) => SERIES_VAR(p.color ?? (k < SERIES_SLOTS ? ((k + 1) as SeriesSlot) : 'neutral')));
  const bars = useMemo(() => columns.map((c) => {
    const values = parts.map((_, k) => c.values[k] ?? null);
    const none = values.every((v) => v === null);
    return { key: c.key, label: c.label, values, none, est: Boolean(c.estimate) && !none };
  }), [columns, parts]);

  const af = axisFormat ?? format;
  const { ticks, low, top, at100, left, widened } = scaleOf(bars.flatMap((b) => b.values.filter((v): v is number => v !== null)), true, whole, af, domain);
  const gap = opens(n).filter((w) => width - left > w).length;
  const column = n ? (width - left - gap * (n - 1)) / n : 0;
  // A part's bar wide enough for a figure keeps its value above it at rest; a narrower one is read when pointed at.
  const bar = (column - (parts.length - 1)) / Math.max(1, parts.length);
  const rest = bar >= REST;
  const value = useCallback((v: number | null, running = false) => (v === null ? (running ? `${noData} so far` : noData) : format(v)), [format, noData]);
  // Moving the cursor re-renders the chart, and no row of its table changes with it, so the rows are built once per data.
  const caption = `${label}${highlight && highlightLabel ? `. Ringed: ${highlightLabel}` : ''}${widened ? `. ${widened}` : ''}`;
  const table = useMemo(
    () => (settled ? <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Period</th>{parts.map((p) => <th key={p.key} scope="col">{p.label}</th>)}</tr></thead>
      <tbody>
        {bars.map((b, i) => (
          <tr key={b.key}>
            <th scope="row">{b.label}{i === soFar ? ', so far' : null}{b.est ? ', estimate' : null}</th>
            {b.values.map((v, k) => <td key={parts[k].key}>{value(v, b.none && i === soFar)}</td>)}
          </tr>
        ))}
      </tbody>
    </table> : null),
    [settled, caption, parts, bars, soFar, value],
  );

  const at = active !== null && active >= 0 && active < n ? active : null;
  const on = at === null ? null : bars[at];
  const after = at !== null && at * 2 < n - 1;
  const reading = on && at !== null
    ? `${on.label}: ${on.none ? value(null, at === soFar) : `${parts.map((p, k) => `${p.label} ${value(on.values[k])}`).join(', ')}${at === soFar ? ', so far' : ''}`}${on.est ? ', estimate' : ''}`
    : null;

  return (
    <figure ref={box} data-grouped aria-label={label} className={cn('relative min-w-0 select-none', fill && 'flex min-h-55 flex-1 flex-col', className)} onPointerLeave={() => set(null)}>
      <ul data-legend aria-hidden className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" style={{ paddingLeft: left }}>
        {parts.map((p, k) => <li key={p.key} className="flex items-center gap-1.5"><Swatch color={colors[k]} />{p.label}</li>)}
      </ul>
      {/* A held scale that had to take a part outside it says so, as the Trend chart does. */}
      {widened ? <p data-widened className="mb-1 text-2xs text-ink-3" style={{ paddingLeft: left }}>{widened}</p> : null}
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
        {/* The scale stands inside the plot's box as the other forms' does: 28px over the top tick for a value, and 28px
            under the lowest for a fall's when the scale goes under zero. */}
        <div className={cn('absolute inset-x-0 top-7', low < 0 ? 'bottom-7' : 'bottom-2')}>
          <Ticks ticks={ticks} at100={at100} af={af} left={left} />
          <div className="absolute inset-y-0 right-0 flex" style={{ left, columnGap: gapOf(n) }}>
            {bars.map((b, i) => {
              const pointed = active === i;
              const hot = pointed || (active === null && b.key === highlight);
              const unfinished = i === soFar;
              // The group's box spans its tallest rise and its deepest fall, so the ring and the outline frame its bars.
              const read = b.values.filter((v): v is number => v !== null);
              const hi = Math.max(0, ...read), lo = Math.min(0, ...read);
              const span = hi - lo || 1;
              const zero = (-lo / span) * 100;
              const full = value(null, unfinished);
              return (
                <div
                  key={b.key}
                  data-column={b.key}
                  data-active={pointed ? '' : undefined}
                  data-running={unfinished ? '' : undefined}
                  data-no-data={b.none ? '' : undefined}
                  title={[b.none && column >= REST && full.length * 7 > column ? full : null, b.key === highlight ? highlightLabel : null].filter(Boolean).join(' · ') || undefined}
                  className="relative h-full min-w-0 flex-1"
                  onPointerEnter={() => set(i)}
                  onPointerDown={() => set(i)}
                >
                  <div
                    data-box
                    className={cn('absolute inset-x-0 transition-[box-shadow] duration-(--dur-hover)', hot && 'z-1 ring-2 ring-ink')}
                    style={{ bottom: `${at100(lo)}%`, height: `${((hi - lo) / (top - low)) * 100}%`, minHeight: unfinished ? 2 : 0 }}
                  >
                    {b.none ? (
                      <>
                        <div data-no-data-mark aria-hidden className="absolute inset-x-0 bottom-0.5 border-t border-dashed border-line-strong" />
                        {column >= REST ? (
                          <span aria-hidden className="fade-in t-num pointer-events-none absolute inset-x-0 bottom-full mb-1 block truncate text-center text-2xs leading-4 text-ink-3">
                            <span data-value>{unfinished && full.length * CH > column ? 'So far' : full}</span>
                          </span>
                        ) : null}
                      </>
                    ) : (
                      // A period still running: one dashed outline around the group, open at the baseline, its bars at half
                      // strength inside it, as the other forms draw it.
                      <div className={cn('relative flex h-full gap-px', unfinished && cn('ml-[min(0px,calc(100%-4px))] border border-dashed border-ink p-px', lo === 0 ? 'border-b-0 pb-0' : hi === 0 && 'border-t-0 pt-0'))}>
                        {b.values.map((v, k) => {
                          const share = v === null ? 0 : (Math.abs(v) / span) * 100;
                          const fall = v !== null && v < 0;
                          const edge = fall ? { top: `${100 - zero}%` } : { bottom: `${zero}%` };
                          return (
                            // A figure wider than its bar is cut at rest, and keeps the whole of itself where the pointer finds it.
                            <div key={parts[k].key} title={rest && value(v, unfinished).length * 7 > bar ? value(v, unfinished) : undefined} className="relative h-full min-w-0 flex-1">
                              {v === null ? (
                                <>
                                  <div data-no-data-mark aria-hidden className="absolute inset-x-0 mb-0.5 border-t border-dashed border-line-strong" style={{ bottom: `${zero}%` }} />
                                  {rest ? (
                                    // Never told by its hairline alone: the words stand over it at rest, as a column with no
                                    // data's do, and "So far" when a running part's would be cut.
                                    <span aria-hidden className="fade-in t-num pointer-events-none absolute inset-x-0 mb-1 block truncate text-center text-2xs leading-4 text-ink-3" style={{ bottom: `${zero}%` }}>
                                      <span data-value>{unfinished && value(null, true).length * CH > bar ? 'So far' : value(null, unfinished)}</span>
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <div
                                    data-part={parts[k].key}
                                    data-fall={fall ? '' : undefined}
                                    data-estimate={b.est ? '' : undefined}
                                    className={cn('grow-y absolute inset-x-0', fall ? 'rounded-b-[4px]' : 'rounded-t-[4px]', v !== 0 && 'min-h-[2px]', unfinished && 'opacity-50')}
                                    style={{ ...edge, height: `${share}%`, backgroundColor: colors[k], ['--i' as string]: i, ...(fall ? { transformOrigin: 'center top' } : null) }}
                                  />
                                  {rest ? (
                                    <span
                                      aria-hidden
                                      className={cn('fade-in t-num pointer-events-none absolute inset-x-0 block truncate text-center text-2xs leading-4', fall ? 'mt-1' : 'mb-1', pointed ? 'font-medium text-ink' : 'text-ink-3')}
                                      style={fall ? { top: `${100 - zero + share}%` } : { bottom: `${zero + share}%` }}
                                    >
                                      <span data-value>{format(v)}</span>
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {on && at !== null ? (
          <Readout at={left + at * (column + gap) + (after ? column : 0)} after={after} visible={local || previewIndex !== undefined}>
            <p className="t-eyebrow mb-1.5 break-words">{on.label}{at === soFar ? ' · so far' : null}{on.est ? ' · estimate' : null}</p>
            {/* The parts in the order they stand, from the left, and no total: identities are not a whole. */}
            {parts.map((p, k) => (
              <p key={p.key} className="flex flex-wrap items-start gap-x-2 text-xs leading-6">
                <Swatch color={colors[k]} className="mt-1.75" />
                <span className="min-w-0 flex-1 break-words text-ink-2">{p.label}</span>
                <span className="t-num ml-auto min-w-0 break-words font-medium text-ink">{value(on.values[k], on.none && at === soFar)}</span>
              </p>
            ))}
          </Readout>
        ) : null}
      </div>
      <Labels bars={bars} active={active} width={width} left={left} timed={timed} every={every} settled={settled} estimate={bars.some((b) => b.est)} />
      <p className="sr-only" aria-live="polite">{reading}</p>
      {table}
    </figure>
  );
}
