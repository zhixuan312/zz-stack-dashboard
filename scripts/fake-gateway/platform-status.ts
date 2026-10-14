/**
 * The fake gateway's platform status: what `GET /api/console/platform/status` answers, to everyone signed in alike.
 *
 * Every part: what needs attention, the eight measures in the spec's order, week by week, each door's days, the records,
 * what is running, and `own`, the reader's active team's share of three of the measures and its bug reports. A week runs
 * Monday to Monday in the reporting timezone, which here is UTC, and the weeks end on the one the server started in, so
 * the page reads last week whenever verify runs; the doors' days run from the first week's Monday through today. Both
 * people the fixture signs in act for atlas, so `own` is the same for both. `needs` is the superadmin's; a member is
 * answered `MEMBER_STATUS`, the same object with `needs` in the gateway's member projection: every team's approvals
 * folded into one row that names no team and links nowhere, and the headline saying what is known and open.
 *
 * One week per state the page draws: a rate that stands, one from too few observations to judge (under thirty), a week
 * with nothing in it, a week before a measure was defined, and the running week, which has not ended. Each measure's
 * `first`, `best`, `last`, `previous`, `highest`, `lowest`, judgement and finding are written out here as the gateway's
 * `summarise` names them from these weeks.
 *
 * COUPLED: `checks/console-platform-status.ts` in zz-stack imports this file with plain `node` and compares its shape
 * with the real route's answer, key set by key set and measure by measure. So nothing here is imported through the
 * console's path alias, and the malformed-call measure's `first`, `best`, `last` and `previous` are all weeks, never
 * null: a null has no shape to compare.
 */
import type { Measure, PeriodFigure, PlatformStatus } from '../../src/lib/platform-shapes.ts';
import { now } from './clock.ts';

const DAY = 24 * 3_600_000;
const WEEK = 7 * DAY;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The Monday the running week began on, 00:00 UTC. The epoch was a Thursday, so Mondays fall four days after a whole week. */
const RUNNING = Math.floor((now() - 4 * DAY) / WEEK) * WEEK + 4 * DAY;

/** The week `back` weeks before the running one; only the running week has not ended. */
function span(back: number): PeriodFigure['window'] {
  const from = RUNNING - back * WEEK;
  const ended = back > 0;
  return { from: iso(from), to: iso(from + WEEK), observedFrom: iso(from), observedThrough: iso(ended ? from + WEEK : now()), complete: ended };
}

/** A rate of `scale` per `denominator`, kept and marked `insufficient` under `min` observations. */
function rate(back: number, numerator: number, denominator: number, scale: number, min = 30): PeriodFigure {
  return {
    window: span(back),
    figure: denominator === 0 ? { value: null, why: 'no_data' } : { value: (scale * numerator) / denominator, why: denominator < min ? 'insufficient' : null },
    numerator, denominator,
  };
}
/** A percentile over `timed` recorded durations. */
const percentile = (back: number, value: number | null, timed: number): PeriodFigure => ({
  window: span(back), figure: timed === 0 ? { value: null, why: 'no_data' } : { value, why: timed < 30 ? 'insufficient' : null },
  numerator: null, denominator: timed,
});
/** A count, which stands at any size: a zero is a week that was read and held none. */
const tally = (back: number, n: number): PeriodFigure => ({ window: span(back), figure: { value: n, why: null }, numerator: n, denominator: null });
/** A week before the measure was defined. */
const undefinedYet = (back: number): PeriodFigure => ({ window: span(back), figure: { value: null, why: 'unavailable' }, numerator: null, denominator: null });

/** The local date a week begins on, which a finding names. */
const date = (w: PeriodFigure) => w.window.from.slice(0, 10);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** That date as a finding's sentence prints it: `28 Sep`. */
const day = (w: PeriodFigure) => `${Number(date(w).slice(8))} ${MONTHS[Number(date(w).slice(5, 7)) - 1]}`;

