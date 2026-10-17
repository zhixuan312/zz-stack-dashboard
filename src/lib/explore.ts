/**
 * A prepared query: what a page's author lets an agent count, group and compare over the page's own collections, and
 * the one runner that answers it. The author declares, beside the view, the sources it reads and, for each, the fields
 * that narrow it, the facets that group it, the time buckets of its date, its measures and its drill. An agent asks it
 * as the read-only `explore_<view>` tool, whose input may name only what the declaration declares, and gets an answer
 * in text: the window, each measure with its unit, at most eight groups and twenty rows, each row with its address.
 *
 * Every figure is worked out by the collection itself, through one `aggregate` for each source and window a call reads,
 * never by reading the collection page by page, so a prepared query costs the same over a million rows as over ten.
 * The reads are the caller's (`ExploreIO`): the console's route hands the authorized `aggregate()` and `read()`, so the
 * person is checked again at the moment a call runs.
 */
import { z } from 'zod';
import { app } from '../app.config';
import type { AggregateQuery, AggregateResult, AggregateValues, Condition, Query } from './collection';
import { formatCost, plural } from './format';

export type ExploreOp = 'eq' | 'ne' | 'in' | 'lt' | 'gt';
type ExploreBucket = 'day' | 'week' | 'month' | 'weekday';

/**
 * A figure an answer states: a count (optionally of the rows that meet conditions the author declares), a field's sum,
 * average, minimum, maximum or p95 (`field` may be a path into an object field), or one derived from two measures: a
 * ratio `a / (b * scale)` or a margin `(1 - b / a) / scale`, `scale` 1 when not given, so `scale: 0.01` states either
 * in %. `of` names measures of this source, or `<source>.<measure>` of another, which is then read over the same window
 * on that source's own date field. A margin's change on the window before is in percentage points, as Home states its
 * gross margin; every other measure's is a percent of the window before. `unit` is the word a figure is written with
 * (requests, ms, %), or `money`: an amount in `app.currency`, written as the pages write money (`formatCost`), never a
 * currency code of its own, so a product made in pounds reads £ in its context and in its answers alike.
 */
export type Measure = { label: string; unit: string; definition: string } & (
  | { agg: 'count'; where?: Condition[] }
  | { agg: 'sum' | 'avg' | 'min' | 'max' | 'p95'; field: string }
  | { derive: 'ratio' | 'margin'; of: [string, string]; scale?: number }
);

export type Source = {
  collection: string;
  /** The field a window is cut on; a source without one has no window, and no `period` or `compare`. */
  date?: string;
  filters: Record<string, { ops: ExploreOp[]; values?: readonly (string | number | boolean)[] }>;
  facets: string[];
  buckets?: ExploreBucket[];
  measures: Record<string, Measure>;
  /** The columns of a drilled row, the collection's key always among them, and the console address that opens it. */
  drill: { columns: string[]; address: (row: Record<string, unknown>) => string };
  /** What its answers cannot say, in the words the page's context uses. */
  cannot: string;
  /** How a facet's value reads in an answer, by facet and value: the hours' weekday `6` reads Sunday. */
  labels?: Record<string, Record<string, string>>;
  /**
   * How a field's missing value reads, by field, in the page's words: a request that reached no model is `no model`. Its
   * group reads it, and a condition names it as null, which only a field given a word here admits.
   */
  none?: Record<string, string>;
  /**
   * A field that holds another collection's key, that collection's key field, and how its record reads: a run's
   * `releaseId` reads "v4.18.2, Edge gateway, production". A group and a drilled row name the record beside its key, read once per call under the
   * person's rights, so a model never pairs keys with names by guessing; one who may not read it sees the key alone.
   */
  refers?: Record<string, { collection: string; key: string; name: (record: Record<string, unknown>) => string }>;
};

