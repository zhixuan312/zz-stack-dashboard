'use client';

import Link from 'next/link';
import { Badge, Time } from '@/components/ui';
import type { PluginRow } from '@/lib/api-shapes';

type Verdict = NonNullable<PluginRow['latestEval']>;

/**
 * What the last evaluation round concluded about a plugin, in one cell.
 *
 * THE NUMBER FIRST, THEN THE WORD. `keep` and `keep-and-change` are DECISIONS, and they were
 * being read as MEASUREMENTS — "keep" says nothing about whether a plugin is excellent or
 * barely adequate, and a reader who wants to know how good something is cannot get it out of a
 * verb. So the score leads and the recommendation sits under it as the action.
 *
 * THE BAND IS THE COLOUR, and the bands were fixed before any round was read — 8, 6, 4, in
 * `judge-score.ts`. Colouring by an arbitrary cut here would be a second opinion about what
 * "good" means, drawn in a place nobody would think to look for a threshold.
 */

/** Band -> hue. Keyed on the band the platform stored rather than on the number, so the colour
 *  and the label cannot disagree: if a boundary moves in judge-score.ts, the stored band moves
 *  with it and this follows, where a `score >= 8` written here would not. */
const BAND: Record<string, 'sage' | 'amber' | 'rose' | 'neutral'> = {
  'working well': 'sage',
  'working, with a defect worth fixing': 'amber',
  'underperforming, improvement available': 'amber',
  'not effective': 'rose',
  'not measurable': 'neutral',
};

const TONE = {
  sage: 'text-[var(--sage-deep)]',
  amber: 'text-[var(--amber-deep)]',
  rose: 'text-[var(--rose-deep)]',
  neutral: 'text-ink-faint',
} as const;

/** The score alone, at whatever size the caller needs. */
export function EvalScore({ of, className = 'text-lg' }: { of: Verdict; className?: string }) {
  const hue = BAND[of.band ?? ''] ?? 'neutral';
  // NOT MEASURED AND SCORED ZERO ARE DIFFERENT FACTS. A round that predates the platform
  // storing its axes, and a round whose control collapsed, both have no number — and an em dash
  // says so, where a 0 would be a claim nobody made.
  if (of.effectiveness === null) {
    return <span className={`${className} text-ink-faint`} title={of.band ?? 'no score recorded'}>—</span>;
  }
  return (
    <span className={`${className} font-semibold tabular-nums ${TONE[hue]}`} title={of.band ?? ''}>
      {of.effectiveness.toFixed(2)}
      <span className="text-[0.7em] font-normal text-ink-faint"> / 10</span>
    </span>
  );
}

/**
 * The whole verdict as a table cell: score, recommendation, and the way back to the report.
 *
 * THE LINK IS THE POINT OF THE COLUMN. A score with no route to the initiative that produced it
 * is a number a reader has to take on faith — the report is where the bands, the caveats and
 * the "what this does not establish" section live, and those are what make the figure readable.
 * It is absent rather than guessed when the round predates the link being recorded: journal
 * 0116 is the standing record of what inferring one costs.
 */
export function EvalCell({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs italic text-ink-faint">never evaluated</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <EvalScore of={of} className="text-[15px]" />
      <Badge variant={of.recommendation === 'keep' ? 'sage' : 'neutral'}>{of.recommendation}</Badge>
    </span>
  );
}

/**
 * WHEN it was measured, which release it was measured at, and the way into the report.
 *
 * ITS OWN COLUMN, beside the score rather than under it. A date and a score are two facts and
 * a reader scans for them separately — "how good is it" and "how stale is that answer" are
 * different questions, and the second is the one that decides whether to trust the first.
 *
 * THE VERSION IS PART OF THE DATE, not of the score. A round measures one release; the plugin
 * has moved on since if there has been a release in between, and saying which version was on
 * the bench is what stops the number being read as a statement about what is on the shelf now.
 */
export function EvalWhen({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-faint">—</span>;
  const when = (
    <>
      <Time value={of.at} />
      <span className="block text-[11px] text-ink-faint">at v{of.version}</span>
    </>
  );
  // ABSENT, NEVER GUESSED. A round taken before the platform recorded which initiative
  // produced it has no report to point at, and matching one by plugin name and a date window
  // is the attribution journal 0116 exists to forbid. It reads as a date with no link, which
  // is exactly what it is.
  return of.initiative ? (
    <Link
      href={`/initiatives/${of.initiative.team}/${of.initiative.slug}`}
      className="text-accent hover:underline"
      title="open the evaluation that produced this score"
    >
      {when}
    </Link>
  ) : (
    <span className="text-ink-soft">{when}</span>
  );
}
