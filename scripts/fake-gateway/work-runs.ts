/**
 * The fake gateway's Runs: what `GET /api/console/runs?skill&limit&offset` answers, and the runs the team's use of each
 * plugin and skill is counted from.
 *
 * One fixture, every team's recorded skill runs, each from its first call to its last with the calls, the refusals and
 * the observed output (the response bytes of its own calls) the platform keeps on it, read for the caller's active
 * team over every run it recorded. Nothing is drawn as running: a run is `active` while its last call is within five
 * minutes of the cutoff, and a run of one call is said to be one.
 *
 * Atlas, which both people act for, holds six active runs (the ones Home names), two runs whose spans overlap, runs of
 * one call, a run whose output nothing measured, a skill with no run longer than one call, and more than ten runs, so
 * its recent runs page. Home's runs and Record's agents are read off these runs too (`observedRuns`).
 * Beacon's largest run is larger than any of atlas's, and is never in atlas's answer.
 *
 * COUPLED: zz-stack's `checks/console-work-runs.ts` imports this file with plain `node` and compares its key sets with
 * the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { RunRow, Runs, SkillRunRow } from '../../src/lib/destination-shapes.ts';
import { localDay, nextStart, now, startOf, weekdayHour } from './clock.ts';
import { NO_TEAM, pageParams } from './work-activity.ts';
import { iso, workMeta } from './work-initiatives.ts';

type Answer = [status: number, body: unknown];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** A run is active while its last call is this close to the cutoff. */
const ACTIVE_MS = 5 * MINUTE;

/** `[team, skill, initiative, began hours before the cutoff, minutes to its last call, calls, refused, bytes]`. */
type Seed = [team: string, skill: string, initiative: string | null, began: number, minutes: number, calls: number, refusals: number, bytes: number | null];
const SEEDS: Seed[] = [
  // Six with a last call in the last five minutes, active, across five initiatives and none, so Home groups them and
  // names four groups and one run more. This one's last call was two minutes ago.
  ['atlas', 'sdlc-execute', '2026-09-28-search-relevance', 40 / 60, 38, 52, 2, 412_000],
  // These two overlap for half an hour.
  ['atlas', 'sdlc-plan', '2026-09-28-search-relevance', 3, 50, 40, 3, 240_000],
  ['atlas', 'sdlc-plan-audit', '2026-09-28-search-relevance', 2.6, 25, 18, 0, 96_000],
  ['atlas', 'sdlc-spec', '2026-10-02-query-latency', 0.5, 27, 64, 5, 1_850_000],
  ['atlas', 'sdlc-spec-audit', '2026-10-02-query-latency', 0.4, 22, 22, 1, 120_000],
  // Active, and one call: a run of no length is still the one running.
  ['atlas', 'zz-platform', null, 0.02, 0, 1, 0, 2_400],
  // zz-handover has never run longer than one call, so it has no typical length.
  ['atlas', 'zz-handover', '2026-09-12-onboarding-revamp', 50, 0, 1, 0, 3_100],
  ['atlas', 'zz-handover', '2026-08-02-ingest-pipeline', 120, 0, 1, 0, 2_900],
  // Nothing measured its output.
  ['atlas', 'sdlc-explore', '2026-10-06-snippet-quality', 0.75, 42, 30, 1, null],
  ['atlas', 'sdlc-execute', '2026-10-03-ranking-weights', 90, 160, 140, 9, 3_200_000],
  ['atlas', 'sdlc-review', '2026-09-12-onboarding-revamp', 140, 35, 26, 0, 150_000],
  ['atlas', 'zz-platform', null, 160, 12, 8, 1, 30_000],
  ['atlas', 'sdlc-plan', '2026-10-03-ranking-weights', 1, 56, 44, 2, 260_000],
  ['atlas', 'sdlc-flow', null, 260, 5, 6, 0, 18_000],
  ['atlas', 'sdlc-spec', '2026-08-25-eval-harness', 400, 80, 70, 6, 900_000],
  ['atlas', 'sdlc-explore', '2026-08-14-citation-graph', 600, 40, 28, 0, 140_000],
  ['atlas', 'zz-access', null, 700, 3, 4, 1, 6_000],
  ['beacon', 'sdlc-spec', '2026-09-30-refund-flow', 10, 90, 120, 11, 9_400_000],
  ['beacon', 'sdlc-plan', '2026-09-30-refund-flow', 6, 30, 25, 0, 210_000],
  ['beacon', 'zz-platform', null, 48, 0, 1, 0, 1_800],
  ['cinder', 'sdlc-explore', '2026-08-20-incident-runbooks', 900, 20, 9, 1, 40_000],
];

/** A recorded run of any team: its row, and whose it is. */
export type TeamRun = RunRow & { team: string };

/** Every recorded run, as the platform keeps them, its state read against the cutoff. */
const RUNS: TeamRun[] = SEEDS.map(([team, skill, initiative, began, minutes, calls, refusals, bytes], i): TeamRun => {
  const start = now() - began * HOUR;
  const last = start + minutes * MINUTE;
  return {
    team, id: `run-${team}-${String(i + 1).padStart(2, '0')}`, skill, initiative, startedAt: iso(start), lastCallAt: iso(last),
    calls, refusals, bytes, lengthMs: last - start,
    state: now() - last <= ACTIVE_MS ? 'active' : calls === 1 ? 'one_call' : 'last_call',
  };
});

/** The runs of `team`, newest last call first, the id breaking a tie. */
export const runsOf = (team: string) => RUNS.filter((r) => r.team === team).sort((a, b) => b.lastCallAt.localeCompare(a.lastCallAt) || a.id.localeCompare(b.id));

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const row = ({ team: _team, ...r }: TeamRun): RunRow => { void _team; return r; };

