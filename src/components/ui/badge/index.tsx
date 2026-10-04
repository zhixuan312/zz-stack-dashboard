import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';

const TONE: Record<Tone, string> = {
  neutral: 'bg-fill-track text-ink-2',
  accent: 'bg-accent-tint text-accent-ink',
  positive: 'bg-positive-tint text-positive-ink',
  warning: 'bg-warning-tint text-warning-ink',
  critical: 'bg-critical-tint text-critical-ink',
};
const DOT: Record<Tone, string> = { neutral: 'bg-ink-3', accent: 'bg-accent', positive: 'bg-positive', warning: 'bg-warning', critical: 'bg-critical' };

/** A short label for a state or a category. A status badge always says its state in words; the colour only repeats it. */
export function Badge({ tone = 'neutral', dot, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn('inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', TONE[tone], className)}
      {...rest}
    >
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} /> : null}
      {children}
    </span>
  );
}
