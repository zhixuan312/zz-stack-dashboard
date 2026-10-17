'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { formatCalendarDate, formatCalendarMonth } from '../../../lib/format-date';
import { useClearMeridian, useMeridianIndex, usePointMeridian } from '../meridian/index';
import { useSize } from '../use-size';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Six steps from nothing to the most: an empty track, then the accent mixed into the surface. */
const STEPS = ['var(--fill-track)', 18, 34, 52, 74, 100].map((s) => (typeof s === 'string' ? s : `color-mix(in oklab, var(--accent) ${s}%, var(--surface))`));
const DAY = 86_400_000;
/** The calendar's measures in pixels: the weekday column, its gap, the space between cells, the smallest cell and the tallest. */
const NAMES = 40, GAP = 8, SPACE = 2, CELL = 12, ROW = 28;
const count = (n: number) => n.toLocaleString('en-US');

type Scale = 'max' | 'quantile';
type Shared = {
  /**
   * How a cell earns its step. `max`: its share of the largest cell. `quantile`: its rank among the cells above zero,
   * five steps of equal count, so one outlier does not flatten the rest; the legend then reads the value the top step starts at.
   */
  scale?: Scale;
  format?: (n: number) => string;
  /** What a cell counts, in the readout and the legend: "requests". */
  unit?: string;
  label: string;
  className?: string;
  /** A state drawn still in the Atlas: `focus` draws the ring the grid takes from the keyboard. */
  'data-preview-state'?: 'focus';
};
type HoursProps = Shared & {
  /** Seven rows (Monday first) of twenty-four hourly values, in the timezone named by `timezone` (UTC by default). */
  values: number[][];
  /**
   * The timezone the hours are cut in, as the readout, the announcement and the table name it: `Asia/Singapore` or
   * `UTC+08:00`. It is a label only: the values are drawn as given.
   */
  timezone?: string;
  /**
   * A cell drawn as pointed at in the Atlas, by its row and its hour (`3-14` is Thursday 14:00), so it names a cell at
   * any width: where the hours group in threes it is the block that holds the hour. Real charts take theirs from the
   * pointer and the keys.
   */
  'data-preview-cell'?: string;
};
type CalendarProps = Shared & {
  /** One value a calendar date (`2026-10-01`), oldest first: a cell a date, a column a week, a row a weekday. */
  days: { date: string; value: number }[];
  /** The last day is still in progress: its cell wears a dashed outline, and its readout and its row in the table say "so far". */
  running?: boolean;
  /** Point the page's Meridian at the day read, when the Meridian holds it. */
  meridian?: boolean;
  /** A day drawn as pointed at in the Atlas (`2026-10-01`); real charts take theirs from the pointer and the keys. */
  'data-preview-date'?: string;
};

/**
 * When the load comes, darker where there is more: a sequential ramp of the accent in six steps, never a rainbow.
 *
 * `values` is a week of hours: weekday by hour, one cell per hour. On a narrow container the hours group in threes, so
 * a cell is never too small to point at. `days` is a calendar: a cell a date, a column a week of Monday to Sunday, as
 * many of the latest weeks as fit at 12px a cell.
 *
 * Either grid is one Tab stop: the arrow keys move a cursor cell by cell (Home and End to the ends of a row, Escape to
 * leave), with the same readout as the pointer, announced to screen readers.
 */
export function Heatmap({ scale = 'max', format = count, unit = 'requests', ...props }: HoursProps | CalendarProps) {
  return 'days' in props ? <Calendar scale={scale} format={format} unit={unit} {...props} /> : <Hours scale={scale} format={format} unit={unit} {...props} />;
}

/**
 * The step each cell earns among the cells ranked: 0 for nothing, then 1 to 5. On `quantile`, of the n cells above
 * zero, a cell with s of them smaller takes ceil((s + 1) × 5 / n), and the cells that hold the largest value take 5: the top
 * step is never empty, so `top`, the smallest value in it, is always there for the legend to read.
 */
