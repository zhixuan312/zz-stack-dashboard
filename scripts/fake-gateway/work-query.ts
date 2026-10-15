/**
 * The fake gateway's prepared queries: what `GET /api/console/work/query?measure&by&from&to&compare&state&flow&q&group
 * &limit&offset` answers.
 *
 * One question at a time, over the rows Work's pages reduce: the initiatives list's for closures and opened work, the
 * approvals fixture's for the caller's approvals, and rows of its own here for words added, lessons, runs and searches,
 * all in the active team and dated in the status fixture's weeks. Each measure is grouped by one of the dimensions it
 * allows, in a window that defaults to the last whole week, against the previous window of the same length when asked,
 * and down to one group's rows, paged. Nothing is answered that a Work page could not show this person: approvals are
 * the caller's own, and no row carries a body or a question's text.
 *
 * Refused as the gateway refuses them, with 400 naming the allowed values and before anything is read: an unknown
 * measure, an unknown dimension, or one the measure does not allow.
 *
 * COUPLED: zz-stack's `checks/console-work-query.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { Figure, Window } from '../../src/lib/platform-shapes.ts';
import type { WorkQuery, WorkQueryRow } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { callerApprovalRows } from './work-approvals.ts';
import { LAST_WEEK, WEEKS, filtered, inWeek, iso, listParams, workMeta } from './work-initiatives.ts';

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
} as const;
type Measure = keyof typeof MEASURES;

/** One row a measure counts: when it happened, what it adds to the value, and its key along each dimension. */
type Fact = { at: string; value: number; keys: Record<string, string>; row: WorkQueryRow };

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
const SEARCHES: [found: boolean, back: number, hours: number][] = [[true, 1, 9], [true, 1, 33], [false, 1, 47], [true, 1, 95], [true, 2, 12], [false, 3, 70]];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Every row `measure` counts for `who`, with Initiatives' filters applied to the measures over initiatives. */
function factsOf(measure: Measure, who: Me, p: { state: string | null; flow: string | null; q: string }): Fact[] {
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
    case 'searches': return team !== 'atlas' ? [] : SEARCHES.map(([found, back, hours]) =>
      ({ at: at(back, hours), value: 1, keys: { found: found ? 'found' : 'none' }, row: { at: at(back, hours), found } }));
  }
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
  const p = listParams(q);
  if (typeof p === 'string') return [400, { error: p }];
  const from = q.get('from') === null ? Date.parse(WEEKS[LAST_WEEK].from) : instant(q.get('from'));
  const to = q.get('to') === null ? Date.parse(WEEKS[LAST_WEEK].to) : instant(q.get('to'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return [400, { error: 'from and to must be ISO 8601 instants, from before to' }];

  const facts = factsOf(measure as Measure, who, p);
  const span = to - from;
  const grain = by === 'period' ? grainFor(span) : null;
  const buckets = grain ? periods(from, to, grain) : [];
  /** A fact's group: its period's start, or its key along `by`; `shift` moves a fact of the previous window into this one. */
  const keyOf = (f: Fact, shift = 0) => (grain ? buckets.find((w) => msOf(f) + shift >= Date.parse(w.from) && msOf(f) + shift < Date.parse(w.to))?.from ?? '' : f.keys[by]);
  const inWindow = facts.filter((f) => msOf(f) >= from && msOf(f) < to);
  const before = facts.filter((f) => msOf(f) >= from - span && msOf(f) < from);
  const sum = (fs: Fact[]) => fs.reduce((n, f) => n + f.value, 0);
  const total = sum(inWindow);
  const keys = grain ? buckets.map((w) => w.from) : [...new Set(inWindow.map((f) => keyOf(f)))];
  const groups = keys.map((key) => {
    const value = sum(inWindow.filter((f) => keyOf(f) === key));
    return {
      key, label: grain ? `${grain === 'week' ? 'Week' : grain === 'month' ? 'Month' : 'Quarter'} from ${key.slice(0, 10)}` : key === 'lessons' ? 'Lessons' : key,
      value: figure(value), share: total ? value / total : null,
      previous: compare ? figure(sum(before.filter((f) => keyOf(f, span) === key))) : null,
    };
  });
  if (!grain) groups.sort((a, b) => (b.value.value ?? 0) - (a.value.value ?? 0) || a.key.localeCompare(b.key));
  const kept = grain ? groups : groups.slice(0, 20);
  const folded = grain ? [] : groups.slice(20);
  const group = q.get('group');
  const drilled = group === null ? null : inWindow.filter((f) => keyOf(f) === group).sort((a, b) => msOf(b) - msOf(a));
  const asked: WorkQuery = {
    meta: { ...workMeta(measure === 'approvals' ? 'caller-in-active-team' : 'active-team', `${who.activeTeam}'s ${measure}${measure === 'approvals' ? ' signed in the caller\'s name' : ''}`), period: { from: iso(from), to: iso(to) } },
    measure, by,
    window: { from: iso(from), to: iso(to), observedFrom: iso(from), observedThrough: iso(Math.min(to, now())), complete: to <= now() },
    grain,
    groups: kept,
    rest: folded.length ? { groups: folded.length, value: folded.reduce((n, g) => n + (g.value.value ?? 0), 0) } : null,
    total: figure(total),
    rows: drilled === null ? null : { state: 'ok', data: { rows: drilled.slice(p.offset, p.offset + p.limit).map((f) => f.row), total: drilled.length } },
  };
  return [200, asked];
}
