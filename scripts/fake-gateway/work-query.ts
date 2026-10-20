/**
 * The fake gateway's prepared queries: what `GET /api/console/work/query?measure&by&from&to&compare&where&state&flow&q
 * &group&rows&top&limit&offset` answers.
 *
 * One question at a time, over the rows Work's pages reduce, never rows of its own, so every figure it answers over a
 * window a page draws is that page's figure: the initiatives list's for closures and opened work, the approvals
 * fixture's for the caller's approvals, Home's additions for words added, as Home and Record count them, each week's
 * written in the active team's documents and lessons by one rule (`wordsOf`), Knowledge's lessons made and searches,
 * as Home, Record and Knowledge count them, Activity's log for calls and refusals, Runs' runs for runs, for output and
 * for the calls of each plugin's skills, as Plugins counts them, and Knowledge's shelf, as of the window's end. Each measure is grouped by one of the dimensions it allows or, where it
 * takes period, by a bucket of days (day, week, month, weekday, as work-query-buckets.ts keys them; runs keeps weekday as
 * its own dimension), in a window that defaults to the last whole week, against the previous window of the same length
 * when asked (never for the shelf, a stock), and down to one group's rows, paged, or the newest rows of the window.
 * Nothing is answered that a page could not show this person: approvals are the caller's own, no row carries a body,
 * and a question is answered only in the searches that found nothing.
 *
 * The window is two instants or two dates, a date the whole of its day; a bound left out is the last whole week's, and a
 * from of 0001-01-01, which ZZ Meridian's runner sends for all, is the first day the measure's rows hold, found before
 * the where filters. where filters on the measure's own dimensions, equality alone, at most four. A bucket answers the
 * latest top of the window's buckets, the earlier folded, a day, week or month's previous the same bucket of the window
 * before by position and a weekday's the same weekday; period keeps its own grain, every period and none folded; any
 * other dimension answers its top largest groups, the key breaking a tie.
 *
 * Refused as the gateway refuses them, with 400 and the gateway's own sentences, naming the allowed values, never
 * echoing a value sent, and before anything is read: an unknown measure, an unknown dimension or one the measure does
 * not allow, a filter it does not take or outside a closed vocabulary, a date and an instant in one window, top on
 * period, rows beside group, limit or offset, or a drill of skill_calls, whose groups are its rows.
 *
 * COUPLED: the gateway's `services/gateway/src/console/work-query.ts`, whose sentences these are, and zz-stack's
 * `checks/console-work-query.ts` and `checks/console-work-query-destinations.ts`, which import this file with plain
 * `node` and compare its key sets with the real route's answer. So nothing here is imported through the console's path
 * alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { ActivityLog, ActivityRow } from '../../src/lib/destination-shapes.ts';
import type { Figure, Window } from '../../src/lib/platform-shapes.ts';
import type { WorkQuery, WorkQueryRow } from '../../src/lib/work-shapes.ts';
import { localDay, midnight, now, nextStart, startOf, weekdayHour } from './clock.ts';
import { CATALOG_SKILLS } from './platform.ts';
import { initiativeDetail } from './work.ts';
import { activityLog } from './work-activity.ts';
import { callerApprovalRows } from './work-approvals.ts';
import { ADDITIONS } from './work-home.ts';
import { LAST_WEEK, WEEKS, filtered, iso, listParams, rowsOf, workMeta } from './work-initiatives.ts';
import { IMPORTED, SHELF, lessonsMade, searchesOf } from './work-knowledge.ts';
import { BUCKETS, WEEKDAYS, addDays, bucketLabel, bucketOf, bucketsOf, isDate, type Bucket } from './work-query-buckets.ts';
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
const FIXED: Record<string, readonly string[]> = { owner: ['guardrail', 'ours', 'theirs', 'other'], refused: ['refused', 'answered'], standing: ['standing', 'superseded'] };
/** The values a filter on a closed dimension may name; a free one, a tool or an initiative, takes any. */
const VOCABULARY: Record<string, readonly string[]> = {
  ...FIXED, found: ['found', 'none'], outcome: ['delivered', 'accepted', 'abandoned'], weekday: WEEKDAYS,
  hour: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
};

