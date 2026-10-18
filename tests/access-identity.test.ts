// @vitest-environment node
import { AsyncLocalStorage } from 'node:async_hooks';
import { NextRequest } from 'next/server';
import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import * as React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What `tests/access-gate.test.ts` cannot say, because it asks the gate outside a request: that one request reads
 * `/me` once however often it asks who is signed in, that two requests never share the answer, where a signed-out
 * request is sent back to, and that `proxy.ts` is what tells a page its own address.
 *
 * `identity` in `src/data/access.ts` is React's `cache`. In a browser's build of React, which is the one this runner
 * resolves, `cache` remembers nothing; on a server it remembers for the request being rendered. So this file puts the
 * server's build of React in the browser's place, the file the `react-server` condition names, and stands in for the
 * one thing the server's renderer supplies: which request is being rendered. The renderer keeps that in an
 * `AsyncLocalStorage` and answers `getCacheForType` from it, with a new, empty cache when no request is being
 * rendered; `request` below is that, and nothing else about `cache` is replaced.
 */
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const path = await import('node:path');
  const require = createRequire(import.meta.url);
  const server = require(path.join(path.dirname(require.resolve('react/package.json')), 'react.react-server.js'));
  return { ...server, default: server };
});

const requests = new AsyncLocalStorage<Map<unknown, unknown>>();
beforeAll(() => {
  (React as any).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.A = {
    getCacheForType<T>(create: () => T): T {
      const held = requests.getStore() ?? new Map<unknown, unknown>();
      if (!held.has(create)) held.set(create, create());
      return held.get(create) as T;
    },
    cacheSignal: () => null,
    getOwner: () => null,
  };
});
/** One request: everything `render` asks, however long it takes, is asked inside it. */
const request = <T>(render: () => Promise<T>): Promise<T> => requests.run(new Map(), render);

const jar: Record<string, string> = {};
let sent = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => sent,
}));

/** Next's `redirect` throws; this one throws something a test can read the address from. */
const { Redirected } = vi.hoisted(() => {
  class Redirected extends Error {
    readonly to: string;
    constructor(to: string) {
      super(`redirect to ${to}`);
      this.to = to;
    }
  }
  return { Redirected };
});
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

/** The refused view is an async Server Component; here it only says which feature it was drawn for. */
vi.mock('@/views/no-access', () => ({ NoAccess: async ({ feature }: { feature: string }) => ({ refused: feature }) }));

import { Unauthenticated, chromeAccess, gate, may } from '@/data/access';
import { FLEET } from '@/data/features';

type Body = Record<string, unknown>;
const SUPERADMIN: Body = { email: 'owner@example.com', name: 'Owner', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
const MEMBER: Body = { email: 'mei@example.com', name: 'Mei', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };

/** The gateway answers `/me` with a body, with a bare status, or not at all; every request made of it is kept. */
let asked: { url: string; headers: Record<string, string> }[] = [];
function gateway(answer: Body | number | 'down' | (() => Body | number)) {
  asked = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    const now = typeof answer === 'function' ? answer() : answer;
    if (now === 'down') throw new TypeError('fetch failed');
    if (typeof now === 'number') return { ok: false, status: now, json: async () => ({ error: `HTTP ${now}` }) } as Response;
    return { ok: true, status: 200, json: async () => now } as Response;
  }) as typeof fetch;
}

/** Where a call was redirected to, or null when it was not. */
async function redirectOf(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return null;
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'session-1';
  sent = new Headers();
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => {
  process.env = { ...saved };
});