/** Weeks oldest first, back 5 to the running week; `pick` names a week by its index. */
type Weeks = PeriodFigure[];
const pick = (weeks: Weeks, i: number | null) => (i === null ? null : weeks[i]);
function measure(key: Measure['key'], better: Measure['better'], weeks: Weeks,
                 at: { first: number | null; best: number | null; last: number; previous: number; highest: number | null; lowest: number | null },
                 judgement: Measure['judgement'], finding: Measure['finding']): Measure {
  return {
    key, weeks, first: pick(weeks, at.first), best: pick(weeks, at.best), last: weeks[at.last], previous: weeks[at.previous],
    highest: pick(weeks, at.highest), lowest: pick(weeks, at.lowest), better, judgement, finding,
  };
}

/** Malformed calls of the real-work calls made. Three weeks are comparable and the last is not the best, so its
 *  finding is its counts, dated by the Monday it began. */
const CALLS = [100, 0, 12, 200, 125, 5];
const MALFORMED_WEEKS = [rate(5, 10, 100, 1000), rate(4, 0, 0, 1000), rate(3, 3, 12, 1000), rate(2, 4, 200, 1000), rate(1, 8, 125, 1000), rate(0, 1, 5, 1000)];
const MALFORMED = measure('malformed_per_1000', 'down', MALFORMED_WEEKS, { first: 0, best: 3, last: 4, previous: 3, highest: null, lowest: null },
  'worsened', { kind: 'count', text: '8 of 125 calls refused for their shape', dates: [date(MALFORMED_WEEKS[4])], tie: false });

/** Refusals put right, of the eligible ones; the last whole week is the best. */
const FOLLOWUP_WEEKS = [rate(5, 30, 40, 100), rate(4, 0, 0, 100), rate(3, 4, 5, 100), rate(2, 48, 60, 100), rate(1, 42, 50, 100), rate(0, 1, 2, 100)];
const FOLLOWUP: Measure = {
  ...measure('same_tool_followup_pct', 'up', FOLLOWUP_WEEKS, { first: 0, best: 4, last: 4, previous: 3, highest: null, lowest: null }, 'improved',
    { kind: 'best_week', text: `Highest observed share of refusals put right in a complete week, ${day(FOLLOWUP_WEEKS[4])}`, dates: [date(FOLLOWUP_WEEKS[4])], tie: false }),
  followupCounts: [
    { refusals: 46, eligible: 40, missingSession: 6, withinLookahead: 0 }, { refusals: 0, eligible: 0, missingSession: 0, withinLookahead: 0 },
    { refusals: 7, eligible: 5, missingSession: 2, withinLookahead: 0 }, { refusals: 66, eligible: 60, missingSession: 6, withinLookahead: 0 },
    { refusals: 58, eligible: 50, missingSession: 8, withinLookahead: 0 }, { refusals: 4, eligible: 2, missingSession: 1, withinLookahead: 1 },
  ],
};

/** Durations: the calls with one, by week, and the calls without one beside them. */
const TIMED = [90, 0, 10, 180, 110, 4];
const MISSING_DURATION = CALLS.map((c, i) => c - TIMED[i]);
const P50_WEEKS = [percentile(5, 820, 90), percentile(4, null, 0), percentile(3, 760, 10), percentile(2, 790, 180), percentile(1, 840, 110), percentile(0, 700, 4)];
const P50: Measure = {
  ...measure('call_p50_ms', 'down', P50_WEEKS, { first: 0, best: 3, last: 4, previous: 3, highest: null, lowest: null }, 'worsened', null),
  missingDuration: MISSING_DURATION,
};
const P95_WEEKS = [percentile(5, 2_400, 90), percentile(4, null, 0), percentile(3, 1_900, 10), percentile(2, 2_300, 180), percentile(1, 2_250, 110), percentile(0, 1_500, 4)];
const P95: Measure = {
  ...measure('call_p95_ms', 'down', P95_WEEKS, { first: 0, best: 4, last: 4, previous: 3, highest: null, lowest: null }, 'improved',
    { kind: 'best_week', text: `Lowest observed 95th percentile call duration in a complete week, ${day(P95_WEEKS[4])}`, dates: [date(P95_WEEKS[4])], tie: false }),
  missingDuration: MISSING_DURATION,
};