function ramp(values: number[], scale: Scale) {
  const ranked = values.filter((v) => v > 0).sort((a, b) => a - b);
  const n = ranked.length, largest = ranked[n - 1];
  // Equal values share one step, the one the lowest of them earns.
  const smaller = new Map<number, number>();
  ranked.forEach((v, i) => { if (!smaller.has(v)) smaller.set(v, i); });
  const step = (v: number) => {
    if (!(v > 0)) return 0;
    if (scale === 'max') return Math.min(5, 1 + Math.floor((v / largest) * 4.999));
    return v === largest ? 5 : Math.ceil((((smaller.get(v) ?? 0) + 1) * 5) / n);
  };
  return { step, top: scale === 'quantile' ? ranked.find((v) => step(v) === 5) : undefined };
}

/**
 * The grid's focus ring, from the keyboard and, drawn still, in the Atlas. On either form it is on the Tab stop, which
 * holds the cells and nothing else: the ring encloses what the keys move through, and the names of rows and columns
 * stand outside it.
 */
const focusRing = (still: boolean) => cn('rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent', still && 'outline-2 outline-offset-4 outline-accent');

/**
 * The readout over the cell pointed at. It fills no measured place: it stands in a row as wide as the grid, between two
 * spacers that share the room left over as the columns before and after its own, so it is flush with the grid's edge at
 * the first column and at the last and never leaves it. Too long for the grid, it breaks between its two halves.
 */
function Readout({ column, columns, children }: { column: number; columns: number; children: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-1.5 flex">
      <span style={{ flexGrow: column }} />
      <div data-readout className="rounded-sm bg-surface-inverse px-2 py-1.5 text-xs text-ink-inverse shadow-overlay">{children}</div>
      <span style={{ flexGrow: columns - 1 - column }} />
    </div>
  );
}

/**
 * The outline of a day in progress, an edge at a time: three pixels on and two off from each corner, clockwise, with
 * antialiasing off. A CSS dashed border is one stroke round the rounded box, fitted to its perimeter and antialiased,
 * so its dashes land on fractions of a pixel and the edges away from where the stroke starts draw fainter.
 */
function Frame() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible" stroke="var(--ink)" strokeDasharray="3 2" shapeRendering="crispEdges">
      <line x1="0" y1="0" x2="100%" y2="0" transform="translate(0 0.5)" />
      <line x1="100%" y1="0" x2="100%" y2="100%" transform="translate(-0.5 0)" />
      <line x1="100%" y1="100%" x2="0" y2="100%" transform="translate(0 -0.5)" />
      <line x1="0" y1="100%" x2="0" y2="0" transform="translate(0.5 0)" />
    </svg>
  );
}

/** The figure's caption: the empty step named in words, then the five steps of the accent from less to more. */
function Legend({ unit, more, children }: { unit: string; more: string; children?: ReactNode }) {
  return (
    <figcaption className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-2xs text-ink-3">
      {children}
      <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px]" style={{ background: STEPS[0] }} />
          No {unit}
        </span>
        <span className="flex items-center gap-2">
          <span>Less</span>
          <span aria-hidden className="flex gap-0.5">
            {STEPS.slice(1).map((s) => <span key={s} className="size-3 rounded-[3px]" style={{ background: s }} />)}
          </span>
          <span>{more}</span>
        </span>
      </span>
    </figcaption>
  );
}

