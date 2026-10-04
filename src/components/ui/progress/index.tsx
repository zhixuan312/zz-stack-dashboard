import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/components/ui/badge';

const FILL: Record<Tone, string> = { neutral: 'bg-ink-3', accent: 'bg-accent', positive: 'bg-positive', warning: 'bg-warning', critical: 'bg-critical' };

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
}: {
  value: number;
  max?: number;
  /** What is measured: "Monthly quota". */
  label?: ReactNode;
  /** The figure on the right: "8.2M of 10M". Defaults to the percentage. */
  valueLabel?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={cn('min-w-0', className)}>
      {label !== undefined || valueLabel !== undefined ? (
        <div className="mb-2 flex items-baseline gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink-2">{label}</span>
          <span className="t-num font-medium">{valueLabel ?? `${Math.round(pct)}%`}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('overflow-hidden rounded-full bg-fill-track', size === 'sm' ? 'h-1' : 'h-1.5')}
      >
        <div className={cn('grow-x h-full rounded-full', FILL[tone])} style={{ width: `${pct}%` }} />
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
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} className={cn('flex gap-0.5', className)}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn('h-2 min-w-1 flex-1 rounded-[2px]', i < lit ? tone : 'bg-fill-track')} />
      ))}
    </div>
  );
}
