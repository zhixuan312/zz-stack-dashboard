// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Who the assistant acts for, and what it is handed (`src/data/gateway.ts`, `src/data/access.ts`,
 * `src/data/collections.ts`, `app/api/assistant/route.ts`).
 *
 * The gateway is the authority on all of it, so these stand a gateway up as `fetch` and assert two things about every
 * call this app's server makes to it: that the caller's credential went upstream and nothing else of theirs did, and
 * that what the assistant is then offered follows the person the gateway named.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }) }));

import { AccessDenied, Unauthenticated, can, collectionFor, may, requireNeed, resolveAccess } from '@/data/access';
import { POST } from '../app/api/assistant/route';
import { collections } from '@/data/collections';
import { FLEET } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import { handedTo } from '@/lib/assistant/scoped';
import { assistantTools } from '@/lib/assistant/tools';
import type { Me, SearchAnswer } from '@/lib/api-shapes';
import { viewAt } from '@/lib/shared-context';
import { platformStatusContext, statusRead } from '@/views/platform-status-context';
import { viewTools } from '@/views/tools';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { startFakeLlm } from '../scripts/fake-llm.ts';
import { search } from '../scripts/fake-gateway/search.ts';
import { activityLog } from '../scripts/fake-gateway/work-activity.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeList } from '../scripts/fake-gateway/work-knowledge.ts';
import { plugins, skills } from '../scripts/fake-gateway/work-plugins.ts';

/** The fetch the model is reached with: the real one, kept before any test replaces it. */
const fetch$ = global.fetch;

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
    const query = new URL(url).searchParams;
    const body = path === '/me' ? me
      : path === '/teams' ? teams(me, query, { limit: Number(query.get('limit') ?? 10), offset: Number(query.get('offset') ?? 0) })![1]
        : path.startsWith('/teams/') ? teamDetail(path.slice('/teams/'.length))
          : path === '/initiatives' ? initiativeList(me, query)[1]
            : path === '/knowledge' ? knowledgeList(me, query)[1]
              : path === '/activity' ? activityLog(me, query)[1]
                : path === '/skills' ? skills(me, query)[1]
                  : path === '/plugins' ? plugins(me)[1]
                    : path === '/people' ? people(me, query, { limit: Number(query.get('limit') ?? 10), offset: Number(query.get('offset') ?? 0) })![1]
                      : path === '/search' ? found(query, shared)
                        : path === '/platform/status' ? (me.superadmin ? PLATFORM_STATUS : MEMBER_STATUS)
                          : path === '/platform/releases' ? releases(Number(query.get('limit') ?? 10), Number(query.get('offset') ?? 0))
                            : path.startsWith('/platform/releases/') ? releaseDetail(decodeURIComponent(path.slice('/platform/releases/'.length)))
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
    await gatewayGet('/activity?limit=10');
    // The search is the caller's own: the gateway refuses it a platform scope, so none is asked for.
    await gatewayGet('/search?q=latency');
    expect(calls.map((c) => c.url)).toEqual([
      'http://gateway.test/api/console/me',
      'http://gateway.test/api/console/teams?scope=platform',
      'http://gateway.test/api/console/activity?limit=10&scope=platform',
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
  it('a member is offered the prepared collections of the pages a member opens, and none of the fleet\'s', async () => {
    gateway(MEMBER);
    const scope = await resolveAccess();
    const offered = [];
    for (const c of collections) if (await can(scope, c.name, 'read')) offered.push(c.name);
    expect(offered).toEqual(PREPARED.filter((r) => r.needs !== FLEET).map((r) => r.name));
    for (const name of ['teams', 'people', 'sign_ins', 'audit', 'runs', 'output', 'calls', 'refusals', 'skill_calls']) expect(offered).not.toContain(name);
    expect(await may(FLEET)).toBe(false);
    await expect(requireNeed(FLEET)).rejects.toBeInstanceOf(AccessDenied);
  });

  it('a member holds platform:read, and it opens none of the fleet', async () => {
    gateway(MEMBER);
    expect(await may('platform:read')).toBe(true);
    // The views the route registers for them: the ones whose need they satisfy (`app/api/assistant/route.ts`).
    const views = [];
    for (const v of viewTools) if (await may(v.needs)) views.push(v.name);
    expect(views).toEqual(['home', 'record', 'initiatives', 'initiative', 'document', 'knowledge', 'knowledge_node', 'knowledge_log', 'search', 'settings', 'platform_status', 'releases', 'release']);
  });

  it('a superadmin is offered every collection', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    for (const c of collections) expect(await can(scope, c.name, 'read')).toBe(true);
  });

  it('a session that changed hands since the scope was resolved is allowed nothing', async () => {
    let who: Me = ME;
    gateway(() => who);
    const scope = await resolveAccess();
    who = MEMBER;
    expect(await can(scope, 'closures', 'read')).toBe(false);
    // The same person under another name is the same scope; acting for another team, or in other teams, is not.
    who = { ...ME, name: 'Ava L.' };
    expect(await can(scope, 'closures', 'read')).toBe(true);
    who = { ...ME, activeTeam: 'beacon' };
    expect(await can(scope, 'closures', 'read')).toBe(false);
    who = { ...ME, teams: [] };
    expect(await can(scope, 'closures', 'read')).toBe(false);
  });

  it('a name that is no collection is refused as one the caller may not use', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    expect(await can(scope, 'secrets', 'read')).toBe(false);
    expect(() => collectionFor(scope, 'secrets')).toThrow(AccessDenied);
  });

  it('no collection gives the assistant a tool that changes anything, or one that lists it', async () => {
    gateway(ME);
    const scope = await resolveAccess();
    const handed = await Promise.all(collections.map((c) => handedTo(scope, collectionFor(scope, c.name), c.name)));
    for (const op of ['create', 'update', 'remove'] as const) expect(await can(scope, 'tokens', op)).toBe(false);
    const writer = { write() {}, merge() {}, onError: undefined } as never;
    const { tools, toolApproval } = assistantTools(handed, writer, { authorize: async () => true, invalidate: () => {} }, viewTools);
    const names = Object.keys(tools);
    expect(names.filter((n) => /^(create|update|remove|query)_/.test(n))).toEqual([]);
    expect(Object.keys(toolApproval)).toEqual([]);
    expect(names.filter((n) => n.startsWith('view_'))).toHaveLength(viewTools.length);
  });
});

