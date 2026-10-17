import { cn } from '../../../lib/cn';
import { SERIES_VAR, stackPart } from '../scale';

export type Part = { label: string; value: number; color?: number | 'accent' | 'neutral' | 'neutral-ink' | 'positive' | 'warning' | 'critical' };

const fill = (c: Part['color'], i: number, stack: number | null) =>
  c === 'positive' || c === 'warning' || c === 'critical' ? `var(--${c})` : c === 'neutral-ink' ? 'var(--ink-2)' : c === undefined && stack !== null ? stackPart(i, stack) : SERIES_VAR(c ?? i + 1);

/** One whole split into its parts: a single bar with a 2px gap between segments, and a legend that carries the numbers. */
export function CompositionBar({
  parts,
  format = (n) => n.toLocaleString('en-US'),
  label,
  legend = true,
  stacked = false,
  className,
}: {
  parts: Part[];
  format?: (n: number) => string;
  label: string;
  /** The key under the bar. Off where the bar is a mark inside a tile: hover names each part, and the key stays for screen readers. */
  legend?: boolean;
  /** The parts are the parts a stacked chart on the same page draws: a part with no colour takes the one-hue stack by
   *  its place, as the stacked Trend and Column charts draw it, so a part is one colour wherever it is drawn. */
  stacked?: boolean;
  className?: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const stack = stacked ? parts.length : null;
  return (
    <figure aria-label={label} className={cn('@container min-w-0', className)}>
      <div className="reveal-x flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, minWidth: 3, background: fill(p.color, i, stack) }} title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <figcaption className={legend ? 'mt-4 grid grid-cols-2 gap-x-6 gap-y-3 @min-[36rem]:grid-cols-4' : 'sr-only'}>
        {parts.map((p, i) => (
          <div key={p.label} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              {/* A stacked part fades toward the surface, so its swatch is drawn on a hairline, as the stacked charts' are. */}
              <span aria-hidden className={cn('size-2 rounded-xs', stacked && 'ring-1 ring-ink-3')} style={{ background: fill(p.color, i, stack) }} />
              {p.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="t-num text-sm font-medium">{((p.value / total) * 100).toFixed(p.value / total < 0.1 ? 1 : 0)}%</span>
              <span className="t-num t-caption">{format(p.value)}</span>
            </div>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
