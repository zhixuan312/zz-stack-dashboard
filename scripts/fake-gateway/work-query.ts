/**
 * The fake gateway's prepared queries: what `GET /api/console/work/query?measure&by&from&to&compare&state&flow&q&group
 * &limit&offset` answers.
 *
 * One question at a time, over the rows Work's pages reduce: the initiatives list's for closures and opened work, the
 * approvals fixture's for the caller's approvals, rows of its own here for words added, lessons, runs and searches, all
 * in the active team and dated in the status fixture's weeks; and the destinations' own fixtures for the rest: Activity's
 * log for calls and refusals, Runs' runs for output and for the calls of each plugin's skills, as Plugins counts them,
 * and Knowledge's shelf, as of the window's end. Each measure is grouped by one of the dimensions it allows, in a window
 * that defaults to the last whole week, against the previous window of the same length when asked (never for the shelf,
 * a stock), and down to one group's rows, paged. Nothing is answered that a page could not show this person: approvals
 * are the caller's own, no row carries a body, and a question is answered only in the searches that found nothing.
 *
 * Refused as the gateway refuses them, with 400 naming the allowed values and before anything is read: an unknown
 * measure, an unknown dimension, one the measure does not allow, or a drill of skill_calls, whose groups are its rows.
 *
 * COUPLED: zz-stack's `checks/console-work-query.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { ActivityLog, ActivityRow } from '../../src/lib/destination-shapes.ts';
import type { Figure, Window } from '../../src/lib/platform-shapes.ts';
import type { WorkQuery, WorkQueryRow } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { CATALOG_SKILLS } from './platform.ts';
import { activityLog } from './work-activity.ts';
import { callerApprovalRows } from './work-approvals.ts';
import { LAST_WEEK, WEEKS, filtered, inWeek, iso, listParams, workMeta } from './work-initiatives.ts';
import { IMPORTED, SHELF } from './work-knowledge.ts';
import { runsOf } from './work-runs.ts';

type Answer = [status: number, body: unknown];

const DAY = 24 * 3_600_000;

/** Each measure and the dimensions it may be grouped by. */
const MEASURES = {
  closures: ['outcome', 'flow', 'initiative', 'period'],
  opened: ['flow', 'period'],
  words: ['document', 'initiative', 'period'],
  approvals: ['presentation', 'decision_basis', 'initiative', 'period'],
  lessons: ['kind', 'period'],
  runs: ['skill', 'initiative', 'weekday', 'hour', 'period'],
  searches: ['found', 'period'],
  calls: ['tool', 'initiative', 'refused', 'period'],
  refusals: ['owner', 'tool', 'initiative', 'period'],
  output: ['skill', 'initiative', 'period'],
  skill_calls: ['plugin', 'skill', 'period'],
  shelf: ['kind', 'standing'],
} as const;
type Measure = keyof typeof MEASURES;
/** The groups a dimension always answers, an empty one as zero. */
const FIXED: Record<string, string[]> = { owner: ['guardrail', 'ours', 'theirs', 'other'], refused: ['refused', 'answered'], standing: ['standing', 'superseded'] };

/** One row a measure counts: when it happened, what it adds to the value (null for a run that measured no output), and
 *  its key along each dimension. */
type Fact = { at: string; value: number | null; keys: Record<string, string>; row: WorkQueryRow | null; imported?: boolean };
type Counted = WorkQuery['total'];

const at = (back: number, hours: number) => iso(inWeek(back, hours));

