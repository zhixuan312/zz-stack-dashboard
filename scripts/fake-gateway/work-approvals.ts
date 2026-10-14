/**
 * The fake gateway's approvals: what `GET /api/console/approvals?tab=waiting|history&limit&offset` answers.
 *
 * One fixture of two lists. Waiting is the team's queue, the revisions presented and not approved in its open work,
 * which nothing records as anybody's in particular; History is every approval with its signer, and a caller reads only
 * the ones signed in their own name, in their active team. Both people act for atlas, so both read one queue and two
 * different histories: neither reads the other's approvals, and an approval somebody signed in beacon is read by
 * nobody acting for atlas.
 *
 * The rows cover the states the page draws: a revision waiting longer than 14 days, every class of presentation
 * (shown in the console, covered in an agent's context, a context that covered nothing of it, and an approval sealed
 * before the events began, dated by its day alone), both recorded decision bases and the unknown one, and more than ten
 * approvals in the superadmin's name so History pages.
 *
 * COUPLED: zz-stack's `checks/console-work-approvals.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import type { ApprovalEvidence, ApprovalRow, Approvals, WaitingRow } from '../../src/lib/work-shapes.ts';
import { ago } from './clock.ts';
import { WEEKS, inWeek, iso, tally, workMeta } from './work-initiatives.ts';

type Answer = [status: number, body: unknown];

const AVA = 'ava.lindqvist@example.com';
const NOAH = 'noah.okafor@example.com';

/** A content revision as zz-core names one: `cr_` and 26 base32 characters, one per snapshot. */
const cr = (n: number) => `cr_${n.toString(32).padStart(26, 'a')}`;

/** The revisions presented and not approved in each team's open work, oldest wait first. */
const QUEUE: (WaitingRow & { team: string })[] = [
  { team: 'atlas', initiative: '2026-10-04-index-rebuild', path: 'spec.md', version: 1, contentRevision: cr(11), waitingSince: ago(17 * 24) },
  { team: 'atlas', initiative: '2026-10-02-query-latency', path: 'spec.md', version: 1, contentRevision: cr(12), waitingSince: ago(70) },
  { team: 'atlas', initiative: '2026-10-03-ranking-weights', path: 'spec.md', version: 2, contentRevision: cr(13), waitingSince: ago(30) },
  { team: 'atlas', initiative: '2026-09-28-search-relevance', path: 'plan.md', version: 1, contentRevision: cr(14), waitingSince: ago(2) },
  { team: 'beacon', initiative: '2026-09-30-refund-flow', path: 'spec.md', version: 1, contentRevision: cr(15), waitingSince: ago(9) },
];

type Signed = ApprovalRow & { team: string; signer: string };
const signed = (team: string, signer: string, initiative: string, path: string, version: number, n: number, at: string,
  presentation: ApprovalEvidence['presentation'], decisionBasis: ApprovalEvidence['decisionBasis']): Signed =>
  ({ team, signer, initiative, path, version, contentRevision: cr(n), approvedAt: at, presentation, decisionBasis });
const week = (back: number, hours: number) => iso(inWeek(back, hours));

/** Every approval, newest first, with the person it was signed in the name of. One signed on somebody's behalf is
 *  theirs, so it carries their address and not the one of whoever pressed. */
const SIGNED: Signed[] = [
  signed('atlas', AVA, '2026-10-08-result-explanations', 'review.md', 1, 31, week(0, 0), 'console_revision_shown', 'explicit_recorded'),
  signed('atlas', AVA, '2026-10-08-result-explanations', 'plan.md', 2, 32, week(1, 100), 'agent_context_covered', 'standing_delegation_recorded'),
  signed('atlas', NOAH, '2026-10-08-result-explanations', 'spec.md', 1, 33, week(1, 60), 'console_revision_shown', 'explicit_recorded'),
  signed('atlas', AVA, '2026-09-28-search-relevance', 'spec.md', 3, 34, week(1, 30), 'console_revision_shown', 'explicit_recorded'),
  signed('atlas', AVA, '2026-08-02-ingest-pipeline', 'spec.md', 1, 35, week(2, 120), 'not_recorded', 'explicit_recorded'),
  signed('atlas', AVA, '2026-09-28-search-relevance', 'spec.md', 2, 45, week(2, 80), 'agent_context_covered', 'explicit_recorded'),
  signed('atlas', AVA, '2026-09-15-tagging-model', 'spec.md', 1, 36, week(2, 40), 'agent_context_covered', 'explicit_recorded'),
  signed('atlas', NOAH, '2026-08-25-eval-harness', 'review.md', 2, 37, week(3, 50), 'agent_context_covered', 'standing_delegation_recorded'),
  signed('atlas', AVA, '2026-08-25-eval-harness', 'plan.md', 1, 38, week(3, 20), 'not_recorded', 'standing_delegation_recorded'),
  signed('atlas', AVA, '2026-09-12-onboarding-revamp', 'plan.md', 1, 39, week(4, 90), 'agent_context_covered', 'unknown'),
  signed('atlas', AVA, '2026-09-12-onboarding-revamp', 'spec.md', 1, 40, week(4, 30), 'console_revision_shown', 'explicit_recorded'),
  signed('atlas', NOAH, '2026-08-14-citation-graph', 'plan.md', 1, 41, week(5, 70), 'not_recorded', 'unknown'),
  signed('atlas', AVA, '2026-08-14-citation-graph', 'spec.md', 2, 42, week(5, 10), 'agent_context_covered', 'explicit_recorded'),
  // Sealed before the events began: read from the revision, dated by its day, and nothing known of how.
  signed('atlas', AVA, '2026-08-14-citation-graph', 'explore.md', 1, 43, ago(60 * 24).slice(0, 10), 'unknown', 'unknown'),
  signed('beacon', AVA, '2026-09-22-payout-schedule', 'spec.md', 1, 44, week(2, 15), 'console_revision_shown', 'explicit_recorded'),
];

