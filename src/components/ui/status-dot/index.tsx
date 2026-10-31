import { cn } from '../../../lib/cn';
import type { Tone } from '../badge/index';

const TONE: Record<Tone, string> = { neutral: 'bg-ink-3 text-ink-3', accent: 'bg-accent text-accent', positive: 'bg-positive text-positive', warning: 'bg-warning text-warning', critical: 'bg-critical text-critical' };

/**
 * A state at a glance, always beside its word. `live` pulses, for a state that is current and wants a look now (a
 * service that is not operational) or a feed that refreshes on its own.
 *
 * Where there is no word beside it — a list row, a finding — the dot is the only thing carrying the state, so it takes
 * one (issue #94): with `label` it is an image to assistive technology rather than a decoration, and the pointer reads
 * the same word. Without one it stays out of the way, which is what a dot beside its word should do.
 */
export function StatusDot({ tone = 'neutral', live, label, className }: { tone?: Tone; live?: boolean; label?: string; className?: string }) {
  const shape = cn('inline-block size-2 shrink-0 rounded-full', TONE[tone], live && 'pulse', className);
  if (label) return <span role="img" aria-label={label} title={label} className={shape} />;
  return <span aria-hidden className={shape} />;
}
