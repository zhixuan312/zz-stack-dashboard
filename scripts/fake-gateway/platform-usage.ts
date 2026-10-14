/**
 * The fake gateway's usage: what `GET /api/console/platform/usage` answers, to everyone signed in.
 *
 * One fixture, the usage as the superadmin reads it. A member's answer is derived from it by the gateway's projection
 * rule and never written by hand: every week's split by team is null, so no team is named. Tool names are the
 * registered ones for both people, and a call to a tool no door registers is counted under `Unregistered tools`.
 *
 * Every figure counts real work but the platform's own traffic and all refusals by population, which count maintenance
 * as its own part. The weeks are the status fixture's, and so are the calls, the share refused (its refusals), the
 * slowest 5% of calls, the sessions and the refusals put right; the teams' calls are the teams fixture's, more than four
 * of them with calls, so the fourth part is `Other`. The weeks hold a running week and one with no calls at all.
 *
 * COUPLED: zz-stack's `checks/console-platform-usage.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias, and every part is `ok`.
 */
import type { ModelWeek, Tile, Usage } from '../../src/lib/fleet-shapes.ts';
import type { Figure, Measure, PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { now } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { CALLS_BY_TEAM } from './platform-teams.ts';

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const measure = (key: Measure['key']) => PLATFORM_STATUS.measures.find((m) => m.key === key)!;
const MALFORMED = measure('malformed_per_1000');
const FOLLOWUP = measure('same_tool_followup_pct');
/** The status fixture's weeks, oldest first, the running one last; `LAST` is the last complete week. */
const WEEKS = MALFORMED.weeks.map((w) => w.window);
const LAST = WEEKS.length - 2;
/** Real-work calls by week: the malformed-call measure's denominators. */
const CALLS = MALFORMED.weeks.map((w) => w.denominator!);
/** Real-work refusals by week, every owner's: the follow-up measure's refusals. */
const REFUSALS = FOLLOWUP.followupCounts!.map((c) => c.refusals);

const stands = (value: number): Figure => ({ value, why: null });
const tally = (i: number, n: number): PeriodFigure => ({ window: WEEKS[i], figure: stands(n), numerator: n, denominator: null });
/** A share of `scale` per `denominator`; no denominator is no share, and under `min` it is kept as insufficient. */
function rate(i: number, numerator: number, denominator: number, scale: number, min = 30): PeriodFigure {
  return {
    window: WEEKS[i], numerator, denominator,
    figure: denominator === 0 ? { value: null, why: 'no_data' } : { value: (scale * numerator) / denominator, why: denominator < min ? 'insufficient' : null },
  };
}
const tile = (weeks: PeriodFigure[]): Tile => ({ weeks, last: weeks[LAST], previous: weeks[LAST - 1] });

/* By team: the three with the most calls over the weeks shown, and every other team as `Other`. */
const RANKED = [...CALLS_BY_TEAM].map((t) => ({ ...t, total: t.calls.reduce((n, c) => n + c, 0) }))
  .sort((a, b) => b.total - a.total || a.team.localeCompare(b.team));
const NAMED = RANKED.slice(0, 3);
const OTHERS = RANKED.slice(3);
const partsOf = (i: number) => [
  ...NAMED.map((t) => ({ label: t.team, calls: t.calls[i] })),
  { label: 'Other', calls: OTHERS.reduce((n, t) => n + t.calls[i], 0) },
];

/* Refusals put right: the status measure's weeks, the median seconds to the first qualifying call among the matched
 * refusals, the refused sessions that went on, and the refusals that cannot be judged (no session, or still inside the
 * lookahead). Under thirty matched refusals a median is kept as insufficient. */
const MEDIAN_SECONDS = [38, null, 52, 31, 27, 12];
const CONTINUED: [continued: number, refusedSessions: number][] = [[9, 11], [0, 0], [2, 2], [15, 18], [14, 16], [1, 1]];
const FOLLOWUP_WEEKS = FOLLOWUP.weeks.map((putRight, i) => {
  const matched = putRight.numerator ?? 0;
  const seconds = MEDIAN_SECONDS[i];
  const c = FOLLOWUP.followupCounts![i];
  return {
    window: WEEKS[i], putRight,
    medianSeconds: (seconds === null || matched === 0 ? { value: null, why: 'no_data' } : { value: seconds, why: matched < 30 ? 'insufficient' : null }) as Figure,
    sessionsContinued: rate(i, CONTINUED[i][0], CONTINUED[i][1], 100),
    unassessable: c.missingSession + c.withinLookahead,
  };
});

/* Each registered tool's median call in its first comparable week (the first complete week with thirty calls that have
 * a duration; failing that, the first with any) and in the last complete week, whose median is insufficient under
 * thirty; `calls` are the calls the median is over. */
const TOOLS: [tool: string, first: number, firstMs: number, firstCalls: number, lastMs: number, lastCalls: number][] = [
  ['core:document_read', 0, 610, 48, 540, 52],
  ['core:knowledge_search', 3, 880, 31, 910, 40],
  ['core:skill_read', 0, 120, 35, 140, 12],
];
const median = (ms: number, calls: number): Figure => ({ value: ms, why: calls < 30 ? 'insufficient' : null });

/* The last complete week's calls by tool, every one of its 125: the registered tools, and the calls to a tool no door
 * registers, counted under one label so the name a caller sent is never answered. */
const MOST_USED = [
  { tool: 'core:document_read', calls: 52 }, { tool: 'core:knowledge_search', calls: 40 }, { tool: 'core:skill_read', calls: 12 },
  { tool: 'core:document_write', calls: 8 }, { tool: 'core:initiative_status', calls: 5 }, { tool: 'Unregistered tools', calls: 3 },
  { tool: 'core:bug_report', calls: 3 }, { tool: 'manage:whoami', calls: 2 },
];

/** Real-work calls by local weekday and hour over the complete weeks shown, Monday first: weekdays nine to five, and
 *  one late evening. */
function rhythm(): number[][] {
  const calls = CALLS.slice(0, -1).reduce((n, c) => n + c, 0);
  const values = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  values[2][22] = 5;
  const cells = Array.from({ length: 5 * 9 }, (_, k) => [Math.floor(k / 9), 9 + (k % 9)] as const);
  const each = Math.floor((calls - 5) / cells.length);
  let rest = calls - 5 - each * cells.length;
  for (const [d, h] of cells) values[d][h] = each + (rest-- > 0 ? 1 : 0);
  return values;
}

const modelWeek = (i: number, calls: number, failed: number, inputTokens: number, outputTokens: number): ModelWeek =>
  ({ window: WEEKS[i], calls, failed, inputTokens, outputTokens });

/** `GET /platform/usage`, public by route: the superadmin's weeks carry their split by team, a member's none, and
 *  nothing else differs. */
export function usage(admin: boolean): Usage {
  const asOf = iso(now());
  return {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: WEEKS[0].from, to: asOf }, scope: 'platform-public',
      population: "real-work tool calls; the platform's own traffic and all refusals by population also count maintenance calls; calls per approval divide by the approvals zz-core recorded; model calls are the platform's own" },
    tiles: { state: 'ok', data: {
      calls: tile(CALLS.map((n, i) => tally(i, n))),
      refusedShare: tile(REFUSALS.map((n, i) => rate(i, n, CALLS[i], 100))),
      p95Ms: tile(measure('call_p95_ms').weeks),
      sessions: tile(measure('sessions').weeks),
    } },
    callsByWeek: { state: 'ok', data: { weeks: WEEKS.map((window, i) => ({ window, calls: stands(CALLS[i]), parts: admin ? partsOf(i) : null })) } },
    traffic: { state: 'ok', data: { window: WEEKS[LAST], work: CALLS[LAST], maintenance: 54 } },
    refusals: { state: 'ok', data: { window: WEEKS[LAST], guardrail: 41, ours: 6, theirs: 9, other: REFUSALS[LAST] - 56, maintenance: 10 } },
    followup: { state: 'ok', data: { weeks: FOLLOWUP_WEEKS } },
    tools: { state: 'ok', data: {
      rows: TOOLS.map(([tool, first, firstMs, firstCalls, lastMs, lastCalls]) => ({
        tool,
        first: { window: WEEKS[first], medianMs: median(firstMs, firstCalls), calls: firstCalls },
        last: { window: WEEKS[LAST], medianMs: median(lastMs, lastCalls), calls: lastCalls },
      })),
      total: MOST_USED.filter((t) => t.tool !== 'Unregistered tools').length,
    } },
    rhythm: { state: 'ok', data: {
      timezone: PLATFORM_STATUS.meta.timezone,
      window: { from: WEEKS[0].from, to: WEEKS[LAST].to, observedFrom: WEEKS[0].from, observedThrough: WEEKS[LAST].to, complete: true },
      values: rhythm(),
    } },
    mostUsed: { state: 'ok', data: { rows: MOST_USED.slice(0, 10), total: MOST_USED.filter((t) => t.tool !== 'Unregistered tools').length } },
    perApproval: { state: 'ok', data: { last: rate(LAST, CALLS[LAST], 5, 1, 0), previous: rate(LAST - 1, CALLS[LAST - 1], 8, 1, 0) } },
    modelCalls: { state: 'ok', data: {
      last: modelWeek(LAST, 412, 3, 1_204_330, 88_120), previous: modelWeek(LAST - 1, 377, 0, 1_098_412, 80_906),
      byPurpose: [{ purpose: 'typed-judge', calls: 405 }, { purpose: 'failure-discover', calls: 7 }],
      cost: 'not_recorded',
    } },
  };
}
