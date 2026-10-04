import { cn } from '@/lib/cn';
import type { Tone } from '@/components/ui/badge';

const TONE: Record<Tone, string> = { neutral: 'bg-ink-3 text-ink-3', accent: 'bg-accent text-accent', positive: 'bg-positive text-positive', warning: 'bg-warning text-warning', critical: 'bg-critical text-critical' };

/** A state at a glance, always beside its word. `live` pulses: the one loop allowed outside a skeleton. */
export function StatusDot({ tone = 'neutral', live, className }: { tone?: Tone; live?: boolean; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', TONE[tone], live && 'pulse', className)} />;
}
