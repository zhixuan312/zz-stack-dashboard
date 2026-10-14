// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Who the assistant acts for, and what it is handed (`src/data/gateway.ts`, `src/data/access.ts`,
 * `src/data/collections.ts`).
 *
 * The gateway is the authority on all of it, so these stand a gateway up as `fetch` and assert two things about every
 * call this app's server makes to it: that the caller's credential went upstream and nothing else of theirs did, and
 * that what the assistant is then offered follows the person the gateway named.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }) }));

import { AccessDenied, Unauthenticated, can, collectionFor, may, requireNeed, resolveAccess } from '@/data/access';
import { collections } from '@/data/collections';
import { PLATFORM } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import { handedTo } from '@/lib/assistant/scoped';
import { assistantTools } from '@/lib/assistant/tools';
import type { Me } from '@/lib/api-shapes';
import { viewTools } from '@/views/tools';
import { ME, PEOPLE, TEAMS } from '../scripts/fake-gateway/people.ts';
import { search } from '../scripts/fake-gateway/search.ts';
import { INITIATIVES, KNOWLEDGE } from '../scripts/fake-gateway/work.ts';

const MEMBER: Me = { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon' };

/** Every request the server made, and the gateway that answers them as `who`; `null` is a browser with no session. */
let calls: { url: string; headers: Record<string, string> }[] = [];
function gateway(who: Me | null | (() => Me | null)) {
  calls = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    const me = typeof who === 'function' ? who() : who;
    if (!me) return { ok: false, status: 401, json: async () => ({ error: 'not signed in' }) } as Response;
    const path = new URL(url).pathname.replace('/api/console', '');
    const body = path === '/me' ? me
      : path === '/teams' ? { teams: TEAMS }
        : path === '/initiatives' ? { initiatives: INITIATIVES }
          : path === '/knowledge' ? { nodes: KNOWLEDGE }
            : path === '/people' ? { people: PEOPLE }
              : path === '/search' ? search(new URL(url).searchParams.get('q') ?? '', Number(new URL(url).searchParams.get('limit') ?? 15), new URL(url).searchParams.get('initiative'))
                : {};
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => { process.env = { ...saved }; });

describe('the server\'s read of the gateway', () => {
  it('sends the session cookie alone, and nothing else the browser sent', async () => {
    Object.assign(jar, { zz_console: 'session-1', theme: 'dark', other_site: 'secret' });
    gateway(ME);
    await gatewayGet('/teams');
    expect(calls[0].headers.cookie).toBe('zz_console=session-1');
    expect(Object.keys(calls[0].headers).sort()).toEqual(['accept', 'cookie']);
  });

  it('asks for the platform scope on every read but /me and /search, and leaves the gateway to decide it', async () => {
    gateway(ME);
    await gatewayGet('/me');
    await gatewayGet('/teams');
    await gatewayGet('/activity?limit=200');
    // The search is the caller's own: the gateway refuses it a platform scope, so none is asked for.
    await gatewayGet('/search?q=latency');
    expect(calls.map((c) => c.url)).toEqual([
      'http://gateway.test/api/console/me',
      'http://gateway.test/api/console/teams?scope=platform',
      'http://gateway.test/api/console/activity?limit=200&scope=platform',
      'http://gateway.test/api/console/search?q=latency',
    ]);
  });

  it('never attaches the laptop\'s token in a production build, even when one is set', async () => {
    process.env.ZZ_DEV_PAT = 'zzp_laptop';
    gateway(ME);
    await gatewayGet('/teams');
    expect(calls[0].headers.authorization).toBeUndefined();
    Object.assign(process.env, { NODE_ENV: 'development' });
    await gatewayGet('/teams');
    expect(calls[1].headers.authorization).toBe('Bearer zzp_laptop');
    expect(calls[1].headers.cookie).toBeUndefined();
  });

  it('refuses with the gateway\'s own sentence, and says so when it has no gateway to ask', async () => {
    gateway(null);
    await expect(gatewayGet('/teams')).rejects.toMatchObject({ status: 401, message: 'not signed in' });
    delete process.env.ZZ_GATEWAY;
    await expect(gatewayGet('/teams')).rejects.toBeInstanceOf(GatewayError);
  });
});

describe('who the request is', () => {
  it('no session is no scope, and so is a session the console refuses', async () => {
    gateway(null);
    await expect(resolveAccess()).rejects.toBeInstanceOf(Unauthenticated);
    gateway({ ...ME, mayRead: false, why: 'authenticated by pat' });
    await expect(resolveAccess()).rejects.toBeInstanceOf(Unauthenticated);
  });

  it('a gateway that is down is an outage, not a sign-out', async () => {
    global.fetch = (async () => ({ ok: false, status: 503, json: async () => ({ error: 'platform database unavailable' }) })) as unknown as typeof fetch;
    await expect(resolveAccess()).rejects.toMatchObject({ status: 503 });
  });

  it('a superadmin\'s tenant is the platform and a member\'s is the team they act for', async () => {
    gateway(ME);
    expect(await resolveAccess()).toMatchObject({ tenantId: 'platform', subjectId: ME.email });
    gateway(MEMBER);
    expect(await resolveAccess()).toMatchObject({ tenantId: 'team:beacon', subjectId: MEMBER.email });
  });
});

describe('what an agent is offered', () => {
  it('a member is offered the lists the rail shows a member, and none of the fleet\'s', async () => {
    gateway(MEMBER);
    const scope = await resolveAccess();
    const offered = [];
    for (const c of collections) if (await can(scope, c.name, 'read')) offered.push(c.name);
    expect(offered).toEqual(['initiatives', 'knowledge', 'knowledge_log', 'people', 'tokens']);
    expect(await may(PLATFORM)).toBe(false);
    await expect(requireNeed(PLATFORM)).rejects.toBeInstanceOf(AccessDenied);
  });

  it('a superadmin is offered every list', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    for (const c of collections) expect(await can(scope, c.name, 'read')).toBe(true);
  });

  it('a session that changed hands since the scope was resolved is allowed nothing', async () => {
    let who: Me = ME;
    gateway(() => who);
    const scope = await resolveAccess();
    who = MEMBER;
    expect(await can(scope, 'initiatives', 'read')).toBe(false);
    who = { ...ME, activeTeam: 'beacon' };
    expect(await can(scope, 'initiatives', 'read')).toBe(true);
    who = { ...ME, teams: [] };
    expect(await can(scope, 'initiatives', 'read')).toBe(false);
  });

  it('a name that is no collection is refused as one the caller may not use', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    expect(await can(scope, 'secrets', 'read')).toBe(false);
    expect(() => collectionFor(scope, 'secrets')).toThrow(AccessDenied);
  });

  it('no collection gives the assistant a tool that changes anything', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    const handed = await Promise.all(collections.map((c) => handedTo(scope, collectionFor(scope, c.name), c.name)));
    const writer = { write() {}, merge() {}, onError: undefined } as never;
    const { tools, toolApproval } = assistantTools(handed, writer, { authorize: async () => true, invalidate: () => {} }, viewTools);
    const names = Object.keys(tools);
    expect(names.filter((n) => /^(create|update|remove)_/.test(n))).toEqual([]);
    expect(Object.keys(toolApproval)).toEqual([]);
    expect(names.filter((n) => n.startsWith('query_')).sort()).toEqual(collections.map((c) => `query_${c.name}`).sort());
    expect(names.filter((n) => n.startsWith('view_'))).toHaveLength(viewTools.length);
  });

  it('what a page does is declared as the page\'s, to whoever may do it there', async () => {
    gateway(ME);
    const admin = await resolveAccess();
    const teams = await handedTo(admin, collectionFor(admin, 'teams'), 'teams');
    expect(teams.pageOnly).toEqual(['create', 'remove']);
    expect(typeof teams.create).toBe('function');
    await expect(teams.create!({ name: 'x' })).rejects.toThrow('That is done on the Settings page, by the person.');

    gateway(MEMBER);
    const member = await resolveAccess();
    expect(await can(member, 'people', 'create')).toBe(false);
    expect(await can(member, 'tokens', 'create')).toBe(true);
    const people = await handedTo(member, collectionFor(member, 'people'), 'people');
    expect(people.create).toBeUndefined();
  });
});