function Hours({ values, timezone = 'UTC', scale, format, unit, label, className, 'data-preview-state': previewState, 'data-preview-cell': previewCell }: HoursProps & Required<Pick<Shared, 'scale' | 'format' | 'unit'>>) {
  const [box, { width }] = useSize<HTMLElement>();
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const group = width > 0 && width < 560 ? 3 : 1;
  const cols = 24 / group;
  const grid = values.map((row) => Array.from({ length: cols }, (_, c) => row.slice(c * group, c * group + group).reduce((a, b) => a + b, 0)));
  // The cells ranked are the cells drawn: grouped in threes, a block is ranked as one.
  const { step, top } = ramp(grid.flat(), scale);
  const hourLabel = (c: number) => String(c * group).padStart(2, '0');
  const range = (c: number) => (group === 1 ? `${hourLabel(c)}:00` : `${hourLabel(c)}:00–${String(c * group + group).padStart(2, '0')}:00`);

  /** Point at a cell, from the pointer or the keyboard. */
  const point = (d: number, h: number) => setHover({ d, h });
  const [pd, ph] = (previewCell ?? '').split('-').map(Number);
  const still = previewCell !== undefined && values[pd]?.[ph] !== undefined ? { d: pd, h: Math.floor(ph / group) } : null;
  // A cursor placed on 24 columns is not on the grid when the hours regroup into 8.
  const cursor = hover && hover.h < cols ? hover : null;
  const on = still ?? cursor;
  const keys = (e: KeyboardEvent) => {
    const at = cursor ?? { d: 0, h: 0 };
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (e.key === 'Escape') return setHover(null);
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); return point(at.d, e.key === 'Home' ? 0 : cols - 1); }
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    if (!cursor) return point(0, 0);
    point(Math.min(6, Math.max(0, at.d + m[0])), Math.min(cols - 1, Math.max(0, at.h + m[1])));
  };

  return (
    <figure ref={box} aria-label={label} data-preview-cell={previewCell} className={cn('relative min-w-0', className)} onPointerLeave={() => setHover(null)}>
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2">
        <div />
        <div aria-hidden className="mb-2 grid text-2xs text-ink-3 tabular-nums" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="text-left">{(c * group) % 6 === 0 ? hourLabel(c) : ''}</span>
          ))}
        </div>
        {/* Each name is as tall as the row of cells it stands beside, and as far from the next. */}
        <div aria-hidden className="flex flex-col gap-0.5 text-2xs text-ink-3">
          {grid.map((_, d) => <span key={d} className="flex h-6 items-center sm:h-7">{DAYS[d]}</span>)}
        </div>
        <div
          role="group"
          tabIndex={0}
          aria-label={`${label}. Use the arrow keys to read one ${group === 1 ? 'hour' : 'three-hour block'}.`}
          onKeyDown={keys}
          onBlur={() => setHover(null)}
          className={cn('flex min-w-0 flex-col gap-0.5', focusRing(previewState === 'focus'))}
        >
        {grid.map((row, d) => (
          <div key={d} className="relative grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {row.map((v, c) => {
              const ringed = on?.d === d && on.h === c;
              return (
                <span
                  key={c}
                  aria-hidden
                  data-cell={`${d}-${c}`}
                  data-step={step(v)}
                  onPointerEnter={() => point(d, c)}
                  className={cn('h-6 rounded-xs transition-[box-shadow] duration-(--dur-hover) sm:h-7', ringed && 'ring-2 ring-ink ring-offset-1 ring-offset-surface')}
                  style={{ background: STEPS[step(v)] }}
                />
              );
            })}
            {on?.d === d ? (
              <Readout column={on.h} columns={cols}>
                <span className="font-medium whitespace-nowrap">{format(row[on.h])} {unit}</span>
                <span className="whitespace-nowrap opacity-70"> · {DAYS[d]} {range(on.h)} {timezone}</span>
              </Readout>
            ) : null}
          </div>
        ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{on ? `${DAYS[on.d]} ${range(on.h)} ${timezone}: ${format(grid[on.d][on.h])} ${unit}` : ''}</p>
      <Legend unit={unit} more={top === undefined ? 'More' : `${format(top)} or more`} />
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Day ({timezone})</th>{Array.from({ length: 24 }, (_, h) => <th key={h}>{String(h).padStart(2, '0')}:00</th>)}</tr></thead>
        <tbody>{values.map((row, d) => <tr key={d}><th>{DAYS[d]}</th>{row.map((v, h) => <td key={h}>{format(v)}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}

/** A calendar date is a day, not an instant: its number counts whole days from its own year, month and day, whatever the product's timezone. */
const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY;

function Calendar({ days, running = false, meridian = false, scale, format, unit, label, className, 'data-preview-state': previewState, 'data-preview-date': previewDate }: CalendarProps & Required<Pick<Shared, 'scale' | 'format' | 'unit'>>) {
  const [box, { width }] = useSize<HTMLElement>();
  const [cursor, setCursor] = useState<string | null>(null);
  const { dates: held } = useMeridianIndex();
  const pointPage = usePointMeridian();
  const clearPage = useClearMeridian();

  // Every day given is ranked and placed in its own week, shown or not, so a day keeps its step at any width.
  const all = useMemo(() => {
    const { step, top } = ramp(days.map((d) => d.value), scale);
    // Day 0, 1 Jan 1970, was a Thursday: three days on, a week starts on a Monday and Monday is row 0.
    const placed = days.map((d, i) => {
      const n = dayNumber(d.date), week = Math.floor((n + 3) / 7);
      return { ...d, n, week, row: n + 3 - week * 7, step: step(d.value), running: running && i === days.length - 1 };
    });
    return { placed, top, weeks: placed.length ? placed[placed.length - 1].week - placed[0].week + 1 : 0 };
  }, [days, scale, running]);

  // A cell is never under 12px: the latest weeks that fit beside the weekday names. Before the figure is measured every
  // week is drawn at 12px or more and the earliest are clipped, so the grid keeps its height when the width arrives.
  const fit = Math.floor((width - NAMES - GAP + SPACE) / (CELL + SPACE));
  const weeks = width > 0 ? Math.min(all.weeks, Math.max(1, fit)) : all.weeks;
  const view = useMemo(() => {
    const from = all.placed.length ? all.placed[all.placed.length - 1].week - weeks + 1 : 0;
    const shown = all.placed.filter((d) => d.week >= from).map((d) => ({ ...d, col: d.week - from }));
    // A month is named above the column that holds its first day; the first column too, unless the next name is too close to stand beside.
    const months = shown.filter((d) => d.date.endsWith('-01'));
    if (shown.length && months[0] !== shown[0] && (!months.length || months[0].col >= 3)) months.unshift(shown[0]);
    return { shown, months, byDate: new Map(shown.map((d) => [d.date, d])), byNumber: new Map(shown.map((d) => [d.n, d])) };
  }, [all, weeks]);

  const { shown, byDate, byNumber } = view;
  const on = byDate.get(previewDate ?? cursor ?? '');
  const columns = `repeat(${Math.max(1, weeks)}, minmax(var(--space-3), 1fr))`;
  // Seven names need 16px a row; a shorter cell names Monday, Wednesday and Friday.
  const seven = width > 0 && Math.min(ROW, (width - NAMES - GAP - SPACE * (weeks - 1)) / Math.max(1, weeks)) + SPACE >= 16;
  const reading = (d: { date: string; value: number; running: boolean }) => `${format(d.value)} ${unit}${d.running ? ' so far' : ''}`;

  /** Point at a day, from the pointer or the keyboard, and at the same day on the page's Meridian when it holds it. */
  const point = (date: string) => {
    setCursor(date);
    if (!meridian) return;
    if (held.includes(date)) pointPage(date);
    else clearPage();
  };
  const letGo = () => {
    if (cursor === null) return;
    setCursor(null);
    if (meridian) clearPage();
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return letGo();
    const move = ({ ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as Record<string, number | undefined>)[e.key];
    if (move === undefined && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const at = byDate.get(cursor ?? '');
    // The first key only places the cursor, on the latest day.
    if (!at) return shown.length ? point(shown[shown.length - 1].date) : undefined;
    const row = shown.filter((d) => d.row === at.row);
    // Up and Down stay inside the week; a move with no day to land on leaves the cursor where it is.
    const to = move === undefined ? row[e.key === 'Home' ? 0 : row.length - 1] : Math.abs(move) === 1 && (at.row + move < 0 || at.row + move > 6) ? undefined : byNumber.get(at.n + move);
    if (to) point(to.date);
  };

  const table = useMemo(
    () => (
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Date</th><th>{unit.charAt(0).toUpperCase() + unit.slice(1)}</th></tr></thead>
        <tbody>{all.placed.map((d) => <tr key={d.date}><th>{formatCalendarDate(d.date)}</th><td>{format(d.value)}{d.running ? ' so far' : ''}</td></tr>)}</tbody>
      </table>
    ),
    [all, format, label, unit],
  );

  return (
    <figure ref={box} aria-label={label} data-preview-date={previewDate} className={cn('relative min-w-0', className)} onPointerLeave={letGo}>
      {shown.length ? (
        <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2">
          <div aria-hidden className="flex flex-col text-2xs text-ink-3">
            <span className="mb-2 h-4" />
            {/* Out of the flow, so a name taller than a 12px cell never stretches the rows it stands beside. */}
            <div className="relative flex-1">
              <div className="absolute inset-0 grid grid-rows-7 gap-y-0.5">
                {DAYS.map((d, r) => <span key={d} className="flex items-center leading-none">{seven || r === 0 || r === 2 || r === 4 ? d : null}</span>)}
              </div>
            </div>
          </div>
          <div className={cn('min-w-0', width === 0 && 'overflow-hidden')}>
            <div aria-hidden className="mb-2 grid h-4 justify-end gap-x-0.5 text-2xs leading-4 text-ink-3" style={{ gridTemplateColumns: columns }}>
              {view.months.map((d) => (
                // The last column's name ends with its column, so it never runs past the grid.
                <span key={d.date} data-month={d.date.slice(0, 7)} data-col={d.col} className={cn('whitespace-nowrap', d.col > 0 && d.col === weeks - 1 ? 'justify-self-end' : 'justify-self-start')} style={{ gridColumn: d.col + 1, gridRow: 1 }}>
                  {formatCalendarMonth(d.date)}
                </span>
              ))}
            </div>
            <div
              role="group"
              tabIndex={0}
              aria-label={`${label}. Use the arrow keys to read one day.`}
              onKeyDown={keys}
              onBlur={letGo}
              className={cn('relative grid grid-rows-7 justify-end gap-0.5', focusRing(previewState === 'focus'))}
              style={{ gridTemplateColumns: columns }}
            >
              {shown.map((d) => (
                <span
                  key={d.date}
                  aria-hidden
                  data-cell={d.date}
                  data-col={d.col}
                  data-row={d.row}
                  data-step={d.step}
                  data-running={d.running ? '' : undefined}
                  onPointerEnter={() => point(d.date)}
                  className={cn(
                    'aspect-square max-h-7 w-full rounded-[3px] transition-[box-shadow] duration-(--dur-hover)',
                    // A day in progress: a dashed frame on the card, where it holds its contrast whatever the step, around a smaller fill.
                    d.running && 'relative bg-clip-content p-0.5',
                    on?.date === d.date && 'relative z-1 ring-2 ring-ink ring-offset-1 ring-offset-surface',
                  )}
                  style={{ gridColumn: d.col + 1, gridRow: d.row + 1, backgroundColor: STEPS[d.step] }}
                >
                  {d.running ? <Frame /> : null}
                </span>
              ))}
              {on ? (
                // The readout stands over its day's row: a grid item across every week, with nothing in the flow.
                <div aria-hidden className="pointer-events-none relative col-span-full" style={{ gridRow: on.row + 1 }}>
                  <Readout column={on.col} columns={weeks}>
                    <span className="whitespace-nowrap opacity-70">{formatCalendarDate(on.date)} · </span>
                    <span className="font-medium whitespace-nowrap">{reading(on)}</span>
                  </Readout>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{on ? `${formatCalendarDate(on.date)} · ${reading(on)}` : ''}</p>
      <Legend unit={unit} more={all.top === undefined ? 'More' : `${format(all.top)} or more`}>
        {weeks < all.weeks ? <span data-weeks className="mr-auto">The latest {weeks} of {all.weeks} weeks</span> : null}
      </Legend>
      {table}
    </figure>
  );
}
