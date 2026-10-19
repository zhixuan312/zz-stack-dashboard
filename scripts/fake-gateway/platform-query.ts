/**
 * The fake gateway's Platform prepared query: what `GET /api/console/platform/query?measure&by&from&to&compare&where
 * &group&rows&top&limit&offset` answers, to everyone signed in, as the gateway's platform-query.ts answers it.
 *
 * One measure (platform-query-measures.ts), over a window of whole days, grouped by one of its dimensions or by a bucket
 * of its days, against the window before it of the same length when asked, and down to the rows its page draws. Its
 * facts are read off the page answers this fake already gives (platform-query-facts.ts), so each figure the query
 * answers for a window a page draws is that page's figure; its calendar is Work's, work-query-buckets.ts's.
 *
 *   measure     one of the measures
 *   by          one of the measure's dimensions, or a bucket: day, week, month, weekday; left out, the total alone
 *   from, to    inclusive dates, YYYY-MM-DD, both or neither; neither is the last whole week; from=0001-01-01 reads
 *               from the measure's first recorded day
 *   compare     previous: each group's value in the window before, of the same length; not for a stock
 *   where       dimension=value, an equality filter on one of the measure's dimensions, repeated, at most four; an
 *               empty value keeps the rows with no value along it
 *   group       a group's key, empty for the group with none, to drill to its rows, limit of them from offset
 *   rows        1 to 20: the rows the filters and the window keep, newest first, with no group
 *   top         1 to 50, default 20: the largest groups of a dimension, the key breaking a tie, or the latest buckets,
 *               in date order and the weekdays Monday to Sunday; the rest are folded into one count
 *   limit       1 to 20, default 10, and offset: the page of a group's rows
 *
 * Any other argument changes nothing, `scope` and a bare `team` among them. What a member reads is what the measure's
 * page shows a member, and the superadmin's measures (teams, people, sign_ins, audit), a team as a dimension or a
 * filter, and the questions searches asked are the superadmin's alone: a member asking any of them is refused 403 with
 * the sentence every console route refuses with, before anything is read. A drilled row carries its `address` and the
 * instant `at` it is ordered by, never an `href`.
 *
 * What the route does not take is refused 400 with the gateway's own sentence, naming what it takes, a filter's value
 * with the vocabulary it is held to and never the value sent.
 *
 * COUPLED: the gateway's services/gateway/src/console/platform-query.ts, whose order of refusals and sentences these
 * are; `PlatformQuery` in src/lib/platform-shapes.ts; and zz-stack's checks/console-platform-query-shape.ts, which
 * imports this file with plain `node` and compares its key sets with the real route's answer. So nothing here is
 * imported through the console's path alias.
 */
import type { PlatformQuery, PlatformQueryGroup } from '../../src/lib/platform-shapes.ts';
import { midnight, now } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { MEASURES, type Fact, type Measure, type Who } from './platform-query-measures.ts';
import { BUCKETS, WEEKDAYS, addDays, bucketLabel, bucketOf, bucketsOf, isDate, type Bucket } from './work-query-buckets.ts';

type Answer = [status: number, body: unknown];

const PARAMS = ['measure', 'by', 'from', 'to', 'compare', 'group', 'rows', 'top', 'limit', 'offset'];
/** The first date there is: the runner's all, read as from the measure's first recorded day. */
const ALL = '0001-01-01';
const FILTERS = 4;
const WINDOW = 'from and to are inclusive dates, YYYY-MM-DD, given both or neither, from no later than to; from=0001-01-01 ' +
  'reads from the first recorded day';
const MIXED = 'from and to are both dates or both instants, not one of each';
/** The sentence every console route refuses a member with. */
const REFUSED: Refusal = { status: 403, error: 'not permitted' };

type Refusal = { status: 400 | 403; error: string };
type Asked = {
  measure: string; m: Measure; by: string | null; bucket: Bucket | null;
  from: string | null; to: string | null; compare: boolean;
  where: [string, string | null][];
  /** The group drilled, its key null for the rows with none; undefined when no group is drilled. */
  group: string | null | undefined;
  rows: number | null; top: number; limit: number; offset: number;
};

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const bad = (error: string): Refusal => ({ status: 400, error });
const counted = (n: number) => ({ value: n, why: null });
const sum = (fs: Fact[]) => fs.reduce((n, f) => n + f.n, 0);
const DAY = 86_400_000;
/** The days from one date through another, both counted. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

/** Whether a key names a bucket of its kind, as bucketOf keys it: a date, a Monday, a month or a weekday. */
function isBucketKey(key: string, bucket: Bucket): boolean {
  if (bucket === 'weekday') return WEEKDAYS.includes(key);
  if (bucket === 'month') return /^\d{4}-\d{2}$/.test(key) && isDate(`${key}-01`);
  return isDate(key) && (bucket === 'day' || bucketOf('week', midnight(key)) === key);
}

