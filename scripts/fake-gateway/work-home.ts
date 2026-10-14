/**
 * The fake gateway's Home: what `GET /api/console/home` answers.
 *
 * One fixture, every team's last whole week and what waits, answered for the caller's active team, with the approvals
 * in it the caller's own. Its open work, closures and waiting count are read off the initiatives list and the
 * approvals queue, so Home, Initiatives and Approvals say the same things of the same work.
 *
 * It exercises the states the page draws: a plain week for atlas, which both people act for, and a first observed
 * week for beacon, whose one revision waiting is named; a running week; a week with no recorded words, said rather
 * than drawn as nothing; a coverage gap and import-made documents in the words' coverage; more than four runs active
 * now, so they group by initiative; a quiet initiative folded into one row of open work; and closures of two outcomes
 * last week. A team with no week to read has the fallback title.
 *
 * COUPLED: zz-stack's `checks/console-work-home.ts` imports this file with plain `node` and compares its key sets with
 * the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import type { ActiveGroup, Home, WritingCoverage, WritingEstimate } from '../../src/lib/work-shapes.ts';
import { ago } from './clock.ts';
import { callerApprovalRows, callerWeeks, waitingOf } from './work-approvals.ts';
import { LAST_WEEK, WEEKS, counted, rowsOf, tally, workMeta } from './work-initiatives.ts';

/** The pace every writing estimate is made at: words one person writes in an hour (`WORDS_PER_HOUR` in zz-stack). */
const WORDS_PER_HOUR = 500;

/** What the words are counted over, and what they are not: two import-made documents left out, one document with no
 *  recorded write and one missing predecessor named as gaps. */
export const COVERAGE: WritingCoverage = { documents: 41, revisions: 156, importMade: 2, unrecorded: 1, mixed: 0, datedByLastWrite: 3, undated: 0, missingLegacy: 1 };

/** An estimate of `words` at the stated pace, on `basis`, with the words' coverage beside it. */
export const estimateOf = (basis: WritingEstimate['basis'], words: number): WritingEstimate =>
  ({ basis, words, assumedWordsPerHour: WORDS_PER_HOUR, hours: words / WORDS_PER_HOUR, coverage: COVERAGE });

/** Words added by week, oldest first, the running week last; null for the week with no recorded words. */
const WORDS: (number | null)[] = [12_400, null, 8_300, 15_400, 9_100, 2_100];

/** The words' weeks: a week with no recorded revision has no value, never a zero. */
const wordWeeks = (): PeriodFigure[] => WORDS.map((n, i) => (n === null
  ? { window: WEEKS[i], figure: { value: null, why: 'no_data' }, numerator: null, denominator: null }
  : tally(i, n)));

/** The local date a week begins on, which a finding names. */
const begins = (i: number) => WEEKS[i].from.slice(0, 10);

/** Each run active now: six, in five groups, so the page shows four and says one more. */
const ACTIVE: [initiative: string | null, skill: string, startedHoursAgo: number][] = [
  ['2026-09-28-search-relevance', 'sdlc-plan', 1.5], ['2026-09-28-search-relevance', 'sdlc-plan-audit', 0.4],
  ['2026-10-08-result-explanations', 'sdlc-review', 0.8], ['2026-10-02-query-latency', 'sdlc-spec', 0.3],
  ['2026-10-03-ranking-weights', 'sdlc-spec-audit', 0.2], [null, 'zz-tldr', 0.1],
];
const LAST_CALL = ago(0.02);

/** Above four runs they are grouped by initiative, and at most four groups are answered; `more` counts the runs left. */
function activeGroups(): { active: ActiveGroup[]; more: number } {
  const groups: ActiveGroup[] = [];
  for (const [initiative, skill, hours] of ACTIVE) {
    const run = { skill, startedAt: ago(hours), lastAt: LAST_CALL };
    const g = groups.find((x) => x.initiative === initiative);
    if (g) g.runs.push(run); else groups.push({ initiative, runs: [run] });
  }
  return { active: groups.slice(0, 4), more: groups.slice(4).reduce((n, g) => n + g.runs.length, 0) };
}