/** Words added, by document and week. */
const WORDS: [initiative: string, path: string, added: number, back: number, hours: number][] = [
  ['2026-09-28-search-relevance', 'spec.md', 6_200, 4, 30], ['2026-09-28-search-relevance', 'plan.md', 9_100, 2, 50],
  ['2026-10-08-result-explanations', 'spec.md', 4_400, 2, 90], ['2026-10-08-result-explanations', 'plan.md', 5_300, 1, 20],
  ['2026-10-08-result-explanations', 'review.md', 2_100, 1, 70], ['2026-10-02-query-latency', 'spec.md', 1_700, 1, 110],
  ['2026-10-03-ranking-weights', 'spec.md', 2_100, 0, 0],
];
const LESSONS: [kind: string, back: number, hours: number, words: number][] = [['decision', 4, 20, 140], ['gotcha', 2, 40, 95], ['convention', 1, 30, 120], ['decision', 1, 60, 80]];
const RUNS: [skill: string, initiative: string | null, back: number, hours: number, minutes: number][] = [
  ['sdlc-spec', '2026-10-02-query-latency', 1, 10, 42], ['sdlc-plan', '2026-09-28-search-relevance', 1, 34, 95],
  ['sdlc-plan-audit', '2026-09-28-search-relevance', 1, 58, 18], ['sdlc-review', '2026-10-08-result-explanations', 1, 80, 64],
  ['zz-tldr', null, 1, 120, 3], ['sdlc-spec', '2026-10-03-ranking-weights', 2, 30, 51], ['sdlc-explore', '2026-10-06-snippet-quality', 3, 12, 27],
];
/** `[found, weeks back, hours, the question as Knowledge lists one that found nothing]`. */
const SEARCHES: [found: boolean, back: number, hours: number, question: string][] = [
  [true, 1, 9, 'recency 1'], [true, 1, 33, 'recency 2'], [false, 1, 47, 'where is the ranking eval'], [true, 1, 95, 'recency 3'],
  [true, 2, 12, 'recency 4'], [false, 3, 70, 'how do we rotate the signing key'],
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The active team's real-work tool calls, every page of Activity's log. */
function callsOf(who: Me): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const [, log] = activityLog(who, new URLSearchParams({ kind: 'tool_call', limit: '100', offset: String(offset) })) as [number, ActivityLog];
    rows.push(...log.rows);
    if (rows.length >= log.total) return rows;
  }
}

/** Every row `measure` counts for `who`, with Initiatives' filters applied to the measures over initiatives; the shelf
 *  as of `end`. */
function factsOf(measure: Measure, who: Me, p: { state: string | null; flow: string | null; q: string }, end: number): Fact[] {
  const team = who.activeTeam;
  switch (measure) {
    case 'closures': return filtered(team, p).filter((r) => r.closed !== null)
      .map((r) => ({ at: r.closed!, value: 1, keys: { outcome: r.state, flow: r.flow ?? 'none', initiative: r.slug }, row: { ...r } }));
    case 'opened': return filtered(team, p).map((r) => ({ at: r.opened, value: 1, keys: { flow: r.flow ?? 'none' }, row: { ...r } }));
    // A lesson's words count as Home's do, grouped as lessons: a lesson is no document and has no initiative.
    case 'words': return team !== 'atlas' ? [] : [
      ...WORDS.map(([initiative, path, added, back, hours]) =>
        ({ at: at(back, hours), value: added, keys: { document: `${initiative}/${path}`, initiative }, row: { initiative, path, added } })),
      ...LESSONS.map(([, back, hours, added]) =>
        ({ at: at(back, hours), value: added, keys: { document: 'lessons', initiative: 'lessons' }, row: { initiative: null, path: null, added } })),
    ];
    case 'approvals': return callerApprovalRows(team, who.email).map((a) =>
      ({ at: a.approvedAt, value: 1, keys: { presentation: a.presentation, decision_basis: a.decisionBasis, initiative: a.initiative }, row: a }));
    case 'lessons': return team !== 'atlas' ? [] : LESSONS.map(([kind, back, hours]) => ({ at: at(back, hours), value: 1, keys: { kind }, row: { kind, at: at(back, hours) } }));
    case 'runs': return team !== 'atlas' ? [] : RUNS.map(([skill, initiative, back, hours, minutes]) => {
      const startedAt = at(back, hours);
      const d = new Date(startedAt);
      return { at: startedAt, value: 1, keys: { skill, initiative: initiative ?? 'none', weekday: WEEKDAYS[(d.getUTCDay() + 6) % 7], hour: String(d.getUTCHours()).padStart(2, '0') },
        row: { skill, initiative, startedAt, lengthMs: minutes * 60_000 } };
    });
    case 'searches': return team !== 'atlas' ? [] : SEARCHES.map(([found, back, hours, question]) =>
      ({ at: at(back, hours), value: 1, keys: { found: found ? 'found' : 'none' }, row: { at: at(back, hours), found, question: found ? null : question } }));
    case 'calls':
    case 'refusals': return callsOf(who).filter((r) => measure === 'calls' || r.ok === false).map((r) => ({
      at: r.ts, value: 1, row: r,
      keys: { tool: r.tool ?? 'none', initiative: r.initiative ?? 'none', refused: r.ok === false ? 'refused' : 'answered', owner: r.owner ?? '' },
    }));
    case 'output': return team === null ? [] : runsOf(team).map(({ team: _t, ...r }) => {
      void _t;
      return { at: r.startedAt, value: r.bytes, keys: { skill: r.skill, initiative: r.initiative ?? 'none' }, row: r };
    });
    // Each run's calls of a skill a plugin ships, as Plugins counts the team's.
    case 'skill_calls': return team === null ? [] : runsOf(team).flatMap((r) => {
      const plugin = CATALOG_SKILLS.find((s) => s.name === r.skill)?.plugin;
      return plugin ? [{ at: r.startedAt, value: r.calls, keys: { plugin, skill: r.skill }, row: null }] : [];
    });
    // A stock: the lessons made before the window's end, as they stand now.
    case 'shelf': return SHELF.filter((n) => n.team === team && (n.status === 'adopted' || n.status === 'superseded') && Date.parse(n.updated) < end)
      .map((n) => ({
        at: n.updated, value: 1, row: n, imported: n.status === 'adopted' && IMPORTED.has(n.key),
        keys: { kind: n.type, standing: n.status === 'adopted' ? 'standing' : 'superseded' },
      }));
  }
}

