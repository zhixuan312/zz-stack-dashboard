/**
 * Starting the fake gateway as a server, for a test file to read and to kill, and reading it as a person.
 *
 * One helper because the start contract is the server's, not a test's: `scripts/fake-gateway/server.ts` takes
 * `--port 0`, picks a free port and prints `listening on <url>` once it is ready, and every suite that reads the
 * fixture over HTTP waits for that line. A copy per suite is one place to change when the flag or the line changes,
 * and the copies that were forgotten would hang on a fixture that started perfectly well. The same holds for asking it:
 * who is asking is the `zz_console` cookie, and the key sets every read's `meta` and every period carry are the
 * gateway's, so the suites take both from here.
 *
 * COUPLED: `scripts/browser.ts` starts the same script as `verify.config.ts`'s `fakeApi` and waits for the same line,
 * so the print is a contract two callers with nothing else in common depend on.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { expect, vi } from 'vitest';
import type { ServerRead } from '../src/logic/knowledge-context.ts';

/** How long a fixture gets to print its address before the suite is told it never did. */
const START_FAILED_MS = 15_000;

/** A started fixture: the address it printed, and the process to kill when the suite ends. */
type Fixture = { base: string; proc: ChildProcess };

/** Start `scripts/fake-gateway/server.ts` from this repository and resolve once it prints its address; `extra` are the
 *  flags a suite needs beyond `--port 0`, such as `--mode`. The rejection names everything it printed, stdout and stderr
 *  both, because a fixture that could not start says why on the second. */
export function startFakeGateway(...extra: string[]): Promise<Fixture> {
  // A fixture takes any port: the test run sets ZZ_GATEWAY to the address the app's build-time rewrite points at, and
  // this process is not the one serving it.
  const proc = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0', ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ZZ_GATEWAY: '' } });
  return new Promise<Fixture>((resolve, reject) => {
    let out = '';
    // A fixture that never printed is killed with the rejection: the suite never gets the process to kill it itself.
    const timer = setTimeout(() => { proc.kill(); reject(new Error(`no address printed: ${out}`)); }, START_FAILED_MS);
    proc.stdout!.on('data', (d: Buffer) => {
      out += String(d);
      const m = /listening on (\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve({ base: m[1], proc }); }
    });
    proc.stderr!.on('data', (d: Buffer) => { out += String(d); });
    proc.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
  });
}

/** An answer as a suite reads it: any shape, checked key by key. */
export type Json = Record<string, any>;

/**
 * Requests to a started fixture as the person a `zz_console` cookie value names; `null` sends no cookie, which the
 * fixture reads as the superadmin. `base` is read at each request, since a suite starts its fixture in a `beforeAll`.
 * A path may be written with or without its leading slash.
 */
export function asking(base: () => string) {
  const ask = (who: string | null, path: string, init: RequestInit = {}) => fetch(`${base()}/api/console/${path.replace(/^\//, '')}`, {
    ...init, headers: { ...(init.headers as Record<string, string>), ...(who === null ? {} : { cookie: `zz_console=${who}` }) },
  });
  /** A read that must answer 200, as its body. */
  const read = async <T = Json>(who: string | null, path: string): Promise<T> => {
    const res = await ask(who, path);
    expect(res.status, `${who ?? 'no cookie'} GET ${path}`).toBe(200);
    return res.json() as Promise<T>;
  };
  /** A write with a JSON body; a string body is sent as it is, so a case can send one that is not JSON. */
  const post = (who: string | null, path: string, body: unknown) => ask(who, path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  /** A read, or a write when there is a body, answered with its status and its body (null for a 204). */
  const call = async <T = Json>(who: string | null, path: string, body?: unknown): Promise<{ status: number; body: T }> => {
    const res = await (body === undefined ? ask(who, path) : post(who, path, body));
    return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T };
  };
  return { ask, read, post, call };
}

/** An object's keys, sorted, to hold against a declared key set. */
export const keys = (o: object) => Object.keys(o).sort();

/** A part's data, once it is held to have answered: of the part's own type, or any for an answer read as `Json`. */
export function ok<T>(part: { state: string; data?: T } | Json): unknown extends T ? any : T {
  expect(part.state).toBe('ok');
  return part.data;
}

/** An answer with the one field levelled that every request has of its own: two reads of a route differ in
 *  `observedAt` when they differ nowhere else, since each request is served at its own instant. */
export const unobserved = <T,>(v: T): T => (v && typeof v === 'object' && 'meta' in v
  ? { ...v, meta: { ...(v as { meta: object }).meta, observedAt: null } }
  : v);

// The key sets the gateway's shapes declare (`ReadMeta`, `PeriodFigure` in src/lib/platform-shapes.ts), written out
// here and never read from the fixture, so a field the fake adds or drops fails before the platform's own checks.
export const META = ['asOf', 'builtAt', 'cacheHit', 'coverageFrom', 'observedAt', 'period', 'population', 'revision', 'scope', 'sourceRevision', 'timezone'];
export const FIGURE = ['value', 'why'];
export const WINDOW = ['complete', 'from', 'observedFrom', 'observedThrough', 'to'];
export const PERIOD = ['denominator', 'figure', 'numerator', 'window'];

/** The global fetch as it was before any suite stubs it: a stubbed browser still reaches the fixture through it. */
const realFetch = globalThis.fetch;

/** The session of `who` (`superadmin` or `member`) in one of the fixture's states (`scripts/fake-gateway/states.ts`). */
const inState = (who: string, state: string) => `zz_console=${who}+${state}`;

/** One read as the console's server makes it, for `who` in `state`, across every team (`scope=platform`). */
export const servedIn = (base: string, who: string, state: string, path: string) =>
  realFetch(`${base}/api/console${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: inState(who, state) } });

/** That read as a page's server read hands it to its view: the data, stamped `at`, or the reason it failed. */
export async function serverReadIn<T>(base: string, who: string, state: string, path: string, at: string): Promise<ServerRead<T>> {
  const res = await servedIn(base, who, state, path);
  const body = await res.json() as T & { error?: string };
  return res.ok ? { state: 'ok', data: body, at } : { state: 'failed', reason: body.error ?? `HTTP ${res.status}` };
}

/** The browser's reads, sent to the fixture for `who` in `state`. */
export function browserIn(base: string, who: string, state: string) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(`${base}${String(input)}`, { method: init?.method, body: init?.body, headers: { accept: 'application/json', cookie: inState(who, state) } })));
}