export type PreparedQuery<I = unknown> = {
  /** At most five. */
  sources: Record<string, Source>;
  /** A detail page's record, as conditions per source, worked out from the view's own input; it may read the record under the person's rights. */
  fixed?: (input: I) => Promise<Record<string, Condition[]>>;
  /** The console address that shows what a call asked; the page's own address when not given. */
  address?: (call: { source: string; where: Condition[]; period?: string }) => string;
};

/** What a person may read: the collections, and each collection's fields only a page may see. */
export type ExploreRights = { readable: ReadonlySet<string>; hidden: (collection: string) => readonly string[] };

/** The authorized reads a call runs through, and the date of the day in progress as `YYYY-MM-DD`. */
export type ExploreIO = {
  aggregate: (name: string, q: AggregateQuery) => Promise<AggregateResult>;
  read: (name: string, q: Query) => Promise<{ rows: Record<string, unknown>[]; total: number }>;
  today: string;
};

type Scalar = string | number | boolean | null;
type Period = '7d' | '30d' | '90d' | 'all';
/** One call, as the schema parses it. A detail view's own input sits beside these. */
type ExploreCall = {
  source: string;
  measures: string[];
  where?: { field: string; op: ExploreOp; value: Scalar | Scalar[] }[];
  by?: string;
  bucket?: ExploreBucket;
  period?: Period;
  compare?: boolean;
  rows?: number;
};

const PERIODS: Period[] = ['7d', '30d', '90d', 'all'];
const DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };
const MAX_ANSWER = 3000;
const GROUPS = 8;

/**
 * The line an answer ends with when the cap holds some of it back: "3 lines are not shown", "1 row is not shown". The
 * count, its noun and its verb agree, because an assistant reads this line and "1 more line are not shown" is the kind
 * of sentence that makes a reader trust the figures less, not more.
 */
const notShown = (n: number, what: 'row' | 'line') => `${n} more ${plural(n, what)} ${plural(n, 'is', 'are')} not shown.`;
/** Asked for when every measure is derived: the collection ranks by its first measure, so the runner ranks these itself. */
const RANKED = 50;
const NO_ACCESS = 'You do not have access to that.';

/** What one source offers a person: the names they may use, worked out from the declaration and their rights. */
type Offer = { measures: string[]; filters: string[]; facets: string[]; buckets: ExploreBucket[]; dated: boolean };

/** A measure's reference split into its source and name: `costs.spent`, or a measure of `source` itself. */
function refOf(query: PreparedQuery<never>, source: string, ref: string): [string, string] {
  const dot = ref.indexOf('.');
  return dot > 0 && query.sources[ref.slice(0, dot)] ? [ref.slice(0, dot), ref.slice(dot + 1)] : [source, ref];
}

/**
 * Each source the person may read, with what of it they may name. A source over a collection they may not read is left
 * out; so is a filter, a facet, a bucket or a measure over a hidden field, and a measure derived from one left out.
 * `rights` null is the whole declaration.
 */
function offersOf(query: PreparedQuery<never>, rights: ExploreRights | null): Map<string, Offer> {
  const readable = (name: string) => !rights || rights.readable.has(query.sources[name].collection);
  const visible = (name: string, field: string) => !rights || !rights.hidden(query.sources[name].collection).includes(field.split('.')[0]);
  const usable = (name: string, measure: string, path: string[] = []): boolean => {
    const s = query.sources[name];
    const m = s?.measures[measure];
    const at = `${name}.${measure}`;
    if (!m || !readable(name) || path.includes(at)) return false;
    if ('derive' in m) return m.of.every((ref) => usable(...refOf(query, name, ref), [...path, at]));
    if ('field' in m) return visible(name, m.field);
    return (m.where ?? []).every((w) => visible(name, w.field));
  };
  const out = new Map<string, Offer>();
  for (const [name, s] of Object.entries(query.sources)) {
    if (!readable(name)) continue;
    const dated = s.date !== undefined && visible(name, s.date);
    out.set(name, {
      measures: Object.keys(s.measures).filter((m) => usable(name, m)),
      filters: Object.keys(s.filters).filter((f) => visible(name, f)),
      facets: s.facets.filter((f) => visible(name, f)),
      buckets: dated ? (s.buckets ?? []) : [],
      dated,
    });
  }
  return out;
}