describe('a collection read from the gateway', () => {
  it('flattens an initiative to the state and the gates its page shows', async () => {
    gateway(ME);
    const { rows, total } = await collectionFor(await resolveAccess(), 'initiatives').query({ where: [{ field: 'id', op: 'eq', value: 'atlas/2026-09-28-search-relevance' }] });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ team: 'atlas', slug: '2026-09-28-search-relevance', state: 'Waiting on you', waitingOn: 'approve plan' });
  });

  it('filters, sorts and pages with the meaning an array collection gives them', async () => {
    gateway(ME);
    const teams = collectionFor(await resolveAccess(), 'teams');
    const active = await teams.query({ where: [{ field: 'status', op: 'eq', value: 'active' }], sort: { field: 'initiatives', dir: 'desc' }, limit: 2 });
    expect(active.total).toBe(TEAMS.filter((t) => t.status === 'active').length);
    expect(active.rows.map((t) => t.slug)).toEqual([...TEAMS].filter((t) => t.status === 'active').sort((a, b) => b.initiatives - a.initiatives).slice(0, 2).map((t) => t.slug));
    expect((await teams.query({ where: [{ field: 'name', op: 'contains', value: 'RESEARCH' }] })).rows.map((t) => t.slug)).toEqual(['atlas']);
    expect((await teams.query({ where: [{ field: 'initiatives', op: 'gt', value: 100 }] })).total).toBe(0);
  });

  it('finds a knowledge node by a tag, which arrives as a list and is read as text', async () => {
    gateway(ME);
    const tag = KNOWLEDGE.find((n) => n.tags?.length)!.tags![0];
    const { rows } = await collectionFor(await resolveAccess(), 'knowledge').query({ where: [{ field: 'tags', op: 'contains', value: tag }] });
    expect(rows.length).toBe(KNOWLEDGE.filter((n) => n.tags?.some((t) => t.toLowerCase().includes(tag.toLowerCase()))).length);
  });

  it('two questions asked at once each get their own rows', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    // Each query is its own gateway read and nothing is kept between two: asked together, neither list may answer
    // with the other's rows, and a second ask reads the gateway again rather than a kept copy.
    const [teams, people, again] = await Promise.all([
      collectionFor(scope, 'teams').query({}),
      collectionFor(scope, 'people').query({ sort: { field: 'name', dir: 'asc' } }),
      collectionFor(scope, 'teams').query({ limit: 1 }),
    ]);
    expect(teams.rows.map((t) => t.slug).sort()).toEqual(TEAMS.map((t) => t.slug).sort());
    expect(people.total).toBe(PEOPLE.length);
    expect(people.rows.every((p) => 'email' in p)).toBe(true);
    expect(again.total).toBe(TEAMS.length);
    expect(again.rows).toHaveLength(1);
    const reads = calls.filter((c) => c.url.includes('/teams')).length;
    await collectionFor(scope, 'teams').query({});
    expect(calls.filter((c) => c.url.includes('/teams')).length).toBe(reads + 1);
  });

  it('re-asks who is calling at the moment a handed query runs', async () => {
    let who: Me | null = ME;
    gateway(() => who);
    const scope = await resolveAccess();
    const teams = await handedTo(scope, collectionFor(scope, 'teams'), 'teams');
    expect((await teams.query({})).total).toBe(TEAMS.length);
    who = null;
    await expect(teams.query({})).rejects.toBeInstanceOf(AccessDenied);
  });
});