/** What a measure may be grouped by: its dimensions, then the buckets where it takes period and has no dimension of the name. */
const groupings = (m: Measure): readonly string[] => {
  const dims: readonly string[] = MEASURES[m];
  return dims.includes('period') ? [...dims, ...BUCKETS.filter((b) => !dims.includes(b))] : dims;
};
/** The bucket a grouping names, or null for a dimension or period. */
const bucketFor = (m: Measure, by: string): Bucket | null =>
  (BUCKETS as readonly string[]).includes(by) && !(MEASURES[m] as readonly string[]).includes(by) ? by as Bucket : null;

/** One row a measure counts: when it happened, what it adds to the value (null for a run that measured no output), and
 *  its key along each dimension. */
type Fact = { at: string; value: number | null; keys: Record<string, string>; row: WorkQueryRow | null; id?: string; imported?: boolean };
type Counted = WorkQuery['total'];

/**
 * The words `team` added, each of Home's additions written in the team's documents and lessons by one rule, the same
 * every read: the k-th addition's half (rounded down) is written in the k-th of the team's flow documents in turn,
 * two fifths (rounded down) in the next, and the rest in the lessons, which are no document and have no initiative;
 * a team with no flow document writes all of it in its lessons. So each week's words add up to Home's and Record's.
 */
function wordsOf(team: string): Fact[] {
  const documents = rowsOf(team).flatMap((r) => (initiativeDetail(team, r.slug)?.documents ?? [])
    .filter((d) => !d.path.startsWith('sources/')).map((d) => ({ initiative: r.slug, path: d.path })));
  const fact = (atMs: number, added: number, d: { initiative: string; path: string } | null): Fact => ({
    at: iso(atMs), value: added,
    keys: d ? { document: `${d.initiative}/${d.path}`, initiative: d.initiative } : { document: 'lessons', initiative: 'lessons' },
    row: d ? { initiative: d.initiative, path: d.path, added } : { initiative: null, path: null, added },
  });
  return ADDITIONS.flatMap(({ atMs, words }, k) => {
    if (!documents.length) return [fact(atMs, words, null)];
    const half = Math.floor(words / 2), fifths = Math.floor((words * 2) / 5);
    return [fact(atMs, half, documents[k % documents.length]), fact(atMs, fifths, documents[(k + 1) % documents.length]), fact(atMs, words - half - fifths, null)];
  });
}

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
    case 'words': return team === null ? [] : wordsOf(team);
    case 'approvals': return callerApprovalRows(team, who.email).map((a) =>
      ({ at: a.approvedAt, value: 1, keys: { presentation: a.presentation, decision_basis: a.decisionBasis, initiative: a.initiative }, row: a }));
    // The lessons Home and Record count as made: an import's left out, a superseded one kept.
    case 'lessons': return team === null ? [] : lessonsMade(team).map((n) => ({ at: n.updated, value: 1, keys: { kind: n.type }, row: { kind: n.type, at: n.updated } }));
    case 'runs': return team === null ? [] : runsOf(team).map(({ skill, initiative, startedAt, lengthMs, id }) => {
      const [weekday, hour] = weekdayHour(Date.parse(startedAt));
      return { at: startedAt, value: 1, id, keys: { skill, initiative: initiative ?? 'none', weekday: WEEKDAYS[weekday], hour: String(hour).padStart(2, '0') },
        row: { skill, initiative, startedAt, lengthMs } };
    });
    // The question as Knowledge lists one that found nothing, normalised for case and spacing.
    case 'searches': return team === null ? [] : searchesOf(team).map(({ at, found, question }) =>
      ({ at, value: 1, keys: { found: found ? 'found' : 'none' }, row: { at, found, question: found ? null : question } }));
    case 'calls':
    case 'refusals': return callsOf(who).filter((r) => measure === 'calls' || r.ok === false).map((r) => ({
      at: r.ts, value: 1, row: r, id: r.id,
      keys: { tool: r.tool ?? 'none', initiative: r.initiative ?? 'none', refused: r.ok === false ? 'refused' : 'answered', owner: r.owner ?? '' },
    }));
    case 'output': return team === null ? [] : runsOf(team).map(({ team: _t, ...r }) => {
      void _t;
      return { at: r.startedAt, value: r.bytes, id: r.id, keys: { skill: r.skill, initiative: r.initiative ?? 'none' }, row: r };
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
    const e = grain === 'week' ? s + 7 * DAY : nextStart(startOf(s, 'month'), 'month', grain === 'month' ? 1 : 3);
    const end = Math.min(e, to);
    out.push({ from: iso(s), to: iso(end), observedFrom: iso(s), observedThrough: iso(Math.min(end, now())), complete: end <= now() });
    s = e;
  }
  return out;
}