const unique = <T,>(xs: T[]) => [...new Set(xs)];
const tuple = (xs: string[]) => xs as [string, ...string[]];
/** "orders: n, total; plain: n", the sources each name belongs to. */
const bySource = (offers: Map<string, Offer>, pick: (o: Offer, name: string) => string[]) =>
  [...offers].map(([name, o]) => [name, pick(o, name)] as const).filter(([, xs]) => xs.length).map(([name, xs]) => `${name}: ${xs.join(', ')}`).join('; ');

/**
 * The input a person is offered, as one strict object: `source` is the sources they may read, and each other property
 * offers the union of those sources' names, described with the source each belongs to. A refinement then holds the call
 * to the named source's own declaration, so a facet of another source, or `period` on a source with no date, is
 * refused. No property has a default: a defaulted property reads as required in JSON Schema, so the runner applies 30
 * days and no rows itself. `own` is a detail view's own input (One customer's `{ id }`), offered beside the query.
 */
export function exploreSchema<I>(query: PreparedQuery<I>, rights: ExploreRights | null, own?: z.ZodObject) {
  const q = query as PreparedQuery<never>;
  const offers = offersOf(q, rights);
  if (!offers.size) throw new Error('This prepared query offers no source to this person.');
  const all = <K extends keyof Offer>(k: K) => unique([...offers.values()].flatMap((o) => o[k] as string[]));
  const dated = [...offers].filter(([, o]) => o.dated).map(([name]) => name);
  // Null only where an offered field has a word for it: no other value of the input reads as null.
  const nullable = [...offers].some(([name, o]) => o.filters.some((f) => q.sources[name].none?.[f] !== undefined));
  const scalar = nullable ? z.union([z.string(), z.number(), z.boolean(), z.null()]) : z.union([z.string(), z.number(), z.boolean()]);
  const measure = (name: string, m: string) => {
    const d = q.sources[name].measures[m];
    return `${m} (${d.label}, ${unitOf(d)})`;
  };
  // A value the source reads through `labels` is named with its label, so a model asked about Sundays narrows to 6.
  const filter = (name: string, f: string) => {
    const d = q.sources[name].filters[f];
    const named = q.sources[name].labels?.[f];
    const value = (v: Scalar) => (named?.[String(v)] ? `${String(v)} (${named[String(v)]})` : String(v));
    const none = q.sources[name].none?.[f];
    return `${f} ${d.ops.join('|')}${d.values ? ` of ${d.values.map(value).join(', ')}` : ''}${none ? `, null for ${none}` : ''}`;
  };
  const ops = unique([...offers].flatMap(([name, o]) => o.filters.flatMap((f) => q.sources[name].filters[f].ops)));

  const shape: Record<string, z.ZodType> = {
    ...(own?.shape ?? {}),
    source: z.enum(tuple([...offers.keys()])).describe(`The source to ask: ${[...offers.keys()].map((n) => `${n}${offers.get(n)!.dated ? '' : ' (no date)'}`).join(', ')}.`),
    measures: z.array(z.enum(tuple(all('measures')))).min(1).max(3).describe(`One to three measures of that source. ${bySource(offers, (o, n) => o.measures.map((m) => measure(n, m)))}.`),
  };
  if (all('filters').length) {
    shape.where = z.array(z.object({ field: z.enum(tuple(all('filters'))), op: z.enum(tuple(ops)), value: z.union([scalar, z.array(scalar)]) }).strict()).max(4).optional()
      .describe(`Up to four conditions, all of which must hold; \`in\` takes a list. ${bySource(offers, (o, n) => o.filters.map((f) => filter(n, f)))}.`);
  }
  if (all('facets').length) shape.by = z.enum(tuple(all('facets'))).optional().describe(`Group by a field, largest first; never with bucket. ${bySource(offers, (o) => o.facets)}.`);
  if (all('buckets').length) shape.bucket = z.enum(tuple(all('buckets'))).optional().describe(`Group by a time bucket of the source's date, the latest in date order; never with by. ${bySource(offers, (o) => o.buckets)}.`);
  if (dated.length) {
    shape.period = z.enum(PERIODS).optional().describe(`Complete days counted back from yesterday, or all of them; 30d when not given. Only ${dated.join(', ')}.`);
    shape.compare = z.boolean().optional().describe(`Also the equal window before, with the change; not with all. Only ${dated.join(', ')}.`);
  }
  shape.rows = z.number().int().min(0).max(20).optional().describe('Up to 20 rows, each with its console address; none when not given.');

  return z.object(shape).strict().superRefine((value, ctx) => {
    const call = value as ExploreCall;
    const o = offers.get(call.source);
    const s = q.sources[call.source];
    if (!o || !s) return;
    const refuse = (message: string) => ctx.addIssue({ code: 'custom', message });
    for (const m of call.measures) if (!o.measures.includes(m)) refuse(`${call.source} has no measure ${m}.`);
    for (const w of call.where ?? []) {
      const f = o.filters.includes(w.field) ? s.filters[w.field] : undefined;
      if (!f) { refuse(`${call.source} cannot be narrowed by ${w.field}.`); continue; }
      if (!f.ops.includes(w.op)) refuse(`${w.field} takes ${f.ops.join(', ')}, not ${w.op}.`);
      if ((w.op === 'in') !== Array.isArray(w.value)) refuse(w.op === 'in' ? '`in` takes a list.' : `${w.op} takes one value.`);
      const values = Array.isArray(w.value) ? w.value : [w.value];
      if (values.includes(null) && s.none?.[w.field] === undefined) refuse(`${w.field} always has a value, so it is never null.`);
      if (f.values && values.some((v) => v !== null && !f.values!.includes(v))) refuse(`${w.field} is one of ${f.values.join(', ')}.`);
    }
    if (call.by !== undefined && call.bucket !== undefined) refuse('Ask by or bucket, not both.');
    if (call.by !== undefined && !o.facets.includes(call.by)) refuse(`${call.source} cannot be grouped by ${call.by}.`);
    if (call.bucket !== undefined && !o.buckets.includes(call.bucket)) refuse(`${call.source} has no ${call.bucket} bucket.`);
    if (!o.dated && (call.period !== undefined || call.compare !== undefined)) refuse(`${call.source} has no date, so no period and no window before.`);
  });
}

