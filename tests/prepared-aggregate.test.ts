// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The prepared collections (`src/data/prepared-aggregate.ts` over `src/data/prepared.ts`, reconciliation 63), each
 * asked as ZZ Meridian asks it, through `aggregate()` and `read()` (`src/data/read.ts`) and through the release's own
 * runner, against the fake gateway's two prepared queries and Access answer stood up as `fetch`.
 *
 * - `aggregate` asks the route once for each base measure it is asked, and answers the route's total, its groups, its
 *   `top` and its folded rest, for every measure, filter, facet and bucket a view's prepared query declares.
 * - The runner's drill is one call of the route's `rows`, newest first, on the same days as the aggregate beside it,
 *   for 7d, 30d, 90d and all.
 * - A drill of a measure the route lists no rows for is refused with its sentence, and anything the route cannot answer
 *   is refused, each before anything is read.
 * - The tokens are the caller's own Access answer and hold no value; and nothing is cached: two callers make two reads.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }), headers: async () => new Headers() }));

import { collections } from '@/data/collections';
import { PREPARED, type PreparedRow } from '@/data/prepared';
import { aggregate, read } from '@/data/read';
import type { AggregateQuery } from '@/lib/collection';
import { runExplore, type PreparedQuery, type Source } from '@/lib/explore';
import { dayOf } from '@/lib/format-date';
import { viewTools } from '@/views/tools';
import { signedIn } from '../scripts/fake-gateway/people.ts';
import { platformQuery } from '../scripts/fake-gateway/platform-query.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { workQuery } from '../scripts/fake-gateway/work-query.ts';

type Call = { path: string; params: URLSearchParams; cookie: string | undefined };
let calls: Call[] = [];
/** The route calls made, `/me` left out: who is asking is read before every read and is not the read. */
const routes = () => calls.filter((c) => c.path !== '/me');

beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'superadmin';
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
  calls = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const p = url.pathname.replace('/api/console', '');
    const cookie = (init?.headers as Record<string, string> | undefined)?.cookie;
    calls.push({ path: p, params: url.searchParams, cookie });
    const who = signedIn(cookie);
    if (!who) return Response.json({ error: 'not signed in' }, { status: 401 });
    const [status, body] = p === '/me' ? [200, who] : p === '/work/query' ? workQuery(who, url.searchParams)
      : p === '/platform/query' ? platformQuery(who, url.searchParams) : p === '/access' ? access(who) : [404, { error: 'no route' }];
    return Response.json(body, { status });
  }) as typeof fetch;
});
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

const DAY = 86_400_000;
const today = () => dayOf(new Date());
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const thirty = (row: PreparedRow): NonNullable<AggregateQuery['window']> => ({ field: row.date, from: shift(today(), -30), to: shift(today(), -1) });
const rowOf = (name: string) => PREPARED.find((r) => r.name === name)!;
const measureOf = (row: PreparedRow) => (row.sums ? { name: 'm', agg: 'sum' as const, field: row.sums } : { name: 'm', agg: 'count' as const });
const routed = PREPARED.filter((r) => r.route !== 'access');
const drilled = routed.filter((r) => !('none' in r.drill));
const undrilled = routed.filter((r) => 'none' in r.drill);
/** The route's own answer to `params`, as the superadmin: what the collection must hand back. */
const direct = (row: PreparedRow, params: URLSearchParams) => {
  const who = signedIn('zz_console=superadmin')!;
  return (row.route === 'work' ? workQuery(who, params) : platformQuery(who, params))[1] as { total: { value: number | null }; groups: { key: string | null; value: { value: number } }[]; rest: { groups: number; value: number } | null };
};

/** Every source a view tool declares, with the collection it reads. */
const declared: [string, Source][] = viewTools.flatMap((v) => Object.entries((v.explore as PreparedQuery).sources).map(([n, s]) => [`view_${v.name}.${n}`, s] as [string, Source]));

describe('the table', () => {
  it('makes one collection a row, every view\'s source over one of them', () => {
    expect(collections.map((c) => c.name)).toEqual(PREPARED.map((r) => r.name));
    for (const [name, s] of declared) expect(PREPARED.some((r) => r.name === s.collection), name).toBe(true);
  });

  it('names the measures the route answers no rows for, and only those', () => {
    expect(undrilled.map((r) => r.name).sort()).toEqual(['malformed', 'migrations', 'model_calls', 'platform_lessons', 'platform_refusals', 'skill_calls']);
  });
});