/** Searches that found something, defined from a Wednesday in the oldest week, so that week is unavailable; the share
 *  widened is defined from L-1's Monday. Two weeks are comparable, too few for a finding. */
const SEARCH_WEEKS = [undefinedYet(5), rate(4, 0, 0, 100), rate(3, 6, 8, 100), rate(2, 51, 60, 100), rate(1, 36, 40, 100), rate(0, 2, 2, 100)];
const SEARCHES: Measure = {
  ...measure('searches_with_results_pct', 'up', SEARCH_WEEKS, { first: 3, best: 4, last: 4, previous: 3, highest: null, lowest: null }, 'improved',
    { kind: 'incomplete', text: 'Not enough complete weeks to compare yet', dates: [date(SEARCH_WEEKS[4])], tie: false }),
  widened: [undefinedYet(5), undefinedYet(4), undefinedYet(3), rate(2, 9, 60, 100), rate(1, 4, 40, 100), rate(0, 0, 2, 100)],
  failed: [2, 0, 1, 1, 3, 0],
};

/** Bug reports per 1,000 calls, as the fake's own Bugs read files them. Neutral: its high and low are named, and the
 *  last week is neither. */
const BUG_WEEKS = [rate(5, 1, 100, 1000), rate(4, 2, 0, 1000), rate(3, 2, 12, 1000), rate(2, 1, 200, 1000), rate(1, 2, 125, 1000), rate(0, 0, 5, 1000)];
const BUGS = measure('bugs_per_1000', 'neutral', BUG_WEEKS, { first: 0, best: null, last: 4, previous: 3, highest: 2, lowest: 3 }, 'neutral', null);

/** Sessions, and the calls with no session beside them; the last whole week is the most on record. */
const SESSION_WEEKS = [tally(5, 14), tally(4, 0), tally(3, 3), tally(2, 22), tally(1, 25), tally(0, 2)];
const SESSIONS: Measure = {
  ...measure('sessions', 'neutral', SESSION_WEEKS, { first: 0, best: null, last: 4, previous: 3, highest: 4, lowest: 1 }, 'neutral',
    { kind: 'high_week', text: `Most recorded sessions in a week since ${day(SESSION_WEEKS[0])}`, dates: [date(SESSION_WEEKS[4]), date(SESSION_WEEKS[0])], tie: false }),
  withoutSession: [6, 0, 1, 9, 5, 0],
};

const FINISHED_WEEKS = [tally(5, 2), tally(4, 0), tally(3, 1), tally(2, 3), tally(1, 2), tally(0, 1)];
const FINISHED = measure('work_finished', 'neutral', FINISHED_WEEKS, { first: 0, best: null, last: 4, previous: 3, highest: 3, lowest: 1 }, 'neutral', null);

/* The doors, one a day from the first week's Monday through today, which has not ended. `core` has 150 calls a day and a
 * fault day four days ago (3 tool failures), and today 1 in 80 so far; `manage` 40 calls a day and none until today's
 * 1 in 20, a red day so far; `eval` 10 calls every third day counting back from yesterday, one refused as `other`, and
 * 4 today, with no tool failure. */