/** A whole number from `lo` to `hi`, its default when absent, NaN when it is anything else. */
function whole(v: string | null, lo: number, hi: number, otherwise: number): number {
  if (v === null) return otherwise;
  return /^\d+$/.test(v) && Number(v) >= lo && Number(v) <= hi ? Number(v) : Number.NaN;
}

/** What a measure is grouped by, as its refusal names it. */
function groupedBy(measure: string, m: Measure): string {
  const dims = Object.keys(m.dims);
  const buckets = `a bucket: ${BUCKETS.join(', ')}`;
  if (!m.buckets) return `${measure} is grouped by ${dims.join(', ')}`;
  return dims.length ? `${measure} is grouped by one of ${dims.join(', ')}, or ${buckets}` : `${measure} is grouped by ${buckets}`;
}

/** The question's arguments, or the refusal, in the gateway's order; nothing is read to decide either. */
function parse(q: URLSearchParams, who: Who): Asked | Refusal {
  if (PARAMS.some((k) => q.getAll(k).length > 1)) return bad('each argument is given at most once');
  const measure = q.get('measure') ?? '';
  if (!Object.hasOwn(MEASURES, measure)) return bad(`measure must be one of ${Object.keys(MEASURES).join(', ')}`);
  const m = MEASURES[measure];
  // What only the superadmin is shown is refused a member before anything else is said of the question.
  if (!who.superadmin && m.superadmin) return REFUSED;
  const dims = Object.keys(m.dims);

  const by = q.get('by');
  const bucket = by !== null && m.buckets && (BUCKETS as readonly string[]).includes(by) ? by as Bucket : null;
  if (by !== null && bucket === null && !dims.includes(by)) return bad(groupedBy(measure, m));
  if (by !== null && m.dims[by]?.superadmin && !who.superadmin) return REFUSED;

  const [from, to] = [q.get('from'), q.get('to')];
  if (from !== null || to !== null) {
    const instant = (v: string | null) => v !== null && !isDate(v) && v.includes('T') && Number.isFinite(Date.parse(v));
    if ((isDate(from ?? '') || isDate(to ?? '')) && (instant(from) || instant(to))) return bad(MIXED);
    if (from === null || to === null || !isDate(from) || !isDate(to) || from > to) return bad(WINDOW);
  }

  const compare = q.get('compare');
  if (compare !== null && compare !== 'previous') return bad('compare must be previous, or left out');
  if (compare !== null && m.stock) return bad(`${measure} is a stock, counted as of the window's end: a stock has no window before`);

  const where: [string, string | null][] = [];
  for (const w of q.getAll('where')) {
    const filter = /^([a-z_]+)=(.*)$/.exec(w);
    if (!filter) return bad('each where is a dimension, an equals sign and a value');
    const [, k, v] = filter;
    // A team is the superadmin's dimension wherever it is named, a measure that has none included.
    if (k === 'team' && !who.superadmin) return REFUSED;
    if (!dims.includes(k)) return bad(dims.length ? `${measure} is filtered by one of ${dims.join(', ')}` : `${measure} takes no filter`);
    if (m.dims[k].superadmin && !who.superadmin) return REFUSED;
    where.push([k, v === '' ? null : v]);
  }
  if (where.length > FILTERS) return bad(`where takes at most ${FILTERS} filters`);

  const group = q.get('group');
  if (group !== null && by === null) return bad('group names a group of by: give by with it');
  if (q.get('rows') !== null && (group !== null || q.get('limit') !== null || q.get('offset') !== null)) {
    return bad("rows is the newest of the window's rows, so it is given without group, limit or offset");
  }
  if ((group !== null || q.get('rows') !== null) && m.notDrilled) return bad(m.notDrilled);
  if ((group !== null || q.get('rows') !== null) && m.drillSuperadmin && !who.superadmin) return REFUSED;
  if (group !== null && bucket !== null && !isBucketKey(group, bucket)) return bad(`group must be a ${bucket} of the window, as by=${bucket} keys it`);

  const rows = whole(q.get('rows'), 1, 20, 0), top = whole(q.get('top'), 1, 50, 20), limit = whole(q.get('limit'), 1, 20, 10);
  const offset = whole(q.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0);
  if (Number.isNaN(rows)) return bad('rows must be a whole number from 1 to 20');
  if (Number.isNaN(top)) return bad('top must be a whole number from 1 to 50');
  if (Number.isNaN(limit) || Number.isNaN(offset)) return bad('limit must be a whole number from 1 to 20, and offset one from 0');

  return {
    measure, m, by, bucket, from, to, compare: compare !== null, where,
    group: group === null ? undefined : group === '' && bucket === null ? null : group,
    rows: q.get('rows') === null ? null : rows, top, limit, offset,
  };
}