describe('an aggregate', () => {
  it.each(routed.map((r) => [r.name, r] as const))('%s: its total, from one call of the route', async (_, row) => {
    const w = thirty(row);
    const result = await aggregate(row.name, { measures: [measureOf(row)], window: w });
    expect(routes()).toHaveLength(1);
    const asked = routes()[0].params;
    expect([asked.get('measure'), asked.get('from'), asked.get('to')]).toEqual([row.measure, w.from, w.to]);
    expect(result.total.values.m).toBe(direct(row, asked).total.value);
    expect(result.groups).toEqual([]);
  });

  // The tokens are counted on the console's server, not by a route, and are held below.
  it.each(declared.filter(([, s]) => rowOf(s.collection).route !== 'access').map(([n, s]) => [n, s] as const))('%s: each facet, bucket and filter declared, one call each', async (_, s) => {
    const row = rowOf(s.collection);
    const w = thirty(row);
    const groupings = [...s.facets.map((f) => ({ field: f })), ...(s.buckets ?? []).map((b) => ({ field: row.date, bucket: b }))];
    for (const group of groupings) {
      calls = [];
      const result = await aggregate(row.name, { measures: [measureOf(row)], window: w, group, top: 3 });
      expect(routes(), JSON.stringify(group)).toHaveLength(1);
      const asked = routes()[0].params;
      expect(asked.get('by')).toBe('bucket' in group ? group.bucket : group.field);
      expect(asked.get('top')).toBe('3');
      const answer = direct(row, asked);
      expect(result.groups.map((g) => g.key)).toEqual(answer.groups.map((g) => g.key));
      expect(result.groups.map((g) => g.values.m)).toEqual(answer.groups.map((g) => g.value.value));
      expect(result.others?.groups ?? null).toBe(answer.rest?.groups ?? null);
      expect(result.others?.values.m ?? null).toBe(answer.rest?.value ?? null);
      // A filter on the first group answers that group's figure, from one call naming it.
      if (!('bucket' in group) && s.filters[group.field] && answer.groups[0]) {
        calls = [];
        const one = await aggregate(row.name, { measures: [measureOf(row)], window: w, where: [{ field: group.field, op: 'eq', value: answer.groups[0].key }] });
        expect(routes()).toHaveLength(1);
        expect(routes()[0].params.getAll('where')).toEqual([`${group.field}=${answer.groups[0].key ?? ''}`]);
        expect(one.total.values.m).toBe(answer.groups[0].value.value);
      }
    }
  });

  it('asks once for each base measure, a count\'s own condition on its own call', async () => {
    const result = await aggregate('searches', {
      measures: [{ name: 'all', agg: 'count' }, { name: 'empty', agg: 'count', where: [{ field: 'found', op: 'eq', value: 'none' }] }],
      window: thirty(rowOf('searches')), group: { field: 'at', bucket: 'week' },
    });
    expect(routes().map((c) => c.params.getAll('where'))).toEqual([[], ['found=none']]);
    expect(result.total.values.empty).toBeLessThanOrEqual(result.total.values.all!);
  });

  it('answers a ratio across two sources through the runner, one call for each base', async () => {
    const status = viewTools.find((v) => v.name === 'platform_status')!;
    const { answer } = await runExplore(status.explore, { source: 'malformed', measures: ['per1000'], period: '30d' }, { readable: new Set(PREPARED.map((r) => r.name)), hidden: () => [] }, { aggregate, read, today: today() }, '/platform');
    expect(routes().map((c) => c.params.get('measure')).sort()).toEqual(['calls', 'malformed']);
    expect(answer).toMatch(/Malformed per 1,000 calls: /);
  });
});

const PERIODS = ['7d', '30d', '90d', 'all'] as const;

describe('the runner\'s drill', () => {
  /** One source over `row`, as small as the release accepts: its measure, its date and its key. */
  const one = (row: PreparedRow): PreparedQuery => ({
    sources: { s: { collection: row.name, date: row.date, filters: {}, facets: [], measures: { m: { label: 'M', unit: 'u', definition: 'd', ...measureOf(row) } }, drill: { columns: [row.key], address: () => '/' }, cannot: 'c' } },
  });
  const rights = { readable: new Set(PREPARED.map((r) => r.name)), hidden: () => [] };

  it.each(drilled.flatMap((r) => PERIODS.map((p) => [r.name, p, r] as const)))('%s over %s: the route\'s rows, on the aggregate\'s days', async (_, period, row) => {
    await runExplore(one(row), { source: 's', measures: ['m'], period, rows: 5 }, rights, { aggregate, read, today: today() }, '/');
    const [figure, rows] = routes();
    expect(routes()).toHaveLength(2);
    expect(rows.params.get('rows')).toBe('5');
    for (const k of ['group', 'limit', 'offset']) expect(rows.params.get(k)).toBeNull();
    expect([rows.params.get('from'), rows.params.get('to')]).toEqual([figure.params.get('from'), figure.params.get('to')]);
    expect(rows.params.get('from')).toBe(period === 'all' ? '0001-01-01' : shift(today(), -Number(period.slice(0, -1))));
    expect(rows.params.get('to')).toBe(shift(today(), -1));
  });

  it.each(undrilled.map((r) => [r.name, r] as const))('%s: refused with the sentence naming its page, before any read', async (_, row) => {
    const sentence = (row.drill as { none: string }).none;
    expect(sentence).toMatch(/\(\/[a-z/]*\)/);
    await expect(read(row.name, { where: [{ field: row.date, op: 'lt', value: today() }], sort: { field: row.date, dir: 'desc' }, limit: 5 })).rejects.toThrow(sentence);
    expect(routes()).toEqual([]);
  });

  it('refuses a member the questions searches asked, before any read', async () => {
    jar.zz_console = 'member';
    await expect(read('platform_searches', { limit: 5 })).rejects.toThrow('You do not have access to that.');
    expect(routes()).toEqual([]);
  });
});