/** The time the runs cover, overlapping spans counted once; the spans summed; and the most open at one instant, two
 *  runs that only touch not counted together. */
function coverageOf(runs: TeamRun[]): Runs['coverage'] {
  const spans = runs.map((r) => [Date.parse(r.startedAt), Date.parse(r.lastCallAt)] as const).sort((a, b) => a[0] - b[0]);
  let covered = 0, end = -Infinity;
  for (const [s, e] of spans) {
    if (e > end) { covered += e - Math.max(s, end); end = e; }
  }
  const edges = spans.flatMap(([s, e]) => (e > s ? [[s, 1], [e, -1]] : [])).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0, peak = 0;
  for (const [, d] of edges) { open += d; peak = Math.max(peak, open); }
  return { coverageMs: covered, summedMs: runs.reduce((n, r) => n + r.lengthMs, 0), peak, oneCall: runs.filter((r) => r.calls === 1).length };
}

/** What `team`'s runs did in `[fromMs, toMs)`, as Home and Record observe them: each run counted once, at its first
 *  call, when that is inside; its span clipped to the window for the time covered, summed and most open at once; and
 *  the counted runs by skill, by weekday and hour (Monday first) and by day, every day of the window named. */
export function observedRuns(team: string, fromMs: number, toMs: number) {
  const end = Math.min(toMs, now());
  const touching = RUNS.filter((r) => r.team === team && Date.parse(r.startedAt) < end && Date.parse(r.lastCallAt) >= fromMs);
  const clipped = touching.map((r) => ({ ...r, startedAt: iso(Math.max(Date.parse(r.startedAt), fromMs)), lastCallAt: iso(Math.min(Date.parse(r.lastCallAt), end)),
    lengthMs: Math.min(Date.parse(r.lastCallAt), end) - Math.max(Date.parse(r.startedAt), fromMs) }));
  const { coverageMs, summedMs, peak } = coverageOf(clipped);
  const counted = touching.filter((r) => Date.parse(r.startedAt) >= fromMs).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const skills = new Map<string, number>();
  for (const r of counted) skills.set(r.skill, (skills.get(r.skill) ?? 0) + 1);
  const byHour = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of counted) {
    const [weekday, hour] = weekdayHour(Date.parse(r.startedAt));
    byHour[weekday][hour] += 1;
  }
  const days: { day: string; runs: number }[] = [];
  for (let at = startOf(fromMs, 'day'); at < end; at = nextStart(at, 'day')) {
    const day = localDay(at);
    days.push({ day, runs: counted.filter((r) => localDay(Date.parse(r.startedAt)) === day).length });
  }
  return {
    runs: counted.length, zeroLength: counted.filter((r) => r.lengthMs === 0).length, coverageMs, summedMs, peak,
    bySkill: [...skills.entries()].map(([skill, runs]) => ({ skill, runs })).sort((a, b) => b.runs - a.runs || a.skill.localeCompare(b.skill)),
    weekdayHour: byHour, days,
  };
}

/** One skill's runs, as the by-skill table reads them. */
function bySkill(skill: string, runs: TeamRun[]): SkillRunRow {
  const calls = runs.reduce((n, r) => n + r.calls, 0);
  const timed = runs.filter((r) => r.calls > 1);
  const measured = runs.flatMap((r) => (r.bytes === null ? [] : [r.bytes]));
  return {
    skill, runs: runs.length, callsPerRun: calls / runs.length,
    shareRefused: calls ? runs.reduce((n, r) => n + r.refusals, 0) / calls : null,
    outputPerRun: mean(measured), typicalMs: median(timed.map((r) => r.lengthMs)), timed: timed.length,
  };
}

/** `GET /runs?skill&limit&offset`, as `who`: the active team's runs since its first, narrowed to one skill when asked. */
export function runs(who: Me, q: URLSearchParams): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const page = pageParams(q, ['skill']);
  if (typeof page === 'string') return [400, { error: page }];
  const skill = q.get('skill');
  // A skill the team never ran answers nothing, not a refusal.
  const mine = runsOf(team).filter((r) => skill === null || r.skill === skill);
  const measured = mine.filter((r) => r.bytes !== null);
  const output = mean(measured.map((r) => r.bytes!));
  const largest = measured.reduce<TeamRun | null>((a, r) => (!a || r.bytes! > a.bytes! ? r : a), null);
  const skills = [...new Set(mine.map((r) => r.skill))];
  const since = mine.length ? mine.reduce((a, r) => (r.startedAt < a ? r.startedAt : a), mine[0].startedAt) : null;
  const meta = workMeta('active-team', skill === null
    ? `${team}'s recorded skill runs, every one since its first`
    : `${team}'s recorded runs of ${skill}, every one since its first`);
  const answer: Runs = {
    // The period is the team's record, from its first run to the cutoff, as the gateway states it.
    meta: { ...meta, period: { from: since ?? meta.asOf, to: meta.asOf }, coverageFrom: since },
    since,
    tiles: {
      runs: { value: mine.length, why: null },
      outputPerRun: { value: output === null ? null : Math.round(output), why: output === null ? 'no_data' : null, unmeasured: mine.length - measured.length },
      largest: largest && row(largest),
    },
    coverage: coverageOf(mine),
    // The most observed output per run first, a skill nothing measured last, then by name.
    bySkill: { state: 'ok', data: { rows: skills.map((s) => bySkill(s, mine.filter((r) => r.skill === s)))
      .sort((a, b) => (b.outputPerRun ?? -1) - (a.outputPerRun ?? -1) || a.skill.localeCompare(b.skill)) } },
    recent: { state: 'ok', data: { rows: mine.slice(page.offset, page.offset + page.limit).map(row), total: mine.length } },
  };
  return [200, answer];
}