const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const MONEY = 'money';
/** The unit as the model is told it: money is in the product's currency. */
const unitOf = (m: Measure) => (m.unit === MONEY ? app.currency : m.unit);
const figure = (v: number | null, unit: string) => (v === null ? 'no value' : unit === MONEY ? formatCost(v) : `${number.format(v)} ${unit}`);
const text = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'number' ? number.format(v) : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** A condition in words, a missing value with the source's word for it: "model eq null (no model)". */
const said = (c: Condition, none: Source['none']) => {
  const one = (v: unknown) => (v === null ? `null (${none?.[c.field] ?? `no ${c.field}`})` : String(v));
  return `${c.field} ${c.op} ${Array.isArray(c.value) ? c.value.map(one).join(', ') : one(c.value)}`;
};

/** The change from `before` to `now`, in words; none when there is nothing to measure it against. */
function change(now: number | null, before: number | null): string {
  if (now === null || before === null || before === 0) return '';
  const d = (now - before) / Math.abs(before);
  return d === 0 ? ', unchanged' : `, ${d > 0 ? 'up' : 'down'} ${number.format(Math.abs(d) * 100)}%`;
}

/**
 * A margin's change from `before` to `now`, both fractions before their scale, in percentage points to one decimal, as
 * Home's context states its gross margin: a share of a share says little. A change from 0 has its points too.
 */
