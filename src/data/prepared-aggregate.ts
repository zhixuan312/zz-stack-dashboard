/**
 * The one factory that makes a row of `src/data/prepared.ts` a `Collection`: its `aggregate` and its `query` are the
 * gateway's prepared query, asked in ZZ Meridian's vocabulary (`AggregateQuery` and `Query` in `src/lib/collection.ts`)
 * and answered as the release's runner reads them (`runExplore` in `src/lib/explore.ts`).
 *
 * - `aggregate` asks the route once for each base measure it is asked: the query's `where` as the route's equality
 *   filters on the measure's dimensions, a count's own `where` added to that measure's call, the window as inclusive
 *   dates, the group as `by` (a dimension, or a bucket of the date) and `top` as the route's `top`. The route's groups,
 *   its folded rest and its total come back as `AggregateResult`; a bucket is the route's own grain, never folded here.
 * - `query` is the runner's drill: the route's `rows`, newest first and at most 20, under the same filters, and the
 *   runner's window translated to the route's dates, so a drill reads the days the aggregate beside it read. Its `gt`
 *   on `<D>T23:59:59.999Z` is `from` the day after `<D>`, its `lt` on `<D>` is `to` the day before, and a window with
 *   the `lt` alone, which `all` sends, reads from the first recorded day (`from=0001-01-01`).
 *
 * Anything the route cannot answer (a measure but a count, or a sum of the field the route sums; a field that is no
 * dimension; an operator but equality and the window's; an order but the route's own) is refused with a sentence before
 * anything is read, and so is a drill of a measure the route answers no rows for, with the sentence naming the page that
 * lists them. A figure the route could not read is thrown, never answered as a zero.
 *
 * Nothing is kept: every call is one gateway read made with the caller's own credential (`src/data/gateway.ts`), so two
 * people asking the same question make two reads. The caller's tokens are their own Access answer, counted here with
 * the release's `aggregateRows` and `queryRows`, and no field of them holds a value.
 */
import { AccessDenied, may } from '@/data/access';
import { gatewayGet } from '@/data/gateway';
import type { PreparedRow } from '@/data/prepared';
import {
  aggregateRows, normalizeAggregate, queryRows, type AggregateQuery, type AggregateResult, type AnyCollection,
  type Condition, type Query,
} from '@/lib/collection';
import type { Access } from '@/lib/destination-shapes';
import type { Figure, Part } from '@/lib/platform-shapes';

type Row = Record<string, unknown>;
type Group = { key: string | null; value: Figure };
/** The part of either route's answer the factory reads: the two share it, field for field. */
type Answer = {
  groups: Group[];
  rest: { groups: number; value: number } | null;
  total: Figure;
  rows: Part<{ rows: Row[]; total: number }> | null;
};

/** The first date there is, which both routes read as the measure's first recorded day: the runner's `all`. */
const FIRST = '0001-01-01';
/** The most rows a drill answers, the routes' own ceiling. */
const ROWS = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY = /^(\d{4}-\d{2}-\d{2})T23:59:59\.999Z$/;

const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** One call of the route: the measure, its filters, its window, its grouping and how much of it. */
type Ask = { where: [string, string | null][]; from?: string; to?: string; by?: string; top?: number; rows?: number };

function routeOf(row: PreparedRow): string {
  return row.route === 'work' ? '/work/query' : '/platform/query';
}

/** The route asked once, as the person: its answer, or a sentence when a part it was asked for could not be read. */
async function asked(row: PreparedRow, a: Ask): Promise<Answer> {
  const p = new URLSearchParams({ measure: row.measure });
  // Work's route groups every call by something; with no group asked, the total is the answer and one group is read.
  const by = a.by ?? (row.route === 'work' ? row.dimensions[0] : undefined);
  if (by !== undefined) p.set('by', by);
  if (a.from !== undefined) p.set('from', a.from);
  if (a.to !== undefined) p.set('to', a.to);
  for (const [dim, value] of a.where) p.append('where', `${dim}=${value ?? ''}`);
  const top = a.top ?? (a.by === undefined && by !== undefined ? 1 : undefined);
  if (top !== undefined) p.set('top', String(top));
  if (a.rows !== undefined) p.set('rows', String(a.rows));
  return gatewayGet<Answer>(`${routeOf(row)}?${p}`);
}