describe('what the route hands the model', () => {
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  beforeAll(async () => { llm = await startFakeLlm({ port: 0 }); });
  afterAll(async () => { await llm.close(); });

  /** The tools the model was handed for a question asked on `path`, as `who`. */
  async function handed(who: Me, path: string): Promise<string[]> {
    gateway(who);
    const real = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith(llm.url) ? fetch$(input, init) : real(input, init))) as typeof fetch;
    Object.assign(process.env, { ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm', ASSISTANT_BASE_URL: llm.url });
    llm.requests.length = 0;
    const res = await POST(new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'what stands out?' }] }], page: { path, title: 'Page', text: '' } }) }));
    await res.text();
    return ((llm.requests.at(-1) as { tools?: { function: { name: string } }[] }).tools ?? []).map((t) => t.function.name);
  }

  it('offers no query_<name> tool, and the explore_<view> of the page the person is on and no other', async () => {
    for (const [who, path, view] of [
      [MEMBER, '/initiatives', 'initiatives'], [MEMBER, '/settings', 'settings'], [MEMBER, '/platform', 'platform_status'], [ME, '/platform/teams/atlas', 'team'],
      [MEMBER, '/platform/releases', 'releases'], [MEMBER, '/platform/releases/0.97.0', 'release'],
      [ME, '/runs', 'runs'], [MEMBER, '/knowledge', 'knowledge'], [MEMBER, '/initiatives/atlas/2026-09-28-search-relevance/sources/notes.md', 'document'],
    ] as const) {
      const tools = await handed(who, path);
      expect(tools.filter((t) => t.startsWith('query_')), path).toEqual([]);
      expect(tools.filter((t) => t.startsWith('explore_')), path).toEqual([`explore_${view}`]);
    }
  });

  it('hands a member no prepared query on a page whose view they may not use', async () => {
    const tools = await handed(MEMBER, '/runs');
    expect(tools.filter((t) => t.startsWith('explore_'))).toEqual([]);
    expect(tools).not.toContain('view_runs');
  });
});

