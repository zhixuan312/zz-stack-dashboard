'use client';

import { useId } from 'react';
import { useMeridianIndex } from '../meridian/index';
import { monotonePath, SERIES_VAR } from '../scale';
import { useSize } from '../use-size';

/**
 * A trend without axes, beside the figure it qualifies. It shows shape, never values, so it carries no labels; when
 * the page's Meridian points at a day, a hairline marks that day, as long as the values are the page's: one for each of
 * the Meridian's dates. A `null` is a day with no value: it keeps its place and breaks the line there, as the Trend
 * chart's does, so a day that was not observed is never drawn as zero.
 */
export function Sparkline({ values, color = 'accent', height = 36, className }: { values: (number | null)[]; color?: number | 'accent' | 'neutral'; height?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const { index, dates } = useMeridianIndex();
  const numbers = values.filter((v): v is number => v !== null);
  // Under two numbers there is no shape to draw, and `Math.min()`/`Math.max()` over fewer than two give ±Infinity, so
  // the area path closed into a stray filled triangle. The figure stands alone instead — the README's promise.
  if (numbers.length < 2) return null;
  // The lowest point floats a quarter of the height above the floor, so a trough never runs along a card's edge or
  // into its rounded corner; the area still fills to the floor.
  const H = height, pad = 3, floor = Math.max(pad, Math.round(H * 0.25));
  const min = Math.min(...numbers), max = Math.max(...numbers), span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const pts = values.map((v, i) => (v === null ? null : [x(i), pad + (1 - (v - min) / span) * (H - pad - floor)] as [number, number]));
  // A day with no value breaks the line: each run of days with one is its own stretch of line and of area, never bridged.
  const runs: [number, number][][] = [[]];
  pts.forEach((p) => (p === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push(p)));
  const segs = W ? runs.filter((r) => r.length > 0) : [];
  const line = segs.map((r) => monotonePath(r)).join('');
  const area = segs.map((r) => `${monotonePath(r)}L${r[r.length - 1][0]},${H}L${r[0][0]},${H}Z`).join('');
  const c = SERIES_VAR(color);
  // The page's cursor is this line's only when it has a value for each of the page's dates: the rule a chart joins the
  // Meridian by. Fourteen days of a customer on a page of thirty would otherwise mark the wrong day. A day with no value
  // is still that day: the hairline marks it, and there is no dot to stand on the line.
  const at = index !== null && values.length === dates.length ? { x: x(index), y: pts[index]?.[1] ?? null } : null;
  return (
    <div ref={ref} aria-hidden className={className} style={{ height }}>
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
    </div>
  );
}
