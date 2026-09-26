'use client';

import Link from 'next/link';
import { Badge, Time } from '@/components/ui';
import type { PluginRow } from '@/lib/api-shapes';

type Verdict = NonNullable<PluginRow['latestEval']>;

/**
 * What the newest completed evaluation run concluded about a plugin, in three list cells.
 *
 * The same reading the plugin's own page gives (PluginEvalOverview's EvalHeadline): a
 * `not_established` run shows its status word, never a number, whatever the score column holds.
 */

const STATUS_TONE: Record<string, 'sage' | 'amber' | 'neutral'> = {
  established: 'sage', provisional: 'amber', not_established: 'neutral',
};

const shown = (of: Verdict) => of.scoreStatus !== 'not_established' && of.overallScore !== null;

/** The score, or the status word when the run could not establish one. */
export function EvalCell({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs italic text-ink-faint">never evaluated</span>;
  if (!shown(of)) {
    return <span className="text-xs text-ink-faint">{of.scoreStatus ?? 'not_established'}</span>;
  }
  return (
    <span className="text-[15px] font-semibold tabular-nums text-ink">
      {of.overallScore!.toFixed(2)}
      <span className="text-[0.7em] font-normal text-ink-faint"> / 10</span>
    </span>
  );
}

/** How far the number can be trusted, and what the run left open against the plugin. */
export function EvalVerdict({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-faint">—</span>;
  const status = of.scoreStatus ?? 'not_established';
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Badge variant={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
      {of.openDefects ? (
        <span className="text-[11px] tabular-nums text-ink-faint">{of.openDefects} open defect{of.openDefects === 1 ? '' : 's'}</span>
      ) : null}
    </span>
  );
}

/**
 * When it was measured, which release it was measured at, and the way into the evaluation.
 *
 * Its own column, beside the score rather than under it: "how good is it" and "how stale is that
 * answer" are different questions, and the second decides whether to trust the first. The link
 * goes to the plugin's page, whose evaluation panels read the same run.
 */
export function EvalWhen({ of, plugin }: { of: Verdict | null; plugin: string }) {
  if (!of) return <span className="text-xs text-ink-faint">—</span>;
  return (
    <Link href={`/plugins/${plugin}`} className="text-accent hover:underline" title="open this plugin's evaluation">
      <Time value={of.at} />
      <span className="block text-[11px] text-ink-faint">at v{of.version}</span>
    </Link>
  );
}
