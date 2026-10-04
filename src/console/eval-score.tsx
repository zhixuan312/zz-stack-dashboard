'use client';

import { Badge } from '@/components/ui/badge';
import { When } from '@/console/when';
import type { PluginRow } from '@/lib/api-shapes';

type Verdict = NonNullable<PluginRow['latestEval']>;

/**
 * What the newest completed evaluation run concluded about a plugin, in three list cells.
 *
 * The same reading the plugin's own page gives (PluginEvalOverview's EvalHeadline): a
 * `not_established` run shows its status word, never a number, whatever the score column holds.
 */

const STATUS_TONE: Record<string, 'positive' | 'warning' | 'neutral'> = {
  established: 'positive', provisional: 'warning', not_established: 'neutral',
};

/** The status as a reader says it — `not_established` is an enum, not a word. */
const said = (status: string) => status.replace(/_/g, ' ');

const shown = (of: Verdict) => of.scoreStatus !== 'not_established' && of.overallScore !== null;

/** The score, or a dash when the run could not establish one — the status column beside it
 *  already says why, and the same word in two adjacent cells is one fact twice. */
export function EvalCell({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-3">never evaluated</span>;
  if (!shown(of)) {
    return <span className="text-ink-3" title={said(of.scoreStatus ?? 'not_established')}>—</span>;
  }
  return (
    <span className="text-sm font-semibold tabular-nums text-ink">
      {of.overallScore!.toFixed(2)}
      <span className="text-xs font-regular text-ink-3"> / 10</span>
    </span>
  );
}

/** How far the number can be trusted, and what the run left open against the plugin. */
export function EvalVerdict({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-3">—</span>;
  const status = of.scoreStatus ?? 'not_established';
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{said(status)}</Badge>
      {of.openDefects ? (
        <span className="text-2xs tabular-nums text-ink-3">{of.openDefects} open defect{of.openDefects === 1 ? '' : 's'}</span>
      ) : null}
    </span>
  );
}

/**
 * When it was measured, and which release it was measured at.
 *
 * Its own column, beside the score rather than under it: "how good is it" and "how stale is that
 * answer" are different questions, and the second decides whether to trust the first.
 */
export function EvalWhen({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-3">—</span>;
  return (
    <span className="inline-flex flex-col items-center text-ink-2">
      <When at={of.at} />
      <span className="block text-2xs text-ink-3">at v{of.version}</span>
    </span>
  );
}