type Door = Extract<PlatformStatus['doors'], { state: 'ok' }>['data'][number];
const FIRST_DAY = MALFORMED_WEEKS[0].window.from.slice(0, 10);
const TODAY = iso(now()).slice(0, 10);
/** The local date `k` days before today. */
const daysAgo = (k: number) => iso(Date.parse(`${TODAY}T00:00:00Z`) - k * DAY).slice(0, 10);
/** How many complete days there are, the first week's Monday through yesterday. */
const COMPLETE = (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY;
const said = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
function door(name: Door['door'], counts: (k: number) => [number, number], run: Door['run'], finding: Door['finding'], others: number): Door {
  const days = Array.from({ length: COMPLETE + 1 }, (_, i) => {
    const k = COMPLETE - i;
    const [calls, toolFailures] = counts(k);
    const state: Door['days'][number]['state'] = calls === 0 ? 'none' : toolFailures * 100 >= calls * 5 ? 'red' : toolFailures * 100 >= calls ? 'marked' : 'clear';
    return { date: daysAgo(k), calls, toolFailures, state, complete: k > 0 };
  });
  const faults = days.filter((d) => d.complete && (d.state === 'marked' || d.state === 'red'));
  return {
    door: name, days, run, finding,
    totals: {
      calls: days.reduce((n, d) => n + d.calls, 0), toolFailures: days.reduce((n, d) => n + d.toolFailures, 0), others,
      faultDays: faults.length, lastFaultDay: faults.at(-1)?.date ?? null,
    },
  };
}
const EVAL_CALLS = (k: number): [number, number] => (k === 0 ? [4, 0] : (k - 1) % 3 === 0 ? [10, 0] : [0, 0]);
const DOORS: Door[] = [
  door('core', (k) => (k === 0 ? [80, 1] : k === 4 ? [150, 3] : [150, 0]), { days: 3, atLeast: false, through: daysAgo(1) },
    { kind: 'run', text: `3 days in a row under 1% tool failures, to ${said(daysAgo(1))}`, dates: [daysAgo(1)], tie: false }, 0),
  door('manage', (k) => (k === 0 ? [20, 1] : [40, 0]), { days: COMPLETE, atLeast: true, through: daysAgo(1) },
    { kind: 'run', text: `At least ${COMPLETE} days in a row under 1% tool failures, to ${said(daysAgo(1))}`, dates: [daysAgo(1)], tie: false }, 0),
];
const EVAL_TOTAL = Array.from({ length: COMPLETE + 1 }, (_, k) => EVAL_CALLS(k)[0]).reduce((n, c) => n + c, 0);
// eval's days with calls are never two in a row, so it has no run.
DOORS.push(door('eval', EVAL_CALLS, null,
  { kind: 'no_failure', text: `No tool failure recorded in ${EVAL_TOTAL} calls since ${said(FIRST_DAY)}`, dates: [FIRST_DAY], tie: false }, 1));

/* What needs attention, as the superadmin reads it: an open report blocking work (the Bugs fixture's), the two doors
 * with a fault day so far today, a finding waiting since 410 hours ago (the Evaluation fixture's), and atlas's and
 * beacon's revisions waiting 14 days or more. Six instances: five rows and beacon's approvals in the overflow. Only a
 * team's page is a released destination, so every other row links nowhere. */
const HOUR = 3_600_000;
const NEEDS: PlatformStatus['needs'] = {
  state: 'complete', total: 6, knownCount: 6, unavailableKinds: [], overflowByKind: { approvals: 1 }, headline: '6 things need you',
  rows: [
    { kind: 'bugs', tone: 'critical', instanceCount: 1, oldestAt: iso(RUNNING - 5 * WEEK + 60 * HOUR), href: null,
      title: 'Bug reports are open', detail: '4 open reports, 1 blocking work' },
    { kind: 'door', tone: 'critical', instanceCount: 1, oldestAt: iso(Date.parse(`${TODAY}T00:00:00Z`)), href: null,
      title: 'The core door has a fault day today, so far', detail: '1 tool failure in 80 calls so far today' },
    { kind: 'door', tone: 'critical', instanceCount: 1, oldestAt: iso(Date.parse(`${TODAY}T00:00:00Z`) + 60_000), href: null,
      title: 'The manage door has a fault day today, so far', detail: '1 tool failure in 20 calls so far today' },
    { kind: 'evaluation', tone: 'warning', instanceCount: 1, oldestAt: iso(now() - 410 * HOUR), href: null,
      title: 'Evaluation findings are waiting for a decision', detail: '1 finding has waited 14 days or more for a decision' },
    { kind: 'approvals', tone: 'warning', instanceCount: 1, oldestAt: iso(now() - 20 * DAY), href: '/teams/atlas',
      title: 'Approvals are waiting in atlas', detail: '2 revisions were presented 14 days ago or more and not approved' },
  ],
};

/* Over every door's calls, the first week's Monday through yesterday: every day had work, and only core's fault day four
 * days ago was at 1% or more, which splits the run of days under it in two. */
const RECORDS = {
  daysWithWork: COMPLETE, daysUnderOnePercent: COMPLETE - 1,
  longestUnderOnePercent: { days: COMPLETE - 4, from: FIRST_DAY, to: daysAgo(5) },
};

export const PLATFORM_STATUS: PlatformStatus = {
  meta: {
    asOf: iso(now()), timezone: 'UTC',
    period: { from: MALFORMED_WEEKS[0].window.from, to: iso(now()) },
    scope: 'platform-public', population: 'real-work tool calls and searches, real bug reports, and closed initiatives',
    coverageFrom: MALFORMED_WEEKS[0].window.from,
  },
  needs: NEEDS,
  measures: [MALFORMED, FOLLOWUP, P50, P95, SEARCHES, BUGS, SESSIONS, FINISHED],
  records: { state: 'ok', data: RECORDS },
  doors: { state: 'ok', data: DOORS },
  running: { state: 'ok', data: { platform: '0.97.0', console: '0.28.0', releasedAt: iso(now() - 2 * DAY), previous: '0.96.0', migrations: 103 } },
  // atlas, with no sample minimum: every week with calls stands, its counts beside it.
  own: { state: 'ok', data: {
    malformed: [rate(5, 6, 60, 1000, 0), rate(4, 0, 0, 1000, 0), rate(3, 3, 12, 1000, 0), rate(2, 2, 120, 1000, 0), rate(1, 5, 80, 1000, 0), rate(0, 1, 3, 1000, 0)],
    followup: [rate(5, 15, 20, 100, 0), rate(4, 0, 0, 100, 0), rate(3, 4, 5, 100, 0), rate(2, 25, 30, 100, 0), rate(1, 22, 25, 100, 0), rate(0, 1, 2, 100, 0)],
    sessions: [tally(5, 6), tally(4, 0), tally(3, 3), tally(2, 9), tally(1, 11), tally(0, 1)],
    bugs: { filed: 3, fixed: 1, notABug: 0, duplicate: 1, open: 1 },
  } },
};

/** A member's `needs`, derived from the superadmin's by the gateway's rule (console/platform-needs.ts `needsOf`): the
 *  approvals rows and the approvals overflow become one row in the place the first held, and the headline is the one a
 *  member reads. Nothing else moves, so the instances still add up to the total. */
function memberNeeds(needs: PlatformStatus['needs']): PlatformStatus['needs'] {
  const waiting = needs.rows.filter((r) => r.kind === 'approvals');
  const teams = waiting.reduce((n, r) => n + r.instanceCount, 0) + (needs.overflowByKind.approvals ?? 0);
  const { approvals: _folded, ...overflowByKind } = needs.overflowByKind;
  const folded = teams === 0 ? [] : [{
    kind: 'approvals' as const, tone: 'warning' as const, instanceCount: teams, oldestAt: waiting[0]?.oldestAt ?? null, href: null,
    title: `Approvals are waiting in ${teams} ${teams === 1 ? 'team' : 'teams'}`,
    detail: `${teams} ${teams === 1 ? 'team has' : 'teams have'} a revision presented 14 days ago or more and not approved`,
  }];
  const first = needs.rows.findIndex((r) => r.kind === 'approvals');
  const rows = needs.rows.flatMap((r, i) => (r.kind !== 'approvals' ? [r] : i === first ? folded : []));
  const total = needs.total;
  const headline = total === null ? needs.headline
    : total === 0 ? 'No known open issues' : `${total} ${total === 1 ? 'thing is' : 'things are'} known and open`;
  return { ...needs, rows, overflowByKind, headline };
}

export const MEMBER_STATUS: PlatformStatus = { ...PLATFORM_STATUS, needs: memberNeeds(NEEDS) };