const figure = (n: number): Figure => ({ value: n, why: null });
/** When a fact happened; one dated by its day alone, at that day's start. */
const msOf = (f: Fact) => (f.at.length === 10 ? midnight(f.at) : Date.parse(f.at));

const PARAMS = ['measure', 'by', 'from', 'to', 'compare', 'state', 'flow', 'q', 'group', 'rows', 'top', 'limit', 'offset'];
const MOST_TOP = 50, MOST_ROWS = 20, MOST_FILTERS = 4;
/** The groups a dimension or a bucket answers when top is not asked; the rest are folded. */
const LARGEST = 20;
/** The from ZZ Meridian's runner sends for all. */
const FIRST = '0001-01-01';
const BAD_WINDOW = 'from and to must be ISO 8601 instants or dates, YYYY-MM-DD, from before to';
const MIXED_WINDOW = 'from and to are both dates or both instants, not one of each';
const NOT_DRILLED = 'skill_calls is not drilled: its groups are its rows';
const NO_TEAM = "no team: Work is the active team's, and you act for none";

type Asked = {
  measure: Measure; by: string; compare: boolean; filters: { state: string | null; flow: string | null; q: string };
  where: [string, string][]; top: number; from: number | typeof FIRST | null; to: number | null;
  group: string | null; rows: number | null; limit: number; offset: number;
};

/** The where filters, each an equality on one of the measure's own dimensions, or the sentence a 400 says. */
function whereOf(measure: Measure, list: string[]): [string, string][] | string {
  if (list.length > MOST_FILTERS) return `where takes at most ${MOST_FILTERS} filters`;
  const dims = (MEASURES[measure] as readonly string[]).filter((d) => d !== 'period');
  const out: [string, string][] = [];
  for (const w of list) {
    const at = w.indexOf('=');
    if (at < 1) return 'each where is a dimension, an equals sign and a value';
    const [dim, value] = [w.slice(0, at), w.slice(at + 1)];
    if (!dims.includes(dim)) return `${measure} is filtered by one of ${dims.join(', ')}`;
    if (VOCABULARY[dim] && !VOCABULARY[dim].includes(value)) return `a filter on ${dim} takes one of ${VOCABULARY[dim].join(', ')}`;
    out.push([dim, value]);
  }
  return out;
}

