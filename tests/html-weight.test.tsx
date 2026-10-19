import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import InitiativesPage from '../app/(dash)/initiatives/page';
import PlatformPeoplePage from '../app/(dash)/platform/people/page';

/**
 * Initiatives and People fit their HTML caps (Task I-146, AC-8.7). Each page reads its first page of rows on the
 * console's server and hands the read to its client view, and what it hands is the flight payload the HTML carries
 * beside the rows it draws. So the page hands only what the view draws and the assistant's context reads, and each row
 * once: the masthead's as-of line and the records are handed the one read, which the payload carries a single time.
 *
 * Each page is rendered as its route renders it, from the fake gateway's own answer, and every server component it
 * holds is resolved, down to the client views and the props they are handed.
 */

const query = (path: string) => new URLSearchParams(path.split('?')[1]);
/** The fake gateway's answer to the console's server, as `pnpm verify` serves it, for the default person. */
function answer(path: string): unknown {
  if (path === '/me') return ME;
  if (path.startsWith('/initiatives?')) return initiativeList(ME, query(path))[1];
  if (path.startsWith('/people?')) return people(ME, query(path), { limit: Number(query(path).get('limit')), offset: Number(query(path).get('offset')) })![1];
  throw new Error(`the page read ${path}, which this test does not answer`);
}

type Component = (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>;
const isAsync = (type: unknown): type is Component => typeof type === 'function' && type.constructor.name === 'AsyncFunction';

/**
 * The props of every element the page's server tree hands on, with each async server component called for what it
 * renders, as the route's render would: a client view is a plain function here, so it is left as an element and its
 * props are what Flight serializes.
 */
async function handed(node: ReactNode | Promise<ReactNode>, out: Record<string, unknown>[] = []): Promise<Record<string, unknown>[]> {
  const n = await node;
  if (Array.isArray(n)) {
    for (const c of n) await handed(c, out);
    return out;
  }
  if (!isValidElement(n)) return out;
  const { type, props } = n as ReactElement<Record<string, unknown>>;
  if (isAsync(type)) return handed(type(props), out);
  const values = Object.values(props).filter((v) => isValidElement(v) || Array.isArray(v));
  if (typeof type === 'function' && 'served' in props) out.push(props);
  for (const v of values) await handed(v as ReactNode, out);
  return out;
}

/** The `served` props, serialized as Flight serializes them: an object handed twice is written once and referred to after. */
function payload(props: Record<string, unknown>[]): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(props.map((p) => p.served), (_k, v: unknown) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '$ref';
    seen.add(v);
    return v;
  });
}

/** Every key path a value carries, an array's items as `[]`: what the payload says, whatever its values. */
function paths(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap((v) => paths(v, `${at}[]`)))];
  if (value === null || typeof value !== 'object') return [at];
  return Object.entries(value).flatMap(([k, v]) => paths(v, at ? `${at}.${k}` : k));
}
const keysOf = (value: unknown) => [...new Set(paths(value))].sort();
const count = (text: string, needle: string) => text.split(needle).length - 1;

beforeEach(() => {
  gateway.get.mockReset();
  gateway.get.mockImplementation(async (path: string) => answer(path));
});

describe('Initiatives hands its view what it draws, and each row once', () => {
  const page = () => InitiativesPage({ searchParams: Promise.resolve({}) });

  it('the as-of line and the records are handed the one read', async () => {
    const props = await handed(page());
    expect(props).toHaveLength(2);
    expect(props[0].served).toBe(props[1].served);
    expect(gateway.get).toHaveBeenCalledWith(listPath(INITIATIVES_DEFAULTS));
  });

  it('the read carries the tiles, the closures, the rows and the counts the page and the context draw, and nothing else', async () => {
    const [{ served }] = await handed(page());
    expect(keysOf(served)).toEqual([
      'data.closures.data[].abandoned.value', 'data.closures.data[].accepted.value', 'data.closures.data[].delivered.value',
      'data.closures.data[].window.complete', 'data.closures.data[].window.from', 'data.closures.data[].window.to',
      'data.closures.state',
      'data.meta.asOf',
      'data.nextMoveState',
      'data.rows[].flow', 'data.rows[].gates.of', 'data.rows[].gates.passed', 'data.rows[].lastTouched',
      'data.rows[].nextMove.action', 'data.rows[].nextMove.document', 'data.rows[].nextMove.stage',
      'data.rows[].nextMove.waitingOn', 'data.rows[].nextMove.why',
      'data.rows[].slug', 'data.rows[].state',
      'data.summary.data.byFlow[].count', 'data.summary.data.byFlow[].flow',
      'data.summary.data.byState.abandoned', 'data.summary.data.byState.accepted', 'data.summary.data.byState.delivered',
      'data.summary.data.byState.open', 'data.summary.data.byState.quiet', 'data.summary.data.byState.waiting',
      'data.summary.state',
      'data.tiles.closed.abandoned', 'data.tiles.closed.accepted', 'data.tiles.closed.delivered', 'data.tiles.open', 'data.tiles.waiting',
      'data.total',
      'path', 'revisions', 'state', 'team',
    ]);
  });

  it('each row of the page once in the payload', async () => {
    const props = await handed(page());
    const text = payload(props);
    const { rows } = initiativeList(ME, query(listPath(INITIATIVES_DEFAULTS)))[1] as { rows: { slug: string }[] };
    expect(rows.length).toBe(10);
    for (const r of rows) expect(count(text, `"slug":${JSON.stringify(r.slug)}`)).toBe(1);
  });
});

describe('People hands its view what it draws, and each person once', () => {
  const page = () => PlatformPeoplePage({ searchParams: Promise.resolve({}) });

  it('the as-of line and the records are handed the one read', async () => {
    const props = await handed(page());
    expect(props).toHaveLength(2);
    expect(props[0].served).toBe(props[1].served);
    expect(gateway.get).toHaveBeenCalledWith(peoplePath(PEOPLE_DEFAULTS));
  });

  it('the read carries the tiles, the people and the total the page and the context draw, and nothing else', async () => {
    const [{ served }] = await handed(page());
    expect(keysOf(served)).toEqual([
      'data.meta.asOf',
      'data.people[].email', 'data.people[].lastSignIn', 'data.people[].name', 'data.people[].passkeys',
      'data.people[].role', 'data.people[].state', 'data.people[].teams[]',
      'data.tiles.neverSignedIn', 'data.tiles.people',
      'data.tiles.signInsLastWeek.figure.value', 'data.tiles.signInsLastWeek.figure.why', 'data.tiles.signInsLastWeek.window.from',
      'data.tiles.withPasskey',
      'data.total',
      'path', 'revisions', 'state',
    ]);
  });

  it('each person of the page once in the payload', async () => {
    const props = await handed(page());
    const text = payload(props);
    const { people: rows } = answer(peoplePath(PEOPLE_DEFAULTS)) as { people: { email: string }[] };
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) expect(count(text, `"email":${JSON.stringify(p.email)}`)).toBe(1);
  });
});
