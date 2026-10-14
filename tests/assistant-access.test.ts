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
import { FLEET } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import { handedTo } from '@/lib/assistant/scoped';
import { assistantTools } from '@/lib/assistant/tools';
import type { Me } from '@/lib/api-shapes';
import type { InitiativeList } from '@/lib/work-shapes';
import { platformStatusContext, statusRead } from '@/views/platform-status-context';
import { viewTools } from '@/views/tools';
import { ME } from '../scripts/fake-gateway/people.ts';
import { PEOPLE } from '../scripts/fake-gateway/platform-people.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { TEAMS, teamDetail } from '../scripts/fake-gateway/platform-teams.ts';
import { search } from '../scripts/fake-gateway/search.ts';
import { KNOWLEDGE } from '../scripts/fake-gateway/work.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';

const MEMBER: Me = { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon' };

/**
 * Every request the server made, and the gateway that answers them as `who`; `null` is a browser with no session.
 * Teams, a team and People are the superadmin's, and anybody else is refused them as the gateway refuses them.
 * With `shared`, every search result comes back as one on the platform's shared shelf.
 */
let calls: { url: string; headers: Record<string, string> }[] = [];
function gateway(who: Me | null | (() => Me | null), { shared = false } = {}) {
  calls = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    const me = typeof who === 'function' ? who() : who;
    if (!me) return { ok: false, status: 401, json: async () => ({ error: 'not signed in' }) } as Response;
    const path = new URL(url).pathname.replace('/api/console', '');
    if (/^\/(teams|people)(\/|$)/.test(path) && !me.superadmin) return { ok: false, status: 403, json: async () => ({ error: 'not permitted' }) } as Response;
    const body = path === '/me' ? me
      : path === '/teams' ? { teams: TEAMS }
        : path.startsWith('/teams/') ? teamDetail(path.slice('/teams/'.length))
          : path === '/initiatives' ? initiativeList(me, new URL(url).searchParams)[1]
            : path === '/knowledge' ? { nodes: KNOWLEDGE }
              : path === '/people' ? { people: PEOPLE }
                : path === '/search' ? found(new URL(url).searchParams, shared)
                  : path === '/platform/status' ? (me.superadmin ? PLATFORM_STATUS : MEMBER_STATUS)
                    : {};
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

function found(query: URLSearchParams, shared: boolean) {
  const answer = search(query.get('q') ?? '', Number(query.get('limit') ?? 15), query.get('initiative'));
  return shared ? { ...answer, results: answer.results.map((r) => ({ ...r, shelf: 'platform' as const, team: 'zz-platform' })) } : answer;
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

  it('the tenant is the team the person acts for, a superadmin\'s as a member\'s, and the subject is their email', async () => {
    gateway(ME);
    expect(await resolveAccess()).toMatchObject({ tenantId: 'atlas', subjectId: ME.email });
    gateway(MEMBER);
    expect(await resolveAccess()).toMatchObject({ tenantId: 'beacon', subjectId: MEMBER.email });
    // A superadmin in no team acts for none, and is still themselves.
    gateway({ ...ME, teams: [], activeTeam: null });
    expect(await resolveAccess()).toMatchObject({ tenantId: '', subjectId: ME.email });
  });

  it('a role the table does not have, or one the gateway contradicts, is no scope', async () => {
    for (const body of [{ ...MEMBER, role: 'auditor' }, { ...MEMBER, superadmin: true }, { ...ME, superadmin: false }]) {
      gateway(body as Me);
      await expect(resolveAccess()).rejects.toBeInstanceOf(Unauthenticated);
      await expect(may(FLEET)).rejects.toBeInstanceOf(Unauthenticated);
    }
  });
});

describe('what an agent is offered', () => {
  it('a member is offered the lists the rail shows a member, and none of the fleet\'s', async () => {
    gateway(MEMBER);
    const scope = await resolveAccess();
    const offered = [];
    for (const c of collections) if (await can(scope, c.name, 'read')) offered.push(c.name);
    expect(offered).toEqual(['initiatives', 'knowledge', 'knowledge_log', 'tokens']);
    expect(await may(FLEET)).toBe(false);
    await expect(requireNeed(FLEET)).rejects.toBeInstanceOf(AccessDenied);
  });

  it('a member holds platform:read, and it opens none of the fleet', async () => {
    gateway(MEMBER);
    expect(await may('platform:read')).toBe(true);
    // The views the route registers for them: the ones whose need they satisfy (`app/api/assistant/route.ts`).
    const views = [];
    for (const v of viewTools) if (await may(v.needs)) views.push(v.name);
    expect(views).toEqual(['overview', 'initiatives', 'initiative', 'document', 'knowledge', 'knowledge_node', 'knowledge_log', 'search', 'settings', 'platform_status']);
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
    // The same person under another name is the same scope; acting for another team, or in other teams, is not.
    who = { ...ME, name: 'Ava L.' };
    expect(await can(scope, 'initiatives', 'read')).toBe(true);
    who = { ...ME, activeTeam: 'beacon' };
    expect(await can(scope, 'initiatives', 'read')).toBe(false);
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
    // People is the superadmin's: a member's query is refused on who they are, before the gateway is asked for a row.
    await expect(people.query({})).rejects.toBeInstanceOf(AccessDenied);
    expect(calls.some((c) => new URL(c.url).pathname === '/api/console/people')).toBe(false);
  });
});

describe('a collection read from the gateway', () => {
  it('reads initiatives a page at a time from the route that filters them, and answers the route\'s total', async () => {
    gateway(ME);
    const initiatives = collectionFor(await resolveAccess(), 'initiatives');
    // What the list was asked, less the scope every server read carries (`gatewayGet`), which Work's list ignores.
    const asked = () => calls.map((c) => new URL(c.url)).filter((u) => u.pathname === '/api/console/initiatives')
      .map((u) => Object.fromEntries([...u.searchParams].filter(([k]) => k !== 'scope')));
    const first = await initiatives.query({});
    expect(asked()).toEqual([{ limit: '10', offset: '0' }]);
    expect(first.rows).toHaveLength(10);
    // The route's total, so a count is of every initiative that matches, never of the page that came back.
    expect(first.total).toBe((initiativeList(ME, new URLSearchParams())[1] as { total: number }).total);
    expect(first.total).toBeGreaterThan(first.rows.length);
    gateway(ME);
    const found = await initiatives.query({ where: [{ field: 'state', op: 'eq', value: 'waiting' }, { field: 'slug', op: 'contains', value: 'search' }], limit: 5, offset: 0 });
    expect(asked()).toEqual([{ state: 'waiting', q: 'search', limit: '5', offset: '0' }]);
    expect(found.total).toBe(1);
    // The next move in `initiative_status`'s own words, as the fake answers them: the row carries the action as it came.
    const next = (initiativeList(ME, new URLSearchParams('state=waiting&q=search'))[1] as InitiativeList).rows[0].nextMove?.action ?? null;
    expect(found.rows[0]).toMatchObject({ slug: '2026-09-28-search-relevance', state: 'waiting', next, nextDocument: 'plan.md', gatesPassed: 1, gates: 3 });
  });

  it('refuses a condition or an order the route does not take, before anything is read', async () => {
    gateway(ME);
    const initiatives = collectionFor(await resolveAccess(), 'initiatives');
    await expect(initiatives.query({ where: [{ field: 'gates', op: 'gt', value: 1 }] })).rejects.toThrow(/state eq, flow eq, slug contains/);
    await expect(initiatives.query({ where: [{ field: 'state', op: 'eq', value: 'open' }, { field: 'state', op: 'eq', value: 'quiet' }] })).rejects.toThrow(/each once/);
    await expect(initiatives.query({ sort: { field: 'lastTouched', dir: 'asc' } })).rejects.toThrow(/ordered by the gateway/);
    expect(calls.some((c) => new URL(c.url).pathname === '/api/console/initiatives')).toBe(false);
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

describe('the fleet\'s lists, read whole', () => {
  // The gateway pages Teams and People at 10 rows unless asked; the assistant counts over every row, so it asks for them all.
  it('asks for every team and every person on one page, from a collection and from a view', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    await collectionFor(scope, 'teams').query({});
    await collectionFor(scope, 'people').query({});
    await viewTools.find((v) => v.name === 'teams')!.read({});
    await viewTools.find((v) => v.name === 'people')!.read({});
    const lists = calls.map((c) => c.url).filter((u) => /\/(teams|people)\?/.test(u));
    expect(lists).toEqual([
      'http://gateway.test/api/console/teams?limit=100&scope=platform',
      'http://gateway.test/api/console/people?limit=100&scope=platform',
      'http://gateway.test/api/console/teams?limit=100&scope=platform',
      'http://gateway.test/api/console/people?limit=100&scope=platform',
    ]);
  });

  it('hands the assistant a team as the scalars its list declares, never the figures by week beside them', async () => {
    gateway(ME);
    const { rows } = await collectionFor(await resolveAccess(), 'teams').query({});
    expect(rows).toHaveLength(TEAMS.length);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['created', 'documents', 'initiatives', 'knowledge', 'members', 'name', 'slug', 'sources', 'status']);
    }
  });

  it('reads one team from its own read, and never looks for it in the list', async () => {
    gateway(ME);
    const own = teamDetail('atlas')!;
    const { context, data } = await viewTools.find((v) => v.name === 'team')!.read({ slug: 'atlas' });
    expect(calls.map((c) => new URL(c.url).pathname)).not.toContain('/api/console/teams');
    // Nor the team's initiatives: Work answers the active team's work alone.
    expect(calls.map((c) => new URL(c.url).pathname)).not.toContain('/api/console/initiatives');
    expect(data).toEqual(own);
    expect(context.facts.find((f) => f.label === 'Knowledge nodes')?.value).toBe(String(own.counts.knowledge));
  });
});

describe('a view tool\'s address', () => {
  const tool = (name: string) => viewTools.find((v) => v.name === name)!;

  it('every tool has its own name and a need', () => {
    expect(new Set(viewTools.map((v) => v.name)).size).toBe(viewTools.length);
    for (const v of viewTools) expect(['work:read', 'platform:read', FLEET]).toContain(v.needs);
    expect(viewTools.filter((v) => v.needs === FLEET).map((v) => v.name)).toEqual(['teams', 'team', 'people', 'plugins', 'plugin', 'skill', 'runs', 'activity']);
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

  it('reads Status from the response its page draws, reduced the same way, for a member as for a superadmin', async () => {
    for (const [who, answer] of [[MEMBER, MEMBER_STATUS], [ME, PLATFORM_STATUS]] as const) {
      gateway(who);
      const { context } = await tool('platform_status').read({});
      expect(calls.map((c) => new URL(c.url).pathname + new URL(c.url).search)).toContain('/api/console/platform/status?scope=platform');
      expect(context).toEqual(platformStatusContext(statusRead(answer)));
    }
    gateway(null);
    await expect(tool('platform_status').read({})).rejects.toBeTruthy();
  });

  it('a member cannot read a fleet view by naming its tool', async () => {
    gateway(MEMBER);
    for (const name of ['teams', 'team', 'people', 'plugins', 'plugin', 'skill', 'runs', 'activity']) {
      await expect(tool(name).read({ slug: 'atlas', plugin: 'sdlc', skill: 'sdlc-spec' }), name).rejects.toBeInstanceOf(AccessDenied);
    }
    // Refused on who they are, before a row is asked for: nothing but `/me` was read.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => new URL(c.url).pathname === '/api/console/me')).toBe(true);
    expect((await tool('initiatives').read({})).context.view).toBe('initiatives');
  });

  it('a member searches as their own team, and a superadmin as somebody who reads the fleet', async () => {
    gateway(MEMBER, { shared: true });
    const own = await tool('search').read({ q: 'recency', limit: 3 });
    // No scope is asked for, so the gateway searches as the team the member acts for; and a result on the shared
    // shelf is given no address, because no page of theirs opens it.
    expect(calls.map((c) => c.url).find((u) => u.includes('/search'))).toBe('http://gateway.test/api/console/search?q=recency&limit=3');
    expect(own.context.insights.length).toBeGreaterThan(0);
    expect(own.context.insights.every((i) => i.evidence === undefined)).toBe(true);
    gateway(ME, { shared: true });
    const wide = await tool('search').read({ q: 'recency', limit: 3 });
    expect(wide.context.insights.length).toBeGreaterThan(0);
    expect(wide.context.insights.every((i) => i.evidence?.includes('/zz-platform/'))).toBe(true);
  });
});