/** The title, by team: the rule the facts of its last whole week meet first. */
function titleOf(team: string | null, closed: number, approvals: number): Home['title'] {
  if (team === 'atlas') return { sentence: `${closed} pieces of work closed; ${approvals} ${approvals === 1 ? 'approval' : 'approvals'} recorded in your name last week`, rule: 8 };
  if (team === 'beacon') return { sentence: 'Your first observed week: 1 closure and 2 lesson adoptions', rule: 1 };
  return { sentence: 'Your work at a glance', rule: 'fallback' };
}

/** Home for `team`, the approvals in it signed in `email`'s name. */
export function homeOf(team: string | null, email: string): Home {
  const rows = rowsOf(team);
  const last = WEEKS[LAST_WEEK];
  const closedLast = rows.filter((r) => r.closed !== null && r.closed >= last.from && r.closed < last.to);
  const mine = callerWeeks(callerApprovalRows(team, email));
  const queue = waitingOf(team);
  const open = rows.filter((r) => r.closed === null);
  const quiet = open.filter((r) => r.state === 'quiet').length;
  const words = wordWeeks();
  const lastWords = WORDS[LAST_WEEK]!;
  return {
    meta: workMeta('caller-in-active-team', `${team}'s work last week, and the approvals signed in the caller's name there`),
    title: titleOf(team, closedLast.length, mine[LAST_WEEK].numerator ?? 0),
    waiting: { state: 'ok', data: {
      count: queue.length, oldestSince: queue[0]?.waitingSince ?? null,
      one: queue.length === 1 ? { initiative: queue[0].initiative, path: queue[0].path, version: queue[0].version } : null,
    } },
    words: { state: 'ok', data: {
      weeks: words, coverage: COVERAGE,
      finding: { kind: 'high_week', text: `The most words added in a complete week, the week of ${begins(3)}`, dates: [begins(3)], tie: false },
    } },
    approvals: { state: 'ok', data: {
      weeks: mine,
      finding: { kind: 'count', text: `${mine[LAST_WEEK].numerator} recorded in your name last week`, dates: [begins(LAST_WEEK)], tie: false },
    } },
    foot: {
      estimate: estimateOf('period_net_additions', lastWords),
      coverageMs: counted(31 * 3_600_000), peak: counted(5),
    },
    tiles: {
      closed: tally(LAST_WEEK, closedLast.length),
      medianHoursToClose: { window: last, figure: { value: 41.5, why: 'insufficient' }, numerator: null, denominator: closedLast.length },
      searchesWithResults: { window: last, figure: { value: 90, why: null }, numerator: 36, denominator: 40 },
      agentDays: { window: last, figure: { value: 6, why: null }, numerator: 6, denominator: 7 },
    },
    runs: { state: 'ok', data: { ...activeGroups(), lastRunAt: LAST_CALL } },
    milestones: { state: 'ok', data: [
      { count: 'closed', next: 10, last: 0, value: rows.filter((r) => r.closed !== null).length },
      { count: 'documents', next: 100, last: 0, value: COVERAGE.documents },
      { count: 'lessons', next: 10, last: 0, value: 6 },
      { count: 'words', next: 1_000_000, last: 0, value: 412_300 },
    ] },
    openWork: { state: 'ok', data: {
      rows: open.filter((r) => r.state !== 'quiet').slice(0, quiet ? 4 : 5).map((r) => ({ ...r })), quiet, total: open.length,
    } },
    closedLastWeek: { state: 'ok', data: closedLast.map((r) => ({ slug: r.slug, outcome: r.state, closedAt: r.closed! })) },
  };
}

/** `GET /home`, as `who`: their active team's, their own approvals. */
export const home = (who: Me): Home => homeOf(who.activeTeam, who.email);