/** The question answered over the window `[from, to]` of dates, at the fake's cutoff. */
function answer(a: Asked, who: Who, asked: { from: string | null; to: string }): PlatformQuery {
  const { m, by, bucket } = a;
  const asOfMs = now();
  let from = asked.from ?? asked.to;
  const to = asked.to;
  const keep = (f: Fact) => a.where.every(([k, v]) => f.keys[k] === v);
  const keyOf = (f: Fact): string | null => (bucket ? bucketOf(bucket, midnight(f.day)) : by === null ? null : f.keys[by]);
  const read = m.facts(who, { from: asked.from, to });
  // From the first recorded day: the earliest day the measure counts, whatever the filters keep.
  if (asked.from === null) from = read.reduce((d, f) => (f.day < d ? f.day : d), to);
  const facts = read.filter(keep);
  const length = daysBetween(from, to);
  const then = a.compare ? m.facts(who, { from: addDays(from, -length), to: addDays(from, -1) }).filter(keep) : [];

  const fromMs = midnight(from), toMs = midnight(addDays(to, 1));
  const window = {
    from: iso(fromMs), to: iso(toMs), observedFrom: iso(fromMs),
    observedThrough: iso(Math.max(fromMs, Math.min(toMs, asOfMs))), complete: toMs <= asOfMs,
  };
  const meta: PlatformQuery['meta'] = {
    asOf: iso(asOfMs), timezone: PLATFORM_STATUS.meta.timezone, period: { from: window.from, to: window.to },
    scope: who.superadmin ? 'platform-admin' : 'platform-public', population: m.population,
    coverageFrom: asked.from === null && facts.length ? window.from : null,
  };

  const total = sum(facts);
  const group = (key: string | null, label: string, value: number, previous: PlatformQueryGroup['previous']): PlatformQueryGroup =>
    ({ key, label, value: counted(value), share: total ? value / total : null, previous });
  let groups: PlatformQueryGroup[] = [], folded: PlatformQueryGroup[] = [];
  if (bucket) {
    // The buckets the window holds before its end or the cutoff, an empty one answered as zero.
    const keys = bucketsOf(bucket, fromMs, Math.min(toMs, asOfMs));
    const before = a.compare ? bucketsOf(bucket, midnight(addDays(from, -length)), fromMs) : [];
    const all = keys.map((key, i) => {
      // A bucket's previous is the same bucket of the window before by its place in it, a weekday by its name.
      const was = bucket === 'weekday' ? key : before[i];
      const previous = !a.compare ? null : was === undefined ? { value: null, why: 'no_data' as const }
        : counted(sum(then.filter((f) => bucketOf(bucket, midnight(f.day)) === was)));
      return group(key, bucketLabel(bucket, key), sum(facts.filter((f) => keyOf(f) === key)), previous);
    });
    [groups, folded] = [all.slice(-a.top), all.slice(0, -a.top)];
  } else if (by !== null) {
    const d = m.dims[by];
    const keys = [...new Set<string | null>([...(d.fixed?.(who) ?? []), ...facts.map(keyOf)])];
    const all = keys.map((key) => group(key, key === null ? d.none : d.label?.(key, who) ?? key,
      sum(facts.filter((f) => keyOf(f) === key)), a.compare ? counted(sum(then.filter((f) => f.keys[by] === key))) : null))
      .sort((x, y) => y.value.value! - x.value.value! || (x.key === y.key ? 0 : x.key === null ? 1 : y.key === null ? -1 : x.key < y.key ? -1 : 1));
    [groups, folded] = [all.slice(0, a.top), all.slice(a.top)];
  }

  let rows: PlatformQuery['rows'] = null;
  if (a.group !== undefined || a.rows !== null) {
    const kept = a.group === undefined ? facts : facts.filter((f) => keyOf(f) === a.group);
    const r = m.rows!(who, kept, a.rows ?? a.offset + a.limit, { from, to });
    rows = { state: 'ok', data: { rows: a.rows === null ? r.rows.slice(a.offset, a.offset + a.limit) : r.rows.slice(0, a.rows), total: r.total } };
  }

  return {
    meta, measure: a.measure, by, window, groups,
    rest: folded.length ? {
      groups: folded.length, value: folded.reduce((n, g) => n + g.value.value!, 0),
      previous: a.compare ? folded.reduce((n, g) => n + (g.previous?.value ?? 0), 0) : null,
    } : null,
    total: counted(total),
    rows,
  };
}

/** `GET /platform/query`, as `who`: one prepared question about the platform, answered as the measure's page answers them. */
export function platformQuery(who: Who, q: URLSearchParams): Answer {
  const asked = parse(q, who);
  if ('status' in asked) return [asked.status, { error: asked.error }];
  // Each value a filter or a drilled group names, held to its dimension's vocabulary before anything is compared.
  const named: [string, string | null][] = [...asked.where, ...(asked.group !== undefined && asked.bucket === null ? [[asked.by!, asked.group] as [string, string | null]] : [])];
  for (const [k, v] of named) if (v !== null && !asked.m.dims[k].has(who, v)) return [400, { error: asked.m.dims[k].refuse(who) }];
  // Neither bound is the last whole week: Monday to Sunday before the running one.
  const monday = bucketOf('week', now());
  const window = asked.from === null ? { from: addDays(monday, -7), to: addDays(monday, -1) }
    : { from: asked.from === ALL ? null : asked.from, to: asked.to! };
  return [200, answer(asked, who, window)];
}