describe('who is asking, within one request', () => {
  it('reads /me once, however many times the gate, the chrome and a need are asked', async () => {
    gateway(MEMBER);
    const out = await request(async () => {
      // The layout's chrome and the page's gate start together, before either has an answer.
      const [chrome, home] = await Promise.all([chromeAccess(), gate('home')]);
      return {
        home,
        teams: await gate('teams'),
        initiatives: await gate('initiatives'),
        only: chrome.only,
        again: (await chromeAccess()).user,
        work: await may('work:read'),
        fleet: await may(FLEET),
      };
    });
    expect(asked.map((a) => a.url)).toEqual(['http://gateway.test/api/console/me']);
    expect(out).toEqual({
      home: null,
      teams: { refused: 'teams' },
      initiatives: null,
      only: [
        '/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access',
        '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge',
      ],
      again: { name: 'Mei', role: 'beacon' },
      work: true,
      fleet: false,
    });
  });

  it('asks as the caller, with their session cookie and no other credential', async () => {
    Object.assign(jar, { theme: 'dark', other_site: 'secret' });
    process.env.ZZ_DEV_PAT = 'zzp_laptop';
    gateway(SUPERADMIN);
    expect(await request(() => gate('teams'))).toBeNull();
    expect(asked).toEqual([{ url: 'http://gateway.test/api/console/me', headers: { accept: 'application/json', cookie: 'zz_console=session-1' } }]);
  });

  it('never gives one request the answer another was given', async () => {
    let who: Body | number = SUPERADMIN;
    gateway(() => who);
    // The superadmin's request is still open when the member's arrives and when the member's ends.
    let resume = () => {};
    const held = new Promise<void>((resolve) => { resume = resolve; });
    const first = request(async () => {
      const before = await gate('teams');
      await held;
      return { before, after: await gate('teams'), user: (await chromeAccess()).user, fleet: await may(FLEET) };
    });
    await vi.waitFor(() => expect(asked).toHaveLength(1));

    who = MEMBER;
    const second = await request(async () => ({ teams: await gate('teams'), user: (await chromeAccess()).user, fleet: await may(FLEET) }));
    expect(second).toEqual({ teams: { refused: 'teams' }, user: { name: 'Mei', role: 'beacon' }, fleet: false });

    who = 401;
    expect(await request(() => redirectOf(() => gate('teams')))).toBe('/login');
    await expect(request(() => chromeAccess())).rejects.toBeInstanceOf(Unauthenticated);

    resume();
    expect(await first).toEqual({ before: null, after: null, user: { name: 'Owner', role: 'atlas' }, fleet: true });
    // One read for each of the four requests, and none for a second question inside one.
    expect(asked).toHaveLength(4);
  });

  it('keeps nothing where there is no request to keep it for', async () => {
    let who: Body = SUPERADMIN;
    gateway(() => who);
    expect(await gate('teams')).toBeNull();
    who = MEMBER;
    expect(await gate('teams')).toEqual({ refused: 'teams' });
    expect(await may(FLEET)).toBe(false);
    expect(asked).toHaveLength(3);
  });

  it('a gateway that cannot answer fails the whole request, and is not asked a second time in it', async () => {
    gateway('down');
    const out = await request(async () => [await gate('home').catch((e: Error) => e.message), await chromeAccess().catch((e: Error) => e.message)]);
    expect(out).toEqual(['fetch failed', 'fetch failed']);
    expect(asked).toHaveLength(1);
  });
});

describe('where a request the gate turns away is sent', () => {
  const NESTED = '/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md?revision=2&tab=sources';

  it('sends a signed-out request for a nested address to sign in, with that whole address', async () => {
    gateway(401);
    sent = new Headers({ 'x-zz-path': NESTED });
    const to = await request(() => redirectOf(() => gate('initiatives')));
    expect(to).toBe(`/login?next=${encodeURIComponent(NESTED)}`);
    expect(new URLSearchParams(to!.split('?')[1]).get('next')).toBe(NESTED);
  });

  it('sends it to the bare sign-in page when nothing says what was asked for', async () => {
    gateway(401);
    expect(await redirectOf(() => gate('home'))).toBe('/login');
  });

  it('never names an address that is not a path on this site', async () => {
    gateway(401);
    for (const elsewhere of ['//evil.example/teams', '/\\evil.example/teams', '/\t/evil.example', 'https://evil.example/teams', 'evil.example', 'javascript:alert(1)', 'teams', '']) {
      sent = new Headers({ 'x-zz-path': elsewhere });
      expect(await redirectOf(() => gate('teams')), JSON.stringify(elsewhere)).toBe('/login');
    }
  });

  it('sends an identity it cannot place to the denied state, and never back to the page', async () => {
    sent = new Headers({ 'x-zz-path': NESTED });
    for (const body of [{ ...MEMBER, role: 'auditor' }, { ...MEMBER, role: undefined }, { ...MEMBER, superadmin: true }, { ...SUPERADMIN, superadmin: false }, { ...MEMBER, email: '' }, { ...MEMBER, teams: undefined }]) {
      gateway(body);
      const to = await redirectOf(() => gate('home'));
      expect(to, JSON.stringify(body)).toMatch(/^\/login\?denied=1&reason=./);
      expect(to).not.toContain('next=');
      await expect(may('work:read')).rejects.toBeInstanceOf(Unauthenticated);
      await expect(chromeAccess()).rejects.toBeInstanceOf(Unauthenticated);
    }
  });
});

