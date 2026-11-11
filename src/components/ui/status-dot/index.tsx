import { cn } from '../../../lib/cn';
import type { Tone } from '../badge/index';

const TONE: Record<Tone, string> = { neutral: 'bg-ink-3 text-ink-3', accent: 'bg-accent text-accent', positive: 'bg-positive text-positive', warning: 'bg-warning text-warning', critical: 'bg-critical text-critical' };

/**
 * What each tone means in a word, for a dot that carries a state on its own — a list row, a finding, an alert. One map,
 * so the same state is the same word wherever a dot stands without its sentence (#133): an alert and an activity line
 * both say "Needs attention" for the same warning.
 */
export const TONE_WORD: Record<Tone, string> = { neutral: 'For information', accent: 'In progress', positive: 'Went well', warning: 'Needs attention', critical: 'Failed' };

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
