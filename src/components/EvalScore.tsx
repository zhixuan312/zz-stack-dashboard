'use client';

import Link from 'next/link';
import { Badge, Time } from '@/components/ui';
import type { PluginRow } from '@/lib/api-shapes';

type Verdict = NonNullable<PluginRow['latestEval']>;

/**
 * What the last evaluation round concluded about a plugin, in one cell.
 *
 * The number first, then the band that names it.
 *
 * The band is the colour, and the bands are fixed in `@zz/contracts`' bands.ts. Colouring by a
 * cut chosen here would be a second opinion about what "good" means.
 */

/** Band -> hue. Keyed on the band the platform names rather than on the number, so the colour
 *  and the label cannot disagree: if a boundary moves in bands.ts, the band moves with it and
 *  this follows, where a `score >= 8` written here would not. */
const BAND: Record<string, 'sage' | 'amber' | 'rose' | 'neutral'> = {
  'working well': 'sage',
  working: 'sage',
  'working poorly': 'amber',
  'not working': 'rose',
  'not measurable': 'neutral',
};

/** The second axis. `no change needed` is the good outcome here and is coloured as one. The other
 *  three are not degrees of bad: `change identified` means there is a next move on the record, and
 *  `unexplained gap` means nobody has said why the score is short, which is the one state where the
 *  right move is to find out rather than to act. */
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
  // Not measured and scored zero are different facts. A round that predates the platform storing
  // its axes, and a round whose control collapsed, both have no number, and an em dash says so.
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

/** The whole verdict as a table cell: the score and its band. */
export function EvalCell({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs italic text-ink-faint">never evaluated</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <EvalScore of={of} className="text-[15px]" />
      {/* The band, not the recommendation: the band is what the number means, and the verdict —
          what to do about it — has a column of its own. */}
      <span className="text-[11px] leading-tight text-ink-faint">{of.band}</span>
    </span>
  );
}

/** What is left to do — the second axis, never a verdict on the plugin. It shows what the evidence
 *  says about the gap, and how many named changes are open behind that state. */
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
 * When it was measured, which release it was measured at, and the way into the report.
 *
 * Its own column, beside the score rather than under it: "how good is it" and "how stale is that
 * answer" are different questions, and the second decides whether to trust the first.
 *
 * The version is part of the date, not of the score. A round measures one release, and saying which
 * version was on the bench stops the number being read as a statement about what is on the shelf.
 */
export function EvalWhen({ of }: { of: Verdict | null }) {
  if (!of) return <span className="text-xs text-ink-faint">—</span>;
  const when = (
    <>
      <Time value={of.at} />
      <span className="block text-[11px] text-ink-faint">at v{of.version}</span>
    </>
  );
  // Absent, never guessed. A round taken before the platform recorded which initiative produced it
  // has no report to point at, and matching one by plugin name and a date window is the attribution
  // journal 0116 forbids.
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