describe('the proxy, which tells a page its own address', () => {
  /** A request header as the app is handed it: Next carries each one the proxy set on the response, under this prefix. */
  const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);
  /** The proxy as a laptop runs it, with or without the two keys its rewrite needs: it reads them when it is loaded. */
  async function load(env: Record<string, string>) {
    Object.assign(process.env, env);
    vi.resetModules();
    return import('../proxy.ts');
  }

  it('forwards the path and its query as x-zz-path', async () => {
    const { proxy } = await load({});
    const res = proxy(new NextRequest('http://console.test/platform?a=1'));
    expect(forwarded(res, 'x-zz-path')).toBe('/platform?a=1');
    expect(res.headers.get('x-middleware-override-headers')?.split(',')).toContain('x-zz-path');
    expect(isRewrite(res)).toBe(false);
  });

  it('replaces a value the request already carried', async () => {
    const { proxy } = await load({});
    const res = proxy(new NextRequest('http://console.test/platform?a=1', { headers: { 'x-zz-path': '//evil.example/teams' } }));
    expect(forwarded(res, 'x-zz-path')).toBe('/platform?a=1');
  });

  it('keeps the preload hint on a document route, beside the address', async () => {
    const { proxy } = await load({});
    const res = proxy(new NextRequest('http://console.test/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md'));
    expect(forwarded(res, 'x-zz-path')).toBe('/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md');
    expect(res.headers.get('Link')).toBe('</api/console/document/atlas/2026-09-28-search-relevance/sources/notes.md?scope=platform>; rel=preload; as=fetch; crossorigin=anonymous');
  });

  it('never sends a page to the gateway, on a laptop that sends the gateway\'s own paths there', async () => {
    const { proxy } = await load({ NODE_ENV: 'development', ZZ_GATEWAY: 'http://gateway.test', ZZ_DEV_PAT: 'zzp_laptop' });
    // The laptop's rewrite is live: a gateway path goes upstream with the token.
    const read = proxy(new NextRequest('http://console.test/api/console/me'));
    expect(getRewrittenUrl(read)).toBe('http://gateway.test/api/console/me');
    expect(forwarded(read, 'authorization')).toBe('Bearer zzp_laptop');
    expect(forwarded(read, 'x-zz-path')).toBeNull();
    // And a page, a document's among them, stays here and is given no token.
    for (const path of ['/platform?a=1', '/platform/teams', '/initiatives/atlas/2026-09-28-search-relevance/spec.md', '/api/assistant']) {
      const res = proxy(new NextRequest(`http://console.test${path}`, { headers: { cookie: 'zz_console=session-1' } }));
      expect(isRewrite(res), path).toBe(false);
      expect(forwarded(res, 'x-zz-path'), path).toBe(path);
      expect(forwarded(res, 'authorization'), path).toBeNull();
      expect(forwarded(res, 'cookie'), path).toBe('zz_console=session-1');
    }
  });

  it('runs on every page and on the gateway\'s paths, and not on Next\'s own files or the public ones', async () => {
    const { config } = await load({});
    const reached = (path: string) => unstable_doesMiddlewareMatch({ config, url: path });
    for (const path of ['/', '/platform', '/platform/teams/atlas', '/platform/people', '/access', '/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md', '/login', '/api/console/me', '/auth/status']) {
      expect(reached(path), path).toBe(true);
    }
    for (const path of ['/_next/static/chunks/main.js', '/_next/image?url=%2Fassets%2Fbrand%2Fmascot-hero.png&w=256&q=75', '/assets/brand/wordmark.svg', '/icon.png', '/apple-icon.png']) {
      expect(reached(path), path).toBe(false);
    }
  });
});