/** A figure as a number, null for one with no data; one the route could not read is thrown. */
function valueOf(row: PreparedRow, f: Figure): number | null {
  if (f.why === 'unavailable') throw new Error(`${row.label} could not be read just now.`);
  return f.value;
}

/** Refuses with a sentence, before anything is read. */
function refuse(row: PreparedRow, what: string): never {
  throw new Error(`${row.label} cannot be asked ${what}: the gateway's prepared query does not answer it.`);
}

/** A condition as the route's equality filter on one of the measure's dimensions. */
function filterOf(row: PreparedRow, c: Condition): [string, string | null] {
  if (!row.dimensions.includes(c.field)) refuse(row, `about ${c.field}, which is none of its dimensions (${row.dimensions.join(', ') || 'it has none'})`);
  if (c.op !== 'eq') refuse(row, `${c.field} ${c.op}: a dimension is narrowed by eq alone`);
  if (c.value === null && row.route === 'work') refuse(row, `${c.field} eq null: every row of it has a value`);
  if (c.value !== null && typeof c.value !== 'string' && typeof c.value !== 'number') refuse(row, `${c.field} eq a ${typeof c.value}`);
  return [c.field, c.value === null ? null : String(c.value)];
}

/** The window's inclusive dates, checked: the route reads a date as the reporting time zone's whole day. */
function datesOf(row: PreparedRow, w: NonNullable<AggregateQuery['window']>): { from: string; to: string } {
  if (w.field !== row.date) refuse(row, `a window on ${w.field}: its window is cut on ${row.date}`);
  if (!DATE.test(w.from) || !DATE.test(w.to)) refuse(row, 'a window that is not two dates');
  return { from: w.from, to: w.to };
}

/** One call per base measure the query reads, each with the conditions it adds, worked out before anything is read. */
function plan(row: PreparedRow, q: AggregateQuery): { name: string; ask: Ask }[] {
  const where = (q.where ?? []).map((c) => filterOf(row, c));
  const window = q.window ? datesOf(row, q.window) : {};
  let by: string | undefined;
  if (q.group && 'bucket' in q.group) {
    if (q.group.field !== row.date || !row.buckets.includes(q.group.bucket)) refuse(row, `by ${q.group.bucket} of ${q.group.field}`);
    by = q.group.bucket;
  } else if (q.group) {
    if (!row.dimensions.includes(q.group.field)) refuse(row, `by ${q.group.field}, which is none of its dimensions`);
    by = q.group.field;
  }
  if (!q.measures.length) refuse(row, 'for no measure');
  return q.measures.map((m) => {
    if (row.sums ? m.agg !== 'sum' || m.field !== row.sums : m.agg !== 'count') {
      refuse(row, `${m.agg}${m.field ? ` of ${m.field}` : ''}: it answers ${row.sums ? `the sum of ${row.sums}` : 'a count'}`);
    }
    return { name: m.name, ask: { ...window, where: [...where, ...(m.where ?? []).map((c) => filterOf(row, c))], by, top: by === undefined ? undefined : q.top } };
  });
}

/**
 * The route's answers as one `AggregateResult`: the groups are the first measure's, in the route's order, and every
 * other measure is read off its own answer by key. A key another answer does not hold is zero where that answer folded
 * nothing and unknown where it did; the rest of each is its total less the groups shown, which is what the route
 * folded, since every measure adds up. The route answers figures, not rows, so a group's `rows` is its first figure.
 */
