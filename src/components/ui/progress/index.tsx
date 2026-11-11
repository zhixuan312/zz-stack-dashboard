import { useId, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { TONE_FILL, type Tone } from '../badge/index';

/**
 * How much of a known whole is done or used: a quota, a rollout, an import. A 6px track in `fill-track` with a fill
 * that grows from the left. The figure beside it says the number; the bar only shows the share.
 */
export function Progress({
  value,
  max = 100,
  label,
  valueLabel,
  tone = 'accent',
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  max?: number;
  /** The figure on the right: "8.2M of 10M". Defaults to the percentage. */
  valueLabel?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
} & (
  | { /** What is measured: "Monthly quota". */ label: ReactNode; 'aria-label'?: undefined }
  // A bar with no label row, as in a table cell, still has a name.
  | { label?: undefined; 'aria-label': string }
)) {
  // Only a finite measurement and a finite positive whole define a share.
  const known = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  const now = known ? Math.max(0, Math.min(max, value)) : undefined;
  const pct = now === undefined ? 0 : (now / max) * 100;
  // A label that is a string names the bar itself; one that is drawn (an icon and words) names it through the element
  // it is, so `role="progressbar"` is never left unnamed.
  const name = useId();
  return (
    <div className={cn('min-w-0', className)}>
      {label !== undefined || valueLabel !== undefined ? (
        <div className="mb-2 flex items-baseline gap-3 text-sm">
          {/* A label the row cuts keeps the whole of itself in its title, when it is words. */}
          <span id={name} title={typeof label === 'string' ? label : undefined} className="min-w-0 flex-1 truncate text-ink-2">{label}</span>
          {/* The bar stops at its whole; the figure says the share it is, 23 of 20 seats reading 115%. */}
          <span className="t-num font-medium">{valueLabel ?? (known ? `${Math.round((value / max) * 100)}%` : '—')}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={known ? max : undefined}
        aria-valuenow={now}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        aria-labelledby={typeof label === 'string' || label === undefined ? undefined : name}
        className={cn('overflow-hidden rounded-full bg-fill-track', size === 'sm' ? 'h-1' : 'h-1.5')}
      >
        <div className={cn('grow-x h-full rounded-full transition-[width] duration-(--dur-enter) ease-(--ease-out)', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * A level against thresholds, in equal segments: usage against a plan, risk, signal strength. The lit segments take
 * the tone of the band the value is in (ok, warning, critical), so the level reads at a glance and the word beside
 * it says it.
 */
export function Meter({
  value,
  segments = 10,
  warnAt = 0.7,
  criticalAt = 0.9,
  label,
  className,
}: {
  /** A share from 0 to 1. */
  value: number;
  segments?: number;
  warnAt?: number;
  criticalAt?: number;
  label: string;
  className?: string;
}) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * segments);
  const tone = value >= criticalAt ? 'bg-critical' : value >= warnAt ? 'bg-warning' : 'bg-positive';
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined} className={cn('flex gap-0.5', className)}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn('h-2 min-w-1 flex-1 rounded-[2px]', i < lit ? tone : 'bg-fill-track')} />
      ))}
    </div>
  );
}