/** What facts add up to: for output, beside it the runs that measured none, and no_data where every run did; for the
 *  shelf, beside it its standing lessons an import made. */
function countOf(measure: Measure, fs: Fact[]): Counted {
  const measured = fs.filter((f) => f.value !== null);
  const sum: Figure = fs.length && !measured.length ? { value: null, why: 'no_data' } : figure(measured.reduce((n, f) => n + f.value!, 0));
  if (measure === 'output') return { ...sum, unmeasured: fs.length - measured.length };
  if (measure === 'shelf') return { ...sum, imported: fs.filter((f) => f.imported).length };
  return sum;
}

/** The grain `period` groups by, for a window this long: weeks up to 26, months up to three years, quarters beyond. */
const grainFor = (ms: number): 'week' | 'month' | 'quarter' => (ms <= 26 * 7 * DAY ? 'week' : ms <= 3 * 366 * DAY ? 'month' : 'quarter');

/** The periods of `[from, to)` at `grain`, the first starting at `from`. */
function periods(from: number, to: number, grain: 'week' | 'month' | 'quarter'): Window[] {
  const out: Window[] = [];
  for (let s = from; s < to;) {
    const d = new Date(s);
    const e = grain === 'week' ? s + 7 * DAY : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (grain === 'month' ? 1 : 3), 1);
    const end = Math.min(e, to);
    out.push({ from: iso(s), to: iso(end), observedFrom: iso(s), observedThrough: iso(Math.min(end, now())), complete: end <= now() });
    s = e;
  }
  return out;
}

const figure = (n: number): Figure => ({ value: n, why: null });
const instant = (s: string | null) => (s === null ? NaN : Date.parse(s));
/** When a fact happened; one dated by its day alone, at that day's start. */
const msOf = (f: Fact) => Date.parse(f.at.length === 10 ? `${f.at}T00:00:00Z` : f.at);