function merged(row: PreparedRow, names: string[], answers: Answer[], grouped: boolean): AggregateResult {
  const values = (pick: (a: Answer) => number | null) => Object.fromEntries(names.map((n, i) => [n, pick(answers[i])]));
  const first = answers[0];
  const total = values((a) => valueOf(row, a.total));
  // Work's route groups even a call that asks for none (`asked`): its one group is not an answer to anything asked.
  if (!grouped) return { total: { rows: total[names[0]] ?? 0, values: total }, groups: [], others: null };
  const at = (a: Answer, key: string | null): number | null => {
    const g = a.groups.find((x) => x.key === key);
    return g ? valueOf(row, g.value) : a.rest ? null : 0;
  };
  const groups = first.groups.map((g) => {
    const vs = values((a) => at(a, g.key));
    return { key: g.key, rows: vs[names[0]] ?? 0, values: vs };
  });
  let others: AggregateResult['others'] = null;
  if (first.rest) {
    const vs = values((a) => {
      const all = valueOf(row, a.total);
      const shown = groups.map((g) => at(a, g.key));
      return all === null || shown.some((v) => v === null) ? null : all - shown.reduce<number>((s, v) => s + v!, 0);
    });
    vs[names[0]] = first.rest.value;
    others = { groups: first.rest.groups, rows: first.rest.value, values: vs };
  }
  return { total: { rows: total[names[0]] ?? 0, values: total }, groups, others };
}

/** The runner's drill as the route's call: its filters, its window as dates, and the route's own order and size. */
function drillOf(row: PreparedRow, q: Query): Ask {
  const where: [string, string | null][] = [];
  let from: string | undefined, to: string | undefined;
  for (const c of q.where ?? []) {
    if (c.field !== row.date) { where.push(filterOf(row, c)); continue; }
    const after = c.op === 'gt' && typeof c.value === 'string' ? END_OF_DAY.exec(c.value) : null;
    if (after && from === undefined) from = shift(after[1], 1);
    else if (c.op === 'lt' && typeof c.value === 'string' && DATE.test(c.value) && to === undefined) to = shift(c.value, -1);
    else refuse(row, `${c.field} ${c.op} ${String(c.value)}: a window is whole days, as the runner cuts them`);
  }
  if (from !== undefined && to === undefined) refuse(row, 'a window with a start and no end');
  if (to !== undefined && from === undefined) from = FIRST;
  if (q.sort && (q.sort.field !== row.date || q.sort.dir !== 'desc')) refuse(row, `in order of ${q.sort.field} ${q.sort.dir}: its rows come newest first`);
  if (q.offset) refuse(row, 'from an offset: a drill reads the newest rows');
  const limit = q.limit ?? ROWS;
  if (!Number.isInteger(limit) || limit < 1) refuse(row, `for ${limit} rows`);
  return { where, from, to, rows: Math.min(limit, ROWS) };
}

/** The caller's own tokens, from their Access answer: what each is called, whether it is live, and for which application. */
async function tokensOf(): Promise<Row[]> {
  const { issued } = await gatewayGet<Access>('/access');
  return issued.map((t) => ({
    id: t.id, label: t.label, state: t.revokedAt ? 'revoked' : 'live', application: t.application,
    createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt,
  }));
}

export function preparedCollection(row: PreparedRow): AnyCollection {
  const base = {
    name: row.name, label: row.label, description: row.description, key: row.key, fields: row.fields,
    title: (r: Row) => String(r[row.key] ?? ''),
    ...(row.pageOnly ? { pageOnly: row.pageOnly } : {}),
  };
  if (row.route === 'access') {
    const c: AnyCollection = {
      ...base,
      query: async (q: Query) => queryRows(await tokensOf(), row.key, q),
      aggregate: async (q: AggregateQuery) => aggregateRows(await tokensOf(), normalizeAggregate(c, q)),
    };
    return c;
  }
  return {
    ...base,
    aggregate: async (q: AggregateQuery) => {
      const calls = plan(row, q);
      const answers = await Promise.all(calls.map((c) => asked(row, c.ask)));
      return merged(row, calls.map((c) => c.name), answers, q.group !== undefined);
    },
    query: async (q: Query) => {
      if ('none' in row.drill) throw new Error(row.drill.none);
      const ask = drillOf(row, q);
      if (row.drill.needs && !(await may(row.drill.needs))) throw new AccessDenied();
      const answer = await asked(row, ask);
      if (!answer.rows || answer.rows.state !== 'ok') throw new Error(`${row.label}'s rows could not be read just now.`);
      const flat = row.drill.flat ?? ((r: Row) => r);
      return { rows: answer.rows.data.rows.map(flat), total: answer.rows.data.total };
    },
  };
}