/** The query's arguments, or the sentence a 400 says, in the gateway's order; nothing is read to decide either. */
function parse(q: URLSearchParams): Asked | string {
  if (PARAMS.some((k) => q.getAll(k).length > 1)) return 'each argument is given at most once';
  const measure = q.get('measure') ?? '';
  if (!(measure in MEASURES)) return `measure must be one of ${Object.keys(MEASURES).join(', ')}`;
  const allowed = groupings(measure as Measure);
  const by = q.get('by') ?? '';
  if (!allowed.includes(by)) return `${measure} is grouped by one of ${allowed.join(', ')}`;
  const compare = q.get('compare');
  if (compare !== null && compare !== 'previous') return 'compare must be previous, or left out';
  if (measure === 'skill_calls' && (q.get('group') !== null || q.get('rows') !== null)) return NOT_DRILLED;
  const where = whereOf(measure as Measure, q.getAll('where'));
  if (typeof where === 'string') return where;
  const whole = (k: string, most: number): number | null | undefined => {
    const n = q.get(k) === null ? null : Number(q.get(k));
    return n === null || (Number.isInteger(n) && n >= 1 && n <= most) ? n : undefined;
  };
  const top = whole('top', MOST_TOP), rows = whole('rows', MOST_ROWS);
  if (top === undefined) return `top must be a whole number from 1 to ${MOST_TOP}`;
  if (top !== null && by === 'period') return 'period answers every period of the window, so it takes no top';
  if (rows === undefined) return `rows must be a whole number from 1 to ${MOST_ROWS}`;
  if (rows !== null && ['group', 'limit', 'offset'].some((k) => q.get(k) !== null)) {
    return "rows is the newest of the window's rows, so it is given without group, limit or offset";
  }
  const list = listParams(q);
  if (typeof list === 'string') return list;
  // A date as its day's midnight, or for to the next day's; an instant in whole seconds. A text shaped as a date the
  // calendar has not is neither.
  const bound = (k: string): { ms: number; date: boolean } | null => {
    const t = q.get(k);
    if (t === null) return null;
    if (isDate(t)) return { ms: midnight(k === 'to' ? addDays(t, 1) : t), date: true };
    return { ms: /^\d{4}-\d{2}-\d{2}$/.test(t) ? NaN : Math.floor(Date.parse(t) / 1000) * 1000, date: false };
  };
  const to = bound('to');
  const from = q.get('from') === FIRST ? FIRST : bound('from');
  if ([from, to].some((b) => b !== null && typeof b !== 'string' && !Number.isFinite(b.ms))) return BAD_WINDOW;
  if (from !== null && to !== null && (from === FIRST || from.date) !== to.date) return MIXED_WINDOW;
  if (from !== null && from !== FIRST && to !== null && from.ms >= to.ms) return BAD_WINDOW;
  return {
    measure: measure as Measure, by, compare: compare !== null, filters: { state: list.state, flow: list.flow, q: list.q },
    where, top: top ?? LARGEST, from: from === null || from === FIRST ? from : from.ms, to: to?.ms ?? null,
    group: q.get('group'), rows, limit: list.limit, offset: list.offset,
  };
}

/** How a group is named where its key is not a sentence, as the gateway names it. */
function labelOf(by: string, key: string, grain: 'week' | 'month' | 'quarter' | null): string {
  if (grain) return `${grain === 'week' ? 'Week' : grain === 'month' ? 'Month' : 'Quarter'} from ${localDay(Date.parse(key))}`;
  if (by === 'found') return key === 'none' ? 'Found nothing' : 'Found something';
  if (by === 'refused' || by === 'standing') return key[0].toUpperCase() + key.slice(1);
  if (key === 'none' && (by === 'flow' || by === 'initiative')) return by === 'flow' ? 'No flow' : 'No initiative';
  if (key === 'lessons' && (by === 'document' || by === 'initiative')) return 'Lessons';
  return by === 'hour' ? `${key}:00` : key;
}