describe('what the route cannot answer', () => {
  const runs = rowOf('runs');
  it.each([
    ['an average', 'runs', { measures: [{ name: 'm', agg: 'avg' as const, field: 'lengthMs' }] }],
    ['a sum of what is counted', 'runs', { measures: [{ name: 'm', agg: 'sum' as const, field: 'lengthMs' }] }],
    ['a count of what is summed', 'words', { measures: [{ name: 'm', agg: 'count' as const }] }],
    ['a group by no dimension', 'runs', { measures: [{ name: 'm', agg: 'count' as const }], group: { field: 'lengthMs' } }],
    ['a bucket the route keys as a dimension', 'runs', { measures: [{ name: 'm', agg: 'count' as const }], group: { field: runs.date, bucket: 'weekday' as const } }],
    ['a bucket of a stock', 'shelf', { measures: [{ name: 'm', agg: 'count' as const }], group: { field: 'updated', bucket: 'week' as const } }],
    ['an operator but equality', 'runs', { measures: [{ name: 'm', agg: 'count' as const }], where: [{ field: 'skill', op: 'ne' as const, value: 'x' }] }],
    ['a window on another field', 'runs', { measures: [{ name: 'm', agg: 'count' as const }], window: { field: 'lengthMs', from: '2026-01-01', to: '2026-01-31' } }],
  ])('refuses %s, before any read', async (_, name, q) => {
    await expect(aggregate(name, q as AggregateQuery)).rejects.toThrow(/cannot be asked/);
    expect(routes()).toEqual([]);
  });

  it.each([
    ['an order of its own', { sort: { field: 'skill', dir: 'asc' as const } }],
    ['an offset', { offset: 20 }],
    ['a list of values', { where: [{ field: 'skill', op: 'in' as const, value: ['a', 'b'] }] }],
    ['a window that is no whole day', { where: [{ field: 'startedAt', op: 'gt' as const, value: '2026-10-01T12:00:00Z' }] }],
  ])('refuses a drill with %s, before any read', async (_, q) => {
    await expect(read('runs', q)).rejects.toThrow(/cannot be asked/);
    expect(routes()).toEqual([]);
  });
});

describe('the tokens', () => {
  it('count the caller\'s own Access answer by state and application, and hold no value', async () => {
    jar.zz_console = 'member';
    const result = await aggregate('tokens', { measures: [{ name: 'n', agg: 'count' }], group: { field: 'state' } });
    expect(routes().map((c) => c.path)).toEqual(['/access']);
    const issued = (access(signedIn('zz_console=member')!)[1] as { issued: { revokedAt: string | null }[] }).issued;
    expect(result.total.values.n).toBe(issued.length);
    expect(Object.fromEntries(result.groups.map((g) => [g.key, g.values.n]))).toMatchObject({ live: issued.filter((t) => !t.revokedAt).length });
    const byApp = await aggregate('tokens', { measures: [{ name: 'n', agg: 'count' }], group: { field: 'application' } });
    expect(byApp.groups.length).toBeGreaterThan(0);
    const { rows } = await read('tokens', { limit: 20 });
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['application', 'createdAt', 'id', 'label', 'lastUsedAt', 'revokedAt', 'state']);
  });
});

describe('every read is the caller\'s own', () => {
  it('two callers asking the same aggregate and the same drill make two gateway reads, each with its own cookie', async () => {
    const q = { measures: [{ name: 'm', agg: 'count' as const }], window: thirty(rowOf('closures')) };
    for (const who of ['member', 'superadmin']) { jar.zz_console = who; await aggregate('closures', q); await read('closures', { limit: 3, sort: { field: 'closed', dir: 'desc' } }); }
    expect(routes().map((c) => c.cookie)).toEqual(['zz_console=member', 'zz_console=member', 'zz_console=superadmin', 'zz_console=superadmin']);
  });

  it('keeps nothing: `src/data/read.ts` holds no cached function', () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/data/read.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/['"]use cache['"]/);
    expect(src).not.toMatch(/cacheTag|cacheLife/);
  });
});
