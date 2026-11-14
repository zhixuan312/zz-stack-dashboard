'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../../../lib/cn';
import { FORMATTERS } from '../../../lib/format';
import { formatDate } from '../../../lib/format-date';
import { Readout } from '../readout';
import { useMeridianIndex } from '../meridian/index';
import { linearPath, monotonePath, stepPath, ticksBetween, type Curve, SERIES_VAR, type SeriesSlot } from '../scale';
import { useSize } from '../use-size';

/**
 * A trend without axes, beside the figure it qualifies. It shows shape, never values, so it carries no labels; when
 * the page's Meridian points at a day, a hairline marks that day, as long as the values are the page's: one for each of
 * the Meridian's dates. A `null` is a day with no value: it keeps its place and breaks the line there, as the Trend
 * chart's does, so a day that was not observed is never drawn as zero. `curve` names the path the line and its area take;
 * `domain` holds the scale, so sparklines side by side are drawn against one range.
 */
export function Sparkline({ values, color = 'accent', height = 36, curve = 'monotone', domain, format = FORMATTERS.count, readout, className }: {
  values: (number | null)[];
  color?: SeriesSlot | 'accent' | 'neutral';
  height?: number;
  curve?: Curve;
  domain?: [number, number];
  /** How the title reads the range: the figure's own format beside it, a count by default. */
  format?: (n: number) => string;
  /**
   * Makes the line readable point by point, for a sparkline that is a view's only series: the reader points at it, or
   * tabs to it and steps with the arrow keys, and reads the value and the day under that point, as the Trend chart's
   * readout does. `label` names what is read ("Requests"), and `format` reads the value, defaulting to `format` (#128).
   * Without it the sparkline is the unlabelled shape it has always been: `aria-hidden` and not interactive.
   */
  readout?: { label: string; format?: (n: number) => string };
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const { index, dates } = useMeridianIndex();
  // Readable, the line is one Tab stop with a readout: the pointer or the arrow keys choose a point (#128). The state is
  // declared here, above every early return, so the hook order never depends on the data.
  const [pointed, setPointed] = useState<number | null>(null);
  const numbers = values.filter((v): v is number => v !== null);
  // Under two numbers there is no shape to draw, and `Math.min()`/`Math.max()` over fewer than two give ±Infinity, so
  // the area path closed into a stray filled triangle. The figure stands alone instead — the README's promise.
  if (numbers.length < 2) return null;
  // The lowest point floats a quarter of the height above the floor, so a trough never runs along a card's edge or
  // into its rounded corner; the area still fills to the floor.
  const H = height, pad = 3, floor = Math.max(pad, Math.round(H * 0.25));
  const lowest = Math.min(...numbers), highest = Math.max(...numbers);
  // A held domain is the range itself: a sparkline has no axis to round to a step. A value outside it widens the range,
  // to nice levels, rather than drawing off the card; the title says so. A domain that is not a range is no domain.
  const held = domain && domain[1] > domain[0] ? domain : null;
  const widened = held && (lowest < held[0] || highest > held[1]);
  const levels = widened ? ticksBetween(Math.min(held[0], lowest), Math.max(held[1], highest)) : null;
  const [min, max] = levels ? [levels[0], levels[levels.length - 1]] : held ?? [lowest, highest];
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const pts = values.map((v, i) => (v === null ? null : [x(i), pad + (1 - (v - min) / span) * (H - pad - floor)] as [number, number]));
  // A day with no value breaks the line: each run of days with one is its own stretch of line and of area, never bridged.
  const runs: [number, number][][] = [[]];
  pts.forEach((p) => (p === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push(p)));
  const segs = W ? runs.filter((r) => r.length > 0) : [];
  const path = curve === 'linear' ? linearPath : curve === 'step' ? stepPath : monotonePath;
  const line = segs.map((r) => path(r)).join('');
  const area = segs.map((r) => `${path(r)}L${r[r.length - 1][0]},${H}L${r[0][0]},${H}Z`).join('');
  const c = SERIES_VAR(color);
  // The page's cursor is this line's only when it has a value for each of the page's dates: the rule a chart joins the
  // Meridian by. Fourteen days of a customer on a page of thirty would otherwise mark the wrong day. A day with no value
  // is still that day: the hairline marks it, and there is no dot to stand on the line.
  const at = index !== null && values.length === dates.length ? { x: x(index), y: pts[index]?.[1] ?? null } : null;
  // A shape with no readout says nothing about what it covers, and it is the one chart a page puts beside a figure
  // without a table under it (issue #94). The range it draws is the words it has, on the pointer: the data's own, the
  // held domain, or, widened, the levels it is drawn to.
  // The readout's format reads the range too, so a line given one names its points and its span in the same units.
  const valueOf = readout?.format ?? format;
  const range = `${valueOf(min)} to ${valueOf(max)}${widened ? `, scale widened from ${valueOf(held[0])}–${valueOf(held[1])}` : ''}`;
  // A sparkline that is a view's only series is otherwise the one series a keyboard or screen-reader user cannot read at
  // all: the line is a shape, and every other chart on such a view is read point by point. With `readout` the line is one
  // Tab stop, the pointer or the arrow keys choose a point, and the readout names the value and, when the values are the
  // page's own dates, the day (#128).
  const readable = Boolean(readout);
  const picked = readable && pointed !== null && pointed >= 0 && pointed < values.length ? pointed : null;
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!readable || !W) return;
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / Math.max(1, W)) * (values.length - 1));
    setPointed(Math.min(values.length - 1, Math.max(0, i)));
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!readable) return;
    const k = e.key;
    if (!values.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') return setPointed(null);
    const cur = picked ?? values.length - 1;
    setPointed(k === 'Home' ? 0 : k === 'End' ? values.length - 1 : Math.min(values.length - 1, Math.max(0, cur + (k === 'ArrowLeft' ? -1 : 1))));
  };
  const readAt = picked === null ? null : values[picked];
  // A day is named only when the values are the page's dates: a 14-day line on a 30-day page has no day for its points.
  const dayOf = (i: number) => (values.length === dates?.length ? formatDate(dates[i]) : '');
  const spoken = picked === null ? '' : readAt === null ? `${dayOf(picked) ? `${dayOf(picked)}: ` : ''}No data` : `${dayOf(picked) ? `${dayOf(picked)}: ` : ''}${readout!.label} ${valueOf(readAt)}`;
  return (
    <>
    <div
      ref={ref}
      {...(readable
        ? {
            role: 'img',
            tabIndex: 0,
            'aria-label': `${range}. Use the arrow keys to read a point.`,
            onPointerMove: pick,
            onPointerDown: pick,
            onPointerLeave: () => setPointed(null),
            onKeyDown: keys,
            onBlur: () => setPointed(null),
            className: cn('relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', className),
          }
        : { 'aria-hidden': true as const, title: range, className })}
      style={{ height }}
    >
      {W ? (
        <svg width={W} height={H} className="block overflow-visible">
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c} style={{ stopOpacity: 'calc(var(--chart-area-a) * 0.7)' }} />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g key={values.length}>
          <path d={area} fill={`url(#${id})`} className="reveal-x" />
          <path d={line} fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />
          </g>
          {at ? (
            <g className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateX(${Math.round(at.x) + 0.5}px)` }}>
              <line x1={0} x2={0} y1={0} y2={H} stroke="var(--ink-3)" strokeOpacity={0.45} />
              {at.y === null ? null : <circle cx={0} cy={0} r={3} className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateY(${at.y}px)` }} fill={c} stroke="var(--surface)" strokeWidth={1.5} />}
            </g>
          ) : null}
        </svg>
      ) : null}
      {readable && picked !== null && W ? (
        // The readout follows the pointer and the keys, and stays inside the card; the announcement is the same words.
        <Readout at={x(picked)} after={x(picked) <= W / 2} top={0} visible>
          <p className="t-eyebrow mb-0.5 break-words">{dayOf(picked) || readout!.label}</p>
          <p className="t-num text-xs font-medium text-ink">{readAt === null ? 'No data' : valueOf(readAt)}</p>
        </Readout>
      ) : null}
    </div>
    {/* Outside the role="img" node: children of role="img" are presentational, so a live region inside it was never
        announced. The paragraph is visually hidden, so the layout is the same. */}
    {readable ? <p className="sr-only" aria-live="polite">{spoken}</p> : null}
    </>
  );
}