describe('a view tool\'s address', () => {
  const tool = (name: string) => viewTools.find((v) => v.name === name)!;

  it('every tool has its own name and a need', () => {
    expect(new Set(viewTools.map((v) => v.name)).size).toBe(viewTools.length);
    for (const v of viewTools) expect(v.needs === 'public' || v.needs === PLATFORM).toBe(true);
  });

  it('refuses a segment that would leave the path it is placed in', () => {
    expect(tool('team').input.safeParse({ slug: 'atlas' }).success).toBe(true);
    for (const slug of ['../me', 'atlas/../../settings/platform/people', 'atlas?scope=platform', '', '.']) expect(tool('team').input.safeParse({ slug }).success).toBe(false);
    expect(tool('document').input.safeParse({ team: 'atlas', slug: '2026-09-28-search-relevance', path: 'sources/notes.md' }).success).toBe(true);
    for (const path of ['../spec.md', 'sources/../../x', '/etc/passwd', 'spec.md?revision=1', 'a//b']) expect(tool('document').input.safeParse({ team: 'atlas', slug: 's', path }).success).toBe(false);
  });

  it('the search takes a question and little else, and reaches the gateway as that question', async () => {
    const input = tool('search').input;
    expect(input.safeParse({ q: 'latency budget' }).success).toBe(true);
    expect(input.safeParse({ q: 'latency', limit: 3, initiative: '2026-09-28-search-relevance' }).success).toBe(true);
    for (const bad of [{}, { q: '' }, { q: 'x' }, { q: 'a'.repeat(201) }, { q: 'latency', limit: 0 }, { q: 'latency', limit: 9 }, { q: 'latency', initiative: '../spec.md' }, { q: 'latency', initiative: 'a?scope=platform' }]) {
      expect(input.safeParse(bad).success).toBe(false);
    }
    gateway(MEMBER);
    const { context } = await tool('search').read({ q: 'latency budget & more', limit: 3, initiative: '2026-09-28-search-relevance' });
    expect(context.view).toBe('search');
    const asked = calls.map((c) => c.url).find((u) => u.includes('/search'));
    expect(asked).toBe('http://gateway.test/api/console/search?q=latency+budget+%26+more&limit=3&initiative=2026-09-28-search-relevance');
    // A member is offered it wherever the Knowledge page is, and nobody is without a session.
    expect(tool('search').needs).toBe(tool('knowledge').needs);
    gateway(null);
    await expect(tool('search').read({ q: 'latency' })).rejects.toBeTruthy();
  });

  it('a member cannot read a fleet view by naming its tool', async () => {
    gateway(MEMBER);
    await expect(tool('teams').read({})).rejects.toBeInstanceOf(AccessDenied);
    await expect(tool('plugins').read({})).rejects.toBeInstanceOf(AccessDenied);
    expect((await tool('initiatives').read({})).context.view).toBe('initiatives');
  });
});