function pointsChange(now: number | null, before: number | null): string {
  if (now === null || before === null) return '';
  const by = Math.abs(now - before) * 100;
  return by < 0.05 ? ', unchanged' : `, ${now > before ? 'up' : 'down'} ${by.toFixed(1)} points`;
}

type Merge = 'add' | 'min' | 'max' | null;

/**
 * Answers one call: the input checked against the whole declaration (a name it lacks throws, as a strict schema
 * refuses it), then against the person's rights (a declared name withheld from them is answered, and nothing is read),
 * then read through one `aggregate` for each source and window and, for a drill, one `read`.
 */
export async function runExplore<I>(query: PreparedQuery<I>, input: unknown, rights: ExploreRights, io: ExploreIO, page: string, own?: z.ZodObject): Promise<{ address: string; answer: string }> {
  const q = query as PreparedQuery<never>;
  const parsed = exploreSchema(query, null, own).parse(input) as ExploreCall & Record<string, unknown>;
  const { source: name, measures: asked, by, bucket, compare = false, rows = 0 } = parsed;
  const where: Condition[] = (parsed.where ?? []).map((w) => ({ field: w.field, op: w.op, value: w.value }));
  const s = q.sources[name];
  const address = q.address ? q.address({ source: name, where, period: parsed.period }) : page;
  const reply = (answer: string) => ({ address, answer });

  const o = offersOf(q, rights).get(name);
  const hidden = new Set(rights.hidden(s.collection));
  if (!o || asked.some((m) => !o.measures.includes(m)) || where.some((w) => !o.filters.includes(w.field))
    || (by !== undefined && !o.facets.includes(by)) || (bucket !== undefined && !o.buckets.includes(bucket))
    || (s.date !== undefined && !o.dated && (parsed.period !== undefined || compare))) return { address: page, answer: NO_ACCESS };

  const period: Period | undefined = s.date === undefined ? undefined : parsed.period ?? '30d';
  if (period === 'all' && compare) return reply('`all` has no window before: ask without compare, or over 7d, 30d or 90d.');

  /** The base measures the asked ones read, by source: a derived measure reads its two, here or on another source. */
  const bases = new Map<string, string[]>();
  const need = (src: string, m: string) => {
    const d = q.sources[src].measures[m];
    if ('derive' in d) for (const ref of d.of) need(...refOf(q, src, ref));
    else if (!bases.get(src)?.includes(m)) bases.set(src, [...(bases.get(src) ?? []), m]);
  };
  // The collection ranks groups by its first measure, so the first asked measure that is not derived goes first.
  for (const m of asked) if (!('derive' in s.measures[m])) need(name, m);
  for (const m of asked) need(name, m);
  if (!bases.has(name)) bases.set(name, []);
  const others = [...bases.keys()].filter((src) => src !== name);
  const derivedOnly = asked.every((m) => 'derive' in s.measures[m]);
  if (others.length && (by !== undefined || where.length)) {
    const reach = (src: string, m: string): string[] => {
      const d = q.sources[src].measures[m];
      return 'derive' in d ? d.of.flatMap((ref) => reach(...refOf(q, src, ref))) : [src];
    };
    const across = asked.filter((m) => reach(name, m).some((src) => src !== name)).map((m) => s.measures[m].label);
    return reply(`${across.join(' and ')} cannot be filtered or grouped: ${across.length > 1 ? 'they read' : 'it reads'} ${others.join(' and ')} over the same window, so ask without by and where.`);
  }

  const fixed = q.fixed ? await q.fixed(Object.fromEntries(Object.keys(own?.shape ?? {}).map((k) => [k, parsed[k]])) as never) : {};
  const today = io.today;
  const windowOf = (src: string, before: boolean): AggregateQuery['window'] => {
    const field = q.sources[src].date;
    if (field === undefined || period === undefined) return undefined;
    if (period === 'all') return { field, from: '0001-01-01', to: shift(today, -1) };
    const n = DAYS[period];
    return before ? { field, from: shift(today, -2 * n), to: shift(today, -n - 1) } : { field, from: shift(today, -n), to: shift(today, -1) };
  };
  const ask = (src: string, before: boolean): AggregateQuery => {
    const t = q.sources[src];
    const self = src === name;
    const group = self && by !== undefined ? { field: by } : bucket !== undefined && t.date ? { field: t.date, bucket } : undefined;
    const out: AggregateQuery = {
      measures: (bases.get(src) ?? []).map((m) => {
        const d = t.measures[m] as Extract<Measure, { agg: string }>;
        return 'field' in d ? { name: m, agg: d.agg, field: d.field } : { name: m, agg: 'count', ...(d.where ? { where: d.where } : {}) };
      }),
    };
    const conds = [...(fixed[src] ?? []), ...(self ? where : [])];
    if (conds.length) out.where = conds;
    const w = windowOf(src, before);
    if (w) out.window = w;
    if (group) {
      out.group = group;
      out.top = self && by !== undefined && derivedOnly ? RANKED : GROUPS;
    }
    return out;
  };
  // This window's reads are asked first, then the window before's.
  const sources = [name, ...others];
  const reading = Promise.all(sources.map((src) => io.aggregate(q.sources[src].collection, ask(src, false))));
  const previous = compare ? Promise.all(sources.map((src) => io.aggregate(q.sources[src].collection, ask(src, true)))) : null;
  const [now, then] = [await reading, previous && (await previous)];

  type Values = Map<string, Record<string, number | null>>;
  /** A margin as a fraction, before its scale: none over no revenue, or when either of its measures has no value. */
  const fraction = (src: string, d: Extract<Measure, { derive: string }>, vs: Values): number | null => {
    const [a, b] = d.of.map((ref) => value(...refOf(q, src, ref), vs));
    return a === null || b === null || a === 0 ? null : 1 - b / a;
  };
  const value = (src: string, m: string, vs: Values): number | null => {
    const d = q.sources[src].measures[m];
    if (!('derive' in d)) return vs.get(src)?.[m] ?? null;
    if (d.derive === 'margin') { const f = fraction(src, d, vs); return f === null ? null : f / (d.scale ?? 1); }
    const [a, b] = d.of.map((ref) => value(...refOf(q, src, ref), vs));
    if (a === null || b === null) return null;
    const den = b * (d.scale ?? 1);
    return den === 0 ? null : a / den;
  };
  /** A measure's change on the window before: a margin's in points of its fraction, any other's as a percent. */
  const moved = (m: string, at: Values, was: Values) => {
    const d = s.measures[m];
    return 'derive' in d && d.derive === 'margin' ? pointsChange(fraction(name, d, at), fraction(name, d, was)) : change(value(name, m, at), value(name, m, was));
  };
  const totals = (rs: AggregateResult[]): Values => new Map(sources.map((src, i) => [src, rs[i].total.values]));
  /** A group's values: this source's own, and, for a derived measure over another source, that source's group of the same key. */
  const groupValues = (rs: AggregateResult[], g: AggregateValues & { key?: string | null }, other: (r: AggregateResult) => AggregateValues | undefined): Values =>
    new Map(sources.map((src, i) => [src, i === 0 ? g.values : other(rs[i])?.values ?? {}]));
  const values = (vs: Values) => asked.map((m) => figure(value(name, m, vs), s.measures[m].unit)).join(', ');

  // The head: the window and the conditions, then each measure, then the window before.
  const w = windowOf(name, false);
  const conds = [...(fixed[name] ?? []), ...where];
  const narrowed = conds.map((c) => said(c, s.none)).join(' and ');
  const head = [[
    `Source ${name}`,
    w ? (period === 'all' ? `every complete day kept, up to ${w.to}` : `${w.from} to ${w.to}, complete days`) : 'no window, as it has no date',
    ...(conds.length ? [`where ${narrowed}`] : []),
    ...(by !== undefined ? [`by ${by}`] : bucket !== undefined ? [`a ${bucket} at a time`] : []),
  ].join(', ') + '.'];
  const current = totals(now);
  // Money names its currency once, on its own line; a definition says what the whole measure counts, so a narrowed call
  // says it holds only some of it, or "Runs: 1 runs" under `state eq failed` reads as every run of the window.
  for (const m of asked) {
    const d = s.measures[m];
    head.push(`${d.label}${d.unit === MONEY ? `, in ${app.currency}` : ''}: ${figure(value(name, m, current), d.unit)}. ${d.definition}${conds.length ? ` This figure is only of those where ${narrowed}.` : ''}`);
  }
  if (then) {
    const b = windowOf(name, true)!;
    const before = totals(then);
    head.push(`The window before, ${b.from} to ${b.to}: ${asked.map((m) => `${s.measures[m].label} ${figure(value(name, m, before), s.measures[m].unit)}${moved(m, current, before)}`).join('; ')}.`);
  }

  // The groups, at most eight, and the rest on one line.
  const main = now[0];
  const label = (key: string | null) => (by === undefined ? String(key) : key === null ? s.none?.[by] ?? `no ${by}` : s.labels?.[by]?.[key] ?? named(by, key));
  let groups = main.groups.map((g) => ({ key: g.key, vs: groupValues(now, g, (r) => r.groups.find((x) => x.key === g.key)) }));
  let rest: { groups: number; vs: Values } | null = main.others && { groups: main.others.groups, vs: groupValues(now, main.others, (r) => r.others ?? undefined) };
  if (main.groups.length && by !== undefined && derivedOnly) {
    // Every measure is derived: rank by the first of them here, and fold what is past the eighth into the rest.
    const rank = (vs: Values) => value(name, asked[0], vs) ?? -Infinity;
    const ranked = [...main.groups].sort((a, b) => rank(new Map([[name, b.values]])) - rank(new Map([[name, a.values]])));
    const past = ranked.slice(GROUPS);
    groups = ranked.slice(0, GROUPS).map((g) => ({ key: g.key, vs: new Map([[name, g.values]]) }));
    if (past.length || main.others) {
      const kinds = new Map<string, Merge>((bases.get(name) ?? []).map((m) => {
        const d = s.measures[m] as Extract<Measure, { agg: string }>;
        return [m, d.agg === 'count' || d.agg === 'sum' ? 'add' : d.agg === 'min' ? 'min' : d.agg === 'max' ? 'max' : null];
      }));
      const parts: AggregateValues[] = [...past, ...(main.others ? [main.others] : [])];
      const merged = Object.fromEntries([...kinds].map(([m, k]) => {
        const xs = parts.map((p) => p.values[m]).filter((x): x is number => x !== null);
        return [m, k === null || !xs.length ? null : k === 'add' ? xs.reduce((a, b) => a + b, 0) : k === 'min' ? Math.min(...xs) : Math.max(...xs)];
      }));
      rest = { groups: past.length + (main.others?.groups ?? 0), vs: new Map([[name, merged]]) };
    } else rest = null;
  }
  /** A compared group's figures in the window before, with its change; a bucket's keys are dates the window before does not share. */
  const against = (key: string | null, at: Values): string => {
    if (!then || by === undefined) return '';
    const g = then[0].groups.find((x) => x.key === key);
    // A group the window before folded into its others may have had rows there: say nothing rather than none.
    if (!g) return then[0].others ? '' : ' (none in the window before)';
    const vs = groupValues(then, g, (r) => r.groups.find((x) => x.key === key));
    return ` (the window before ${asked.map((m) => `${figure(value(name, m, vs), s.measures[m].unit)}${moved(m, at, vs)}`).join('; ')})`;
  };
  // The drill: one read of at most twenty rows, the latest first, each with its address. Rows that do not fit 3,000
  // characters are dropped from the end, and a line says how many.
  const window: Condition[] = w && period !== 'all'
    ? [{ field: w.field, op: 'gt', value: `${shift(w.from, -1)}T23:59:59.999Z` }, { field: w.field, op: 'lt', value: shift(w.to, 1) }]
    : w ? [{ field: w.field, op: 'lt', value: shift(w.to, 1) }] : [];
  const read = rows === 0 ? { rows: [], total: 0 } : await io.read(s.collection, { where: [...conds, ...window], limit: rows, ...(s.date ? { sort: { field: s.date, dir: 'desc' as const } } : {}) });
  const columns = s.drill.columns.filter((c) => !hidden.has(c));

  // The records the groups and the drilled rows refer to, one read per collection the person may read.
  const names = new Map<string, Map<string, string>>();
  for (const [field, ref] of Object.entries(s.refers ?? {})) {
    if (hidden.has(field) || !rights.readable.has(ref.collection)) continue;
    const keys = unique([
      ...(by === field ? groups.flatMap((g) => (g.key === null ? [] : [g.key])) : []),
      ...(columns.includes(field) ? read.rows.flatMap((r) => (typeof r[field] === 'string' ? [r[field] as string] : [])) : []),
    ]);
    if (!keys.length) continue;
    const omit = new Set(rights.hidden(ref.collection));
    const found = await io.read(ref.collection, { where: [{ field: ref.key, op: 'in', value: keys }], limit: keys.length });
    names.set(field, new Map(found.rows.map((r) => [String(r[ref.key]), ref.name(Object.fromEntries(Object.entries(r).filter(([k]) => !omit.has(k))))])));
  }
  function named(field: string, key: string): string {
    const name = names.get(field)?.get(key);
    return name ? `${key} (${name})` : key;
  }

  const body = [
    ...groups.map((g) => `- ${label(g.key)}: ${values(g.vs)}${against(g.key, g.vs)}`),
    ...(rest ? [`- ${rest.groups} others: ${values(rest.vs)}`] : []),
    ...(s.cannot ? [s.cannot] : []),
  ];
  /** The answer held to the length a prepared query promises, `docs/assistant.md`. Whole lines go from the end, so nothing is cut mid-sentence, and the last line says how many. */
  const held = (lines: string[]): string => {
    for (let n = lines.length; n > 0; n--) {
      const said = lines.length - n;
      const text = [...lines.slice(0, n), ...(said ? [notShown(said, 'line')] : [])].join('\n');
      if (text.length <= MAX_ANSWER) return text;
    }
    return notShown(lines.length, 'line');
  };
  const fixedLines = [...head, ...body];
  if (rows === 0) return reply(held(fixedLines));
  const drilled = read.rows.map((r) => `- ${s.drill.address(r)}: ${columns.map((c) => `${c} ${names.has(c) && typeof r[c] === 'string' ? named(c, r[c]) : text(r[c])}`).join(', ')}`);
  const lead = read.rows.length ? `Rows, ${s.date ? 'the latest first' : 'in order'}, ${read.rows.length} of ${read.total}:` : 'No row matches.';
  const answer = (k: number) => [...fixedLines, lead, ...drilled.slice(0, k), ...(k < drilled.length ? [notShown(drilled.length - k, 'row')] : [])].join('\n');
  let k = drilled.length;
  while (k > 0 && answer(k).length > MAX_ANSWER) k--;
  // The rows go first, because they are what the summary leaves out; `held` is what catches a summary over budget by
  // itself, which the row loop cannot shorten at all.
  return reply(held([...fixedLines, lead, ...drilled.slice(0, k), ...(k < drilled.length ? [notShown(drilled.length - k, 'row')] : [])]));
}
