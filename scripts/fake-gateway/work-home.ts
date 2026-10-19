/**
 * The fake gateway's Home: what `GET /api/console/home` answers.
 *
 * One fixture, every team's last whole week and what waits, answered for the caller's active team, with the approvals
 * in it the caller's own. Its open work, closures and waiting count are read off the initiatives list and the
 * approvals queue, its runs off Runs' (`work-runs.ts`), its lessons and searches off Knowledge's (`work-knowledge.ts`),
 * and its words are the additions Record counts (`ADDITIONS` here), so Home says what the page it links to says.
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
import type { Finding, PeriodFigure } from '../../src/lib/platform-shapes.ts';
import type { ActiveGroup, Home, WritingCoverage, WritingEstimate } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { callerApprovalRows, callerWeeks, waitingOf } from './work-approvals.ts';
import { LAST_WEEK, WEEKS, counted, inWeek, rowsOf, tally, workMeta } from './work-initiatives.ts';
import { lessonsMade, searchesOf } from './work-knowledge.ts';
import { median, observedRuns, runsOf } from './work-runs.ts';

/** The pace every writing estimate is made at: words one person writes in an hour (`WORDS_PER_HOUR` in zz-stack). */
const WORDS_PER_HOUR = 500;

/** What the words are counted over, and what they are not: two import-made documents left out, one document with no
 *  recorded write and one missing predecessor named as gaps. */
export const COVERAGE: WritingCoverage = { documents: 41, revisions: 156, importMade: 2, unrecorded: 1, mixed: 0, datedByLastWrite: 3, undated: 0, missingLegacy: 1 };

/** An estimate of `words` at the stated pace, on `basis`, with the words' coverage beside it. */
export const estimateOf = (basis: WritingEstimate['basis'], words: number): WritingEstimate =>
  ({ basis, words, assumedWordsPerHour: WORDS_PER_HOUR, hours: words / WORDS_PER_HOUR, coverage: COVERAGE });

/** Words added by week, by weeks before the running one (0 is the running week), back to the week the record began
 *  in; null for the week with no recorded words. */
const WORDS_BACK: (number | null)[] = [2_100, 15_400, 9_100, 8_300, null, 12_400, 6_100, 3_200];
/** Every addition of words, one a week, at the week's middle, or halfway to the cutoff in the running week: what Home
 *  and Record both count. */
export const ADDITIONS: { atMs: number; words: number }[] = WORDS_BACK.flatMap((n, back) => (n === null ? [] : [{ atMs: inWeek(back, 84), words: n }]));
/** The words added in `[fromMs, toMs)`, or null when none was recorded there. */
export function wordsIn(fromMs: number, toMs: number): number | null {
  const here = ADDITIONS.filter((a) => a.atMs >= fromMs && a.atMs < toMs);
  return here.length ? here.reduce((n, a) => n + a.words, 0) : null;
}

/** The words' weeks: a week with no recorded revision has no value, never a zero. */
const wordWeeks = (): PeriodFigure[] => WEEKS.map((w, i) => {
  const n = wordsIn(Date.parse(w.from), Date.parse(w.to));
  return n === null ? { window: w, figure: { value: null, why: 'no_data' }, numerator: null, denominator: null } : tally(i, n);
});

/** Each count's round numbers: the listed thresholds, then every further step (`LADDERS` in the gateway). */
const LADDERS: Record<string, { steps: number[]; every: number }> = {
  closed: { steps: [10, 25, 50, 100, 250, 500], every: 500 }, documents: { steps: [100, 500, 1_000], every: 1_000 },
  lessons: { steps: [10, 25, 50, 100], every: 100 }, words: { steps: [1_000_000], every: 500_000 },
};
/** A count's next round number, the last one it reached (0 with none), and the count itself. */
function milestone(count: 'closed' | 'documents' | 'lessons' | 'words', value: number) {
  const { steps, every } = LADDERS[count];
  const top = steps.at(-1)!;
  const last = value >= top ? top + Math.floor((value - top) / every) * every : [...steps].reverse().find((t) => t <= value) ?? 0;
  const next = steps.find((t) => t > value) ?? top + (Math.floor((value - top) / every) + 1) * every;
  return { count, next, last, value };
}

/** A date as a finding's sentence prints it, the console's `formatDay` of that day: `28 Sept`, `1 Oct`. COUPLED: `day` in
 *  the gateway's console/findings.ts. */
const SENTENCE_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const sayDay = (date: string) => SENTENCE_DAY.format(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));

/**
 * What the gateway says of a neutral measure's last whole week: its high or its low since the first comparable week,
 * a tie with the earliest week it ties named, or nothing. COUPLED: periodFinding's neutral branch in the gateway's
 * console/findings.ts, which Home calls with no count label, so a plain week has no finding.
 */