describe('a view tool\'s address', () => {
  const tool = (name: string) => viewTools.find((v) => v.name === name)!;

  // The gateway pages Teams and People at 10 rows unless asked, and each reads the page it draws.
  it('asks for the page of teams and the page of people their pages draw', async () => {
    gateway(ME);
    await tool('teams').read({});
    await tool('people').read({});
    expect(calls.map((c) => c.url).filter((u) => /\/(teams|people)\?/.test(u))).toEqual([
      'http://gateway.test/api/console/teams?limit=10&offset=0&scope=platform',
      'http://gateway.test/api/console/people?limit=10&offset=0&scope=platform',
    ]);
  });

  it('asks for the page of releases its page draws, and one release from its own read', async () => {
    gateway(MEMBER);
    const list = await tool('releases').read({});
    const one = await tool('release').read({ version: '0.97.0' });
    expect(calls.map((c) => c.url).filter((u) => u.includes('/platform/releases'))).toEqual([
      'http://gateway.test/api/console/platform/releases?limit=10&offset=0&scope=platform',
      'http://gateway.test/api/console/platform/releases/0.97.0?scope=platform',
    ]);
    expect(list.context.facts.find((f) => f.label === 'Releases')?.value).toBe(String(releases(10, 0).tiles.releases));
    expect(one.data).toEqual(releaseDetail('0.97.0'));
  });

  it('reads one team from its own read, and never looks for it in the list', async () => {
    gateway(ME);
    const own = teamDetail('atlas')!;
    const { context, data } = await tool('team').read({ slug: 'atlas' });
    expect(calls.map((c) => new URL(c.url).pathname)).not.toContain('/api/console/teams');
    // Nor the team's initiatives: Work answers the active team's work alone.
    expect(calls.map((c) => new URL(c.url).pathname)).not.toContain('/api/console/initiatives');
    expect(data).toEqual(own);
    expect(context.facts.find((f) => f.label === 'Lessons adopted')?.value).toBe(String(own.tiles.lessons));
  });

  it('declares the page each view renders, matched as Next.js matches it', () => {
    expect(Object.fromEntries(viewTools.map((v) => [v.name, v.page]))).toEqual({
      home: '/', record: '/record', teams: '/platform/teams', team: '/platform/teams/[slug]', initiatives: '/initiatives', initiative: '/initiatives/[team]/[slug]',
      document: '/initiatives/[team]/[slug]/[...path]', knowledge: '/knowledge', knowledge_node: '/knowledge/[team]/[...path]',
      knowledge_log: '/knowledge/log', search: '/knowledge', people: '/platform/people', plugins: '/plugins', plugin: '/plugins/[plugin]',
      skill: '/plugins/[plugin]/[skill]', runs: '/runs', activity: '/activity', settings: '/settings', platform_status: '/platform',
      releases: '/platform/releases', release: '/platform/releases/[version]',
    });
    // Search shares Knowledge's page and comes after it, so the prepared query Knowledge offers is its own.
    expect(viewAt(viewTools, '/knowledge')?.name).toBe('knowledge');
    expect(viewAt(viewTools, '/knowledge/atlas/nodes/0002-a-title.md')?.name).toBe('knowledge_node');
    expect(viewAt(viewTools, '/initiatives/atlas/s/sources/deep/notes.md')?.name).toBe('document');
  });

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

  it('a member and a superadmin search as the team they act for, and a lesson on the shared shelf opens for both', async () => {
    for (const who of [MEMBER, ME]) {
      gateway(who, { shared: true });
      const { context, data } = await tool('search').read({ q: 'recency', limit: 3 });
      const { results } = data as SearchAnswer;
      // No scope is asked for, so the gateway searches as the team they act for; a lesson on the shared shelf opens on
      // its node page for anybody, read-only, and a document there has no page this console opens.
      expect(calls.map((c) => c.url).find((u) => u.includes('/search'))).toBe('http://gateway.test/api/console/search?q=recency&limit=3');
      expect(context.insights.length).toBeGreaterThan(0);
      context.insights.forEach((i, n) => expect(i.evidence).toBe(results[n].kind === 'node' ? `/knowledge/zz-platform/${results[n].path}` : undefined));
    }
  });
});
