import { cn } from '@/lib/cn';
import { SERIES_VAR } from '@/components/charts/scale';

export type Part = { label: string; value: number; color?: number | 'accent' | 'neutral' | 'neutral-ink' | 'positive' | 'warning' | 'critical' };

const fill = (c: Part['color'], i: number) =>
  c === 'positive' || c === 'warning' || c === 'critical' ? `var(--${c})` : c === 'neutral-ink' ? 'var(--ink-2)' : SERIES_VAR(c ?? i + 1);

/** One whole split into its parts: a single bar with a 2px gap between segments, and a legend that carries the numbers. */
export function CompositionBar({
  parts,
  format = (n) => n.toLocaleString('en-US'),
  label,
  legend = true,
  className,
}: {
  parts: Part[];
  format?: (n: number) => string;
  label: string;
  /** The key under the bar. Off where the bar is a mark inside a tile: hover names each part, and the key stays for screen readers. */
  legend?: boolean;
  className?: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <figure aria-label={label} className={cn('min-w-0', className)}>
      <div className="reveal-x flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, minWidth: 3, background: fill(p.color, i) }} title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <figcaption className={legend ? 'mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4' : 'sr-only'}>
        {parts.map((p, i) => (
          <div key={p.label} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              <span aria-hidden className="size-2 rounded-xs" style={{ background: fill(p.color, i) }} />
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