/** `GET /work/query`, as `who`. */
export function workQuery(who: Me, q: URLSearchParams): Answer {
  const a = parse(q);
  if (typeof a === 'string') return [400, { error: a }];
  if (who.activeTeam === null) return [400, { error: NO_TEAM }];
  const asOf = now();
  // A bound left out is the last whole week's, which a bound given may still pass.
  const toMs = a.to ?? Date.parse(WEEKS[LAST_WEEK].to);
  let from = a.from ?? Date.parse(WEEKS[LAST_WEEK].from);
  if (from !== FIRST && from >= toMs) return [400, { error: BAD_WINDOW }];

  let facts = factsOf(a.measure, who, a.filters, Math.min(toMs, asOf));
  // From the first day the measure's rows hold, before the where filters; none, the window's last day alone.
  if (from === FIRST) {
    const first = facts.reduce((m, f) => (msOf(f) < toMs ? Math.min(m, msOf(f)) : m), Infinity);
    from = midnight(localDay(Number.isFinite(first) ? first : toMs - 1));
  }
  const fromMs = from;
  facts = facts.filter((f) => a.where.every(([dim, value]) => f.keys[dim] === value));

  const stock = a.measure === 'shelf';
  const spanMs = toMs - fromMs;
  const startMs = a.compare ? fromMs - spanMs : fromMs;
  const inside = (f: Fact, lo: number, hi: number) => msOf(f) >= lo && msOf(f) < Math.min(hi, asOf);
  const grain = a.by === 'period' ? grainFor(spanMs) : null;
  const bucket = bucketFor(a.measure, a.by);
  const ps = grain ? periods(fromMs, toMs, grain) : [];
  const before = grain && a.compare ? periods(startMs, fromMs, grain) : [];
  const periodOf = (f: Fact, list: Window[]) => list.findIndex((w) => msOf(f) >= Date.parse(w.from) && msOf(f) < Date.parse(w.to));
  const keyOf = (f: Fact) => (grain ? ps[periodOf(f, ps)]?.from ?? '' : bucket ? bucketOf(bucket, msOf(f)) : f.keys[a.by]);
  const inWindow = stock ? facts : facts.filter((f) => inside(f, fromMs, toMs));
  const then = a.compare && !stock ? facts.filter((f) => inside(f, startMs, fromMs)) : [];
  const count = (fs: Fact[]) => countOf(a.measure, fs);
  const total = count(inWindow);
  const members = new Map<string, Fact[]>();
  for (const f of inWindow) {
    const key = keyOf(f);
    if (!members.has(key)) members.set(key, []);
    members.get(key)!.push(f);
  }
  // A day, week or month of the previous window is matched to this one's by position, as a period is.
  const series = bucket ? bucketsOf(bucket, fromMs, Math.min(toMs, asOf)) : [];
  const earlier = bucket && bucket !== 'weekday' && a.compare ? bucketsOf(bucket, startMs, Math.min(fromMs, asOf)) : [];

  const keys = grain ? ps.map((w) => w.from) : bucket ? series : [...new Set([...(FIXED[a.by] ?? []), ...members.keys()])];
  const groups = keys.map((key, i) => {
    const value = count(members.get(key) ?? []);
    let previous: Counted | null = null;
    if (a.compare && !stock) {
      const noData = (): Counted => ({ ...count([]), value: null, why: 'no_data' });
      previous = grain ? (i < before.length ? count(then.filter((f) => periodOf(f, before) === i)) : noData())
        : bucket && bucket !== 'weekday' ? (i < earlier.length ? count(then.filter((f) => bucketOf(bucket, msOf(f)) === earlier[i])) : noData())
        : count(then.filter((f) => (bucket ? bucketOf(bucket, msOf(f)) : f.keys[a.by]) === key));
    }
    const label = bucket ? bucketLabel(bucket, key) : labelOf(a.by, key, grain);
    return { key, label, value, share: total.value ? (value.value ?? 0) / total.value : null, previous };
  });
  if (!grain && !bucket) groups.sort((x, y) => (y.value.value ?? -1) - (x.value.value ?? -1) || x.key.localeCompare(y.key));
  // A bucket keeps the latest of the window, a dimension its largest; a period is never folded.
  const cut = grain ? 0 : bucket ? Math.max(0, groups.length - a.top) : Math.min(a.top, groups.length);
  const [kept, folded] = grain ? [groups, []] : bucket ? [groups.slice(cut), groups.slice(0, cut)] : [groups.slice(0, cut), groups.slice(cut)];

  let rows: WorkQuery['rows'] = null;
  if (a.group !== null || a.rows !== null) {
    const order = (f: Fact) => [...Object.values(f.keys), f.id ?? ''].join('\0');
    const drilled = [...(a.group !== null ? members.get(a.group) ?? [] : inWindow)].sort((x, y) => msOf(y) - msOf(x) || order(x).localeCompare(order(y)));
    const page = a.rows !== null ? drilled.slice(0, a.rows) : drilled.slice(a.offset, a.offset + a.limit);
    rows = { state: 'ok', data: { rows: page.map((f) => f.row!), total: drilled.length } };
  }

  const asked: WorkQuery = {
    meta: { ...workMeta(a.measure === 'approvals' ? 'caller-in-active-team' : 'active-team', `${who.activeTeam}'s ${a.measure.replace('_', ' ')}${a.measure === 'approvals' ? ' signed in the caller\'s name' : ''}`), period: { from: iso(fromMs), to: iso(toMs) } },
    measure: a.measure, by: a.by,
    window: { from: iso(fromMs), to: iso(toMs), observedFrom: iso(fromMs), observedThrough: iso(Math.max(fromMs, Math.min(toMs, asOf))), complete: toMs <= asOf },
    grain: grain ?? bucket,
    groups: kept,
    rest: folded.length ? { groups: folded.length, value: folded.reduce((n, g) => n + (g.value.value ?? 0), 0) } : null,
    total,
    rows,
  };
  return [200, asked];
}