/** The queue of `team`, oldest wait first. */
export const waitingOf = (team: string | null): WaitingRow[] => QUEUE.filter((w) => w.team === team).map(({ team: _, ...w }) => w);

/** The approvals signed in `email`'s name in `team`, newest first: what History, Home and Record count. */
export const callerApprovalRows = (team: string | null, email: string): ApprovalRow[] =>
  SIGNED.filter((a) => a.team === team && a.signer === email).map(({ team: _, signer: __, ...a }) => a);

/** Those approvals by week, the running one not complete; one dated by its day alone falls in the week of that day. */
export const callerWeeks = (rows: ApprovalRow[]): PeriodFigure[] =>
  WEEKS.map((w, i) => tally(i, rows.filter((a) => a.approvedAt >= w.from.slice(0, a.approvedAt.length) && a.approvedAt < w.to.slice(0, a.approvedAt.length)).length));

const PRESENTATIONS: ApprovalEvidence['presentation'][] = ['console_revision_shown', 'agent_context_covered', 'not_recorded', 'unknown'];
const BASES: ApprovalEvidence['decisionBasis'][] = ['explicit_recorded', 'standing_delegation_recorded', 'unknown'];
const TABS = ['waiting', 'history'];

/** How many rows of each initiative, the most first. */
function byInitiative(rows: { initiative: string }[]): { initiative: string; count: number }[] {
  const n = new Map<string, number>();
  for (const r of rows) n.set(r.initiative, (n.get(r.initiative) ?? 0) + 1);
  return [...n].map(([initiative, count]) => ({ initiative, count })).sort((a, b) => b.count - a.count || a.initiative.localeCompare(b.initiative));
}
const tallied = <K extends string>(keys: K[], of: (k: K) => number) => Object.fromEntries(keys.map((k) => [k, of(k)])) as Record<K, number>;

/**
 * `GET /approvals`, as `who`: the active team's queue and the caller's own history. `tab` chooses which list the page
 * pages; the other answers its first page and its total. 400 for a tab or a page the route does not take.
 */
export function approvals(who: Me, q: URLSearchParams): Answer {
  const tab = q.get('tab') ?? 'waiting';
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  if (!TABS.includes(tab)) return [400, { error: `tab must be one of ${TABS.join(', ')}` }];
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return [400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }];
  const queue = waitingOf(who.activeTeam);
  const mine = callerApprovalRows(who.activeTeam, who.email);
  const pageOf = <T>(rows: T[], paged: boolean) => (paged ? rows.slice(offset, offset + limit) : rows.slice(0, 10));
  const fourteenDaysAgo = ago(14 * 24);
  const recorded = mine.filter((a) => a.presentation !== 'unknown');
  const answer: Approvals = {
    meta: workMeta('caller-in-active-team', `${who.activeTeam}'s revisions waiting, and the approvals signed in the caller's name there`),
    tiles: {
      waiting: queue.length,
      oldestWaitingSince: queue[0]?.waitingSince ?? null,
      inYourName: mine.length,
      noPresentation: { count: recorded.filter((a) => a.presentation === 'not_recorded').length, of: recorded.length },
    },
    weeks: callerWeeks(mine),
    waiting: { state: 'ok', data: {
      rows: pageOf(queue, tab === 'waiting'), total: queue.length, queue: 'team',
      summary: { byInitiative: byInitiative(queue), olderThan14Days: queue.filter((w) => w.waitingSince < fourteenDaysAgo).length },
    } },
    history: { state: 'ok', data: {
      rows: pageOf(mine, tab === 'history'), total: mine.length,
      summary: {
        byPresentation: tallied(PRESENTATIONS, (p) => mine.filter((a) => a.presentation === p).length),
        byDecisionBasis: tallied(BASES, (b) => mine.filter((a) => a.decisionBasis === b).length),
        byInitiative: byInitiative(mine),
      },
    } },
  };
  return [200, answer];
}
