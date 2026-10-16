'use client';

import { Badge } from '@/components/ui/badge';
import { When } from '@/console/when';
import type { PluginScore } from '@/lib/destination-shapes';

/**
 * A plugin's latest public score, in three list cells: the score out of 10, how far it can be trusted, and the protocol
 * and date it was scored against. The same selection the platform's Evaluation read makes, so a list and the evaluation
 * page never quote two different latest scores.
 *
 * A `not_established` score shows its standing, never a number: a figure nobody established is not one to quote.
 */

/**
 * A score's standing as the console's tone for it — one map, because the list cells and the evaluation page's
 * headline answer the same question about the same three words, and two copies of that answer would drift.
 */
export const STANDING_TONE: Record<PluginScore['standing'], 'positive' | 'warning' | 'neutral'> = {
  established: 'positive', provisional: 'warning', not_established: 'neutral',
};

/** The standing as a reader says it — `not_established` is an enum, not a word. */
const said = (standing: string) => standing.replace(/_/g, ' ');

/** The score, or a dash when it is not established — the standing beside it already says why. */
export function EvalCell({ of }: { of: PluginScore | null }) {
  if (!of) return <span className="text-xs text-ink-3">never scored</span>;
  if (of.standing === 'not_established') return <span className="text-ink-3" title={said(of.standing)}>—</span>;
  return (
    <span className="text-sm font-semibold tabular-nums text-ink" title={of.lower !== null && of.upper !== null ? `${of.lower.toFixed(1)} to ${of.upper.toFixed(1)}` : undefined}>
      {of.value.toFixed(1)}
      <span className="text-xs font-regular text-ink-3"> / 10</span>
    </span>
  );
}

/** How far the number can be trusted. */
export function EvalVerdict({ of }: { of: PluginScore | null }) {
  if (!of) return <span className="text-xs text-ink-3">—</span>;
  return <Badge tone={STANDING_TONE[of.standing]}>{said(of.standing)}</Badge>;
}

/**
 * When it was scored, and against which protocol: a score belongs to its protocol's version, and two versions' scores
 * are not one series.
 *
 * Its own column, beside the score rather than under it: "how good is it" and "how stale is that answer" are different
 * questions, and the second decides whether to trust the first.
 */
export function EvalWhen({ of }: { of: PluginScore | null }) {
  if (!of) return <span className="text-xs text-ink-3">—</span>;
  return (
    <span className="inline-flex flex-col items-center text-ink-2">
      <When at={of.scoredAt} />
      <span className="block text-2xs text-ink-3">{of.protocol.key ? `${of.protocol.key} ` : 'protocol '}v{of.protocol.version}</span>
    </span>
  );
}
