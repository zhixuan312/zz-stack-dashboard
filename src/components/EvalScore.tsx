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
  working: 'sage',
  'working poorly': 'amber',
  'not working': 'rose',
  'not measurable': 'neutral',
};

/** The second axis. `no change needed` is the GOOD outcome on this axis and is coloured as
 *  one — it says the plugin needs nothing, which is a finding rather than an absence. The
 *  other three are not degrees of bad: `change identified` means there is a next move on the
 *  record, and `unexplained gap` means nobody has said why the score is short, which is the
 *  one state where the right move is to find out rather than to act. Neither is a failure. */
const STATE: Record<string, 'sage' | 'amber' | 'neutral'> = {
  'no change needed': 'sage',
  'change identified': 'neutral',
  'unexplained gap': 'amber',
  'not measured': 'neutral',
};

const TONE = {
  sage: 'text-[var(--sage-deep)]',
  amber: 'text-[var(--amber-deep)]',
  rose: 'text-[var(--rose-deep)]',
  neutral: 'text-ink-faint',
} as const;

/** The score alone, at whatever size the caller needs. */
export function EvalScore({ of, className = 'text-lg' }: { of: Verdict; className?: string }) {
  const hue = BAND[of.band] ?? 'neutral';
  // NOT MEASURED AND SCORED ZERO ARE DIFFERENT FACTS. A round that predates the platform
  // storing its axes, and a round whose control collapsed, both have no number — and an em dash
  // says so, where a 0 would be a claim nobody made.
  if (of.effectiveness === null) {
    return <span className={`${className} text-ink-faint`} title={of.band}>—</span>;
  }
  return (
    <span className={`${className} font-semibold tabular-nums ${TONE[hue]}`} title={of.band}>
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
      {/* THE BAND, NOT THE RECOMMENDATION. This column is called "Eval score" and it used to
          carry `keep` / `keep-and-change` under the number — which is a DECISION, in a
          different vocabulary, sitting where the score's own word belongs. That is the exact
          confusion the two-axis design exists to remove: a verb was being read as a
          measurement. The band is what 9.08 MEANS; the verdict is what to do about it, and it
          has its own column now. */}
      <span className="text-[11px] leading-tight text-ink-faint">{of.band}</span>
    </span>
  );
}

/** WHAT IS LEFT TO DO — the second axis, never a verdict on the plugin.
 *
 *  This column showed `keep` / `keep-and-change` until 0.60.0. That was a DECISION from a
 *  closed set, sitting beside a measurement, and the question it answered has one permanent
 *  answer: somebody installs a plugin for a reason and keeps it. It now shows what the
 *  evidence says about the gap, and how many named changes are open behind that state. */
export function EvalVerdict({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-faint">—</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Badge variant={STATE[of.headroomState] ?? 'neutral'}>{of.headroomState}</Badge>
      {of.headroomNamed ? (
        <span className="text-[11px] tabular-nums text-ink-faint">
          {of.headroomNamed} named
        </span>
      ) : of.headroomPoints !== null ? (
        <span className="text-[11px] tabular-nums text-ink-faint">
          {of.headroomPoints.toFixed(2)} pts short
        </span>
      ) : null}
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
