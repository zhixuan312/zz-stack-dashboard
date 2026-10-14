/**
 * The fake gateway's platform status: what `GET /api/console/platform/status` answers, to everyone signed in alike.
 *
 * As far as Phase 0 builds it: one measure, malformed calls per 1,000 real-work tool calls, week by week, and every
 * other part answered as unavailable rather than as empty. A week runs Monday to Monday in the reporting timezone,
 * which here is UTC, and the weeks end on the one the server started in, so the page reads last week whenever verify
 * runs.
 *
 * One week per state the page draws: a rate that stands, one from too few calls to judge (under thirty), a week with
 * no calls at all, and the running week, which has not ended.
 *
 * COUPLED: `checks/console-platform-status.ts` in zz-stack imports this file with plain `node` and compares its shape
 * with the real route's answer, key set by key set. So nothing here is imported through the console's path alias,
 * and the measure's `first`, `best`, `last` and `previous` are all weeks, never null: a null has no shape to compare.
 */
import type { Measure, PeriodFigure, PlatformStatus } from '../../src/lib/platform-shapes.ts';
import { now } from './clock.ts';

const DAY = 24 * 3_600_000;
const WEEK = 7 * DAY;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The Monday the running week began on, 00:00 UTC. The epoch was a Thursday, so Mondays fall four days after a whole week. */
const RUNNING = Math.floor((now() - 4 * DAY) / WEEK) * WEEK + 4 * DAY;

/** One week, `back` weeks before the running one: the calls refused as malformed, of the real-work calls made. */
function week(back: number, numerator: number, denominator: number): PeriodFigure {
  const from = RUNNING - back * WEEK;
  const ended = back > 0;
  return {
    window: { from: iso(from), to: iso(from + WEEK), observedFrom: iso(from), observedThrough: iso(ended ? from + WEEK : now()), complete: ended },
    figure: denominator === 0
      ? { value: null, why: 'no_data' }
      : { value: (1000 * numerator) / denominator, why: denominator < 30 ? 'insufficient' : null },
    numerator, denominator,
  };
}

/** Oldest first, the running week last. */
const WEEKS = [week(5, 10, 100), week(4, 0, 0), week(3, 3, 12), week(2, 4, 200), week(1, 8, 125), week(0, 1, 5)];

/** `first`, `best`, `last` and `previous` are whole weeks with thirty calls or more; fewer malformed calls is better,
 *  so the best is the lowest rate, and the last week's is above the one before it. Three weeks are comparable and the
 *  last is not the best, so its finding is its counts, dated by the Monday it began. */
const MALFORMED: Measure = {
  key: 'malformed_per_1000', weeks: WEEKS,
  first: WEEKS[0], best: WEEKS[3], last: WEEKS[4], previous: WEEKS[3],
  highest: null, lowest: null,
  better: 'down', judgement: 'worsened',
  finding: { kind: 'count', text: '8 of 125 calls refused for their shape', dates: [WEEKS[4].window.from.slice(0, 10)], tie: false },
};

const NOT_BUILT = { state: 'unavailable', reason: 'not_built' } as const;

export const PLATFORM_STATUS: PlatformStatus = {
  meta: {
    asOf: iso(now()), timezone: 'UTC',
    period: { from: WEEKS[0].window.from, to: iso(now()) },
    scope: 'platform-public', population: 'real-work tool calls', coverageFrom: WEEKS[0].window.from,
  },
  needs: { state: 'unavailable', rows: [], total: null, knownCount: 0, unavailableKinds: ['bugs', 'evaluation', 'approvals', 'drift', 'door'], overflowByKind: {} },
  measures: [MALFORMED],
  records: NOT_BUILT, doors: NOT_BUILT, running: NOT_BUILT, own: NOT_BUILT,
};