function neutralFinding(weeks: PeriodFigure[], label: string): Finding | null {
  const whole = weeks.filter((w) => w.window.complete);
  const valued = whole.filter((w) => w.figure.value !== null);
  const last = whole.at(-1);
  const at = last ? [last.window.from.slice(0, 10)] : [];
  if (valued.length < 3 || !last) return { kind: 'incomplete', text: 'Not enough complete weeks to compare yet', dates: at, tie: false };
  const v = last.figure.value;
  if (v === null) return null;
  const others = valued.filter((w) => w !== last).map((w) => w.figure.value!);
  const kind = others.every((o) => o <= v) ? 'high_week' : others.every((o) => o >= v) ? 'low_week' : null;
  if (!kind) return null;
  const from = valued[0].window.from.slice(0, 10);
  const text = `${kind === 'high_week' ? 'Most' : 'Fewest'} recorded ${label} in a week since ${sayDay(from)}`;
  const tied = valued.find((w) => w !== last && w.figure.value === v)?.window.from.slice(0, 10);
  return tied ? { kind, text: `${text}, tied with ${sayDay(tied)}`, dates: [...at, from, tied], tie: true } : { kind, text, dates: [...at, from], tie: false };
}

/** The team's runs active now, as Runs marks them: each its own group while four or fewer, grouped by initiative above
 *  that, the latest call first, at most four groups answered and `more` counting the runs left (`groupsOf` in the
 *  gateway). Atlas has six, in five groups. */
function activeGroups(team: string | null): { active: ActiveGroup[]; more: number } {
  const runs = (team ? runsOf(team) : []).filter((r) => r.state === 'active')
    .sort((a, b) => b.lastCallAt.localeCompare(a.lastCallAt) || b.startedAt.localeCompare(a.startedAt) || a.skill.localeCompare(b.skill));
  const asRun = (r: (typeof runs)[number]) => ({ skill: r.skill, startedAt: r.startedAt, lastAt: r.lastCallAt });
  if (runs.length <= 4) return { active: runs.map((r) => ({ initiative: r.initiative, runs: [asRun(r)] })), more: 0 };
  const groups: ActiveGroup[] = [];
  for (const r of runs) {
    const g = groups.find((x) => x.initiative === r.initiative);
    if (g) g.runs.push(asRun(r)); else groups.push({ initiative: r.initiative, runs: [asRun(r)] });
  }
  groups.sort((a, b) => b.runs[0].lastAt.localeCompare(a.runs[0].lastAt) || (a.initiative === null ? 1 : b.initiative === null ? -1 : a.initiative.localeCompare(b.initiative)));
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
  const lastWords = words[LAST_WEEK].figure.value;
  const lastFrom = Date.parse(last.from), lastTo = Date.parse(last.to);
  const observed = team ? observedRuns(team, lastFrom, lastTo) : null;
  const took = closedLast.map((r) => (Date.parse(r.closed!) - Date.parse(r.opened)) / 3_600_000);
  const searched = team ? searchesOf(team).filter((x) => x.at >= last.from && x.at < last.to) : [];
  const found = searched.filter((x) => x.found).length;
  const mineRuns = team ? runsOf(team) : [];
  return {
    meta: workMeta('caller-in-active-team', `${team}'s work last week, and the approvals signed in the caller's name there`),
    title: titleOf(team, closedLast.length, mine[LAST_WEEK].numerator ?? 0),
    waiting: { state: 'ok', data: {
      count: queue.length, oldestSince: queue[0]?.waitingSince ?? null,
      one: queue.length === 1 ? { initiative: queue[0].initiative, path: queue[0].path, version: queue[0].version } : null,
    } },
    words: { state: 'ok', data: {
      weeks: words, coverage: COVERAGE,
      finding: neutralFinding(words, 'words added'),
    } },
    approvals: { state: 'ok', data: {
      weeks: mine,
      finding: neutralFinding(mine, 'approvals in your name'),
    } },
    foot: {
      estimate: lastWords === null ? null : estimateOf('period_net_additions', lastWords),
      coverageMs: counted(observed?.coverageMs ?? 0), peak: counted(observed?.peak ?? 0),
    },
    tiles: {
      closed: tally(LAST_WEEK, closedLast.length),
      // A team's own figure stands at any count, drawn beside it: the gateway never marks it insufficient.
      medianHoursToClose: { window: last, figure: took.length ? { value: median(took), why: null } : { value: null, why: 'no_data' }, numerator: null, denominator: took.length },
      searchesWithResults: { window: last, figure: searched.length ? { value: (100 * found) / searched.length, why: null } : { value: null, why: 'no_data' }, numerator: found, denominator: searched.length },
      agentDays: { window: last, figure: { value: 6, why: null }, numerator: 6, denominator: 7 },
    },
    runs: { state: 'ok', data: { ...activeGroups(team), lastRunAt: mineRuns.reduce<string | null>((a, r) => (!a || r.lastCallAt > a ? r.lastCallAt : a), null) } },
    milestones: { state: 'ok', data: [
      milestone('closed', rows.filter((r) => r.closed !== null).length),
      milestone('documents', COVERAGE.documents),
      milestone('lessons', team ? lessonsMade(team).length : 0),
      milestone('words', ADDITIONS.filter((a) => a.atMs < now()).reduce((n, a) => n + a.words, 0)),
    ] },
    openWork: { state: 'ok', data: {
      rows: open.filter((r) => r.state !== 'quiet').slice(0, quiet ? 4 : 5).map((r) => ({ ...r })), quiet, total: open.length,
    } },
    closedLastWeek: { state: 'ok', data: closedLast.map((r) => ({ slug: r.slug, outcome: r.state, closedAt: r.closed! })) },
  };
}

/** `GET /home`, as `who`: their active team's, their own approvals. */
export const home = (who: Me): Home => homeOf(who.activeTeam, who.email);