/** `GET /work/query`, as `who`. */
export function workQuery(who: Me, q: URLSearchParams): Answer {
  const measure = q.get('measure') ?? '';
  if (!(measure in MEASURES)) return [400, { error: `measure must be one of ${Object.keys(MEASURES).join(', ')}` }];
  const allowed = MEASURES[measure as Measure] as readonly string[];
  const by = q.get('by') ?? '';
  if (!allowed.includes(by)) return [400, { error: `${measure} is grouped by one of ${allowed.join(', ')}` }];
  const compare = q.get('compare');
  if (compare !== null && compare !== 'previous') return [400, { error: 'compare must be previous, or left out' }];
  if (measure === 'skill_calls' && q.get('group') !== null) return [400, { error: 'skill_calls is not drilled: its groups are its rows' }];
  const p = listParams(q);
  if (typeof p === 'string') return [400, { error: p }];
  const from = q.get('from') === null ? Date.parse(WEEKS[LAST_WEEK].from) : instant(q.get('from'));
  const to = q.get('to') === null ? Date.parse(WEEKS[LAST_WEEK].to) : instant(q.get('to'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return [400, { error: 'from and to must be ISO 8601 instants, from before to' }];

  const facts = factsOf(measure as Measure, who, p, Math.min(to, now()));
  const stock = measure === 'shelf';
  const span = to - from;
  const grain = by === 'period' ? grainFor(span) : null;
  const buckets = grain ? periods(from, to, grain) : [];
  /** A fact's group: its period's start, or its key along `by`; `shift` moves a fact of the previous window into this one. */
  const keyOf = (f: Fact, shift = 0) => (grain ? buckets.find((w) => msOf(f) + shift >= Date.parse(w.from) && msOf(f) + shift < Date.parse(w.to))?.from ?? '' : f.keys[by]);
  const inWindow = stock ? facts : facts.filter((f) => msOf(f) >= from && msOf(f) < to);
  const before = facts.filter((f) => msOf(f) >= from - span && msOf(f) < from);
  const count = (fs: Fact[]) => countOf(measure as Measure, fs);
  const total = count(inWindow);
  const keys = grain ? buckets.map((w) => w.from) : [...new Set([...(FIXED[by] ?? []), ...inWindow.map((f) => keyOf(f))])];
  const groups = keys.map((key) => {
    const value = count(inWindow.filter((f) => keyOf(f) === key));
    return {
      key, label: grain ? `${grain === 'week' ? 'Week' : grain === 'month' ? 'Month' : 'Quarter'} from ${key.slice(0, 10)}`
        : key === 'lessons' ? 'Lessons' : FIXED[by] && by !== 'owner' ? key[0].toUpperCase() + key.slice(1) : key,
      value, share: total.value ? (value.value ?? 0) / total.value : null,
      previous: compare && !stock ? count(before.filter((f) => keyOf(f, span) === key)) : null,
    };
  });
  if (!grain) groups.sort((a, b) => (b.value.value ?? -1) - (a.value.value ?? -1) || a.key.localeCompare(b.key));
  const kept = grain ? groups : groups.slice(0, 20);
  const folded = grain ? [] : groups.slice(20);
  const group = q.get('group');
  const drilled = group === null ? null : inWindow.filter((f) => keyOf(f) === group).sort((a, b) => msOf(b) - msOf(a));
  const asked: WorkQuery = {
    meta: { ...workMeta(measure === 'approvals' ? 'caller-in-active-team' : 'active-team', `${who.activeTeam}'s ${measure.replace('_', ' ')}${measure === 'approvals' ? ' signed in the caller\'s name' : ''}`), period: { from: iso(from), to: iso(to) } },
    measure, by,
    window: { from: iso(from), to: iso(to), observedFrom: iso(from), observedThrough: iso(Math.min(to, now())), complete: to <= now() },
    grain,
    groups: kept,
    rest: folded.length ? { groups: folded.length, value: folded.reduce((n, g) => n + (g.value.value ?? 0), 0) } : null,
    total,
    rows: drilled === null ? null : { state: 'ok', data: { rows: drilled.slice(p.offset, p.offset + p.limit).map((f) => f.row!), total: drilled.length } },
  };
  return [200, asked];
}
