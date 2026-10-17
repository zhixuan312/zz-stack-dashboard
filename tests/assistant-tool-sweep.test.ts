// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every view tool, as the member and as the superadmin, against the fake gateway (Task I-119, AC-7.6).
 *
 * The fixture runs as its own server (`scripts/fake-gateway/server.ts`) and is not changed: the gateway transport's
 * `fetch` is wrapped here, recording each request's method and address, and it is there that a secret is planted in an
 * answer or a failure is made of one. The person is the fixture's, named by the `zz_console` cookie the transport sends.
 *
 * Four things hold of every tool in `viewTools`:
 * - A tool whose page the person may not open is refused with the console's sentence, having read nothing but `/me`.
 * - A tool they may open reads what its page reads: every gateway address the page's server read asks (the
 *   `app/(dash)/**\/read-*.ts` function the page calls, run through the same recording `fetch`), and beside them only
 *   the reads the page makes in the browser, by their path, for the four pages that read there (Activity's log,
 *   Knowledge's list, a document, a search). `/me` is who is asking, read by both, and is not compared.
 * - No planted secret reaches what the tool tells the model. A token value, a token hash, a session id and an
 *   enrolment link are planted twice. Once in the fields of an answer whose shape carries them and is promised never to
 *   hold a value (Access's tokens, browsers and setup text, `src/lib/destination-shapes.ts`), and none may be in a
 *   tool's context, its answer to the model or its data. Once as fields no shape declares, added to every object of
 *   every answer as a careless gateway would add them, and none may be in a tool's context or its answer to the model;
 *   a tool's data is its page's answer, and the console's assistant never hands it to the model.
 * - A tool that throws gives the model one fixed sentence per case (`TOLD`, `src/lib/assistant/tool-errors.ts`),
 *   whatever the gateway said: a refusal, the gateway's 4xx, its 5xx, a fetch that failed and one that timed out. It is
 *   read from the model's own next prompt, through `respond()`, as the SDK hands it on, and the person's panel is sent
 *   the same sentence. The page's prepared query, `explore_<view>`, as the route hands it to each person, is held to the
 *   same sentences when the reads it runs through fail.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }) }));

import type { UIMessage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { respond } from '@/lib/assistant/respond';
import { assistantTools, type HandedExplore } from '@/lib/assistant/tools';
import { can, may, resolveAccess } from '@/data/access';
import { clock, collections } from '@/data/collections';
import { FLEET } from '@/data/features';
import { FLEET_FIELDS } from '@/data/prepared';
import { aggregate, read as readCollection } from '@/data/read';
import { exploreSchema } from '@/lib/explore';
import { dayOf } from '@/lib/format-date';
import type { ViewTool } from '@/lib/shared-context';
import { activityPath, NO_FILTER } from '@/views/activity-context';
import { filtersOf as approvalsFilters } from '@/views/approvals-context';
import { filtersOf as initiativesFilters } from '@/views/initiatives-filter';
import { knowledgePath, searchPath } from '@/views/knowledge-context';
import { filtersOf as peopleFilters } from '@/views/people-filter';
import { filtersOf as auditFilters } from '@/views/platform-audit-context';
import { filtersOf as bugsFilters } from '@/views/platform-bugs-context';
import { filtersOf as releasesFilters } from '@/views/platform-releases-context';
import { filtersOf as recordFilters } from '@/views/record-context';
import { filtersOf as runsFilters } from '@/views/runs-context';
import { filtersOf as teamsFilters } from '@/views/teams-filter';
import { viewTools } from '@/views/tools';
import { readHome } from '../app/(dash)/(home)/read-home';
import { readAccess } from '../app/(dash)/access/read-access';
import { readSummary } from '../app/(dash)/activity/read-summary';
import { readApprovals } from '../app/(dash)/approvals/read-approvals';
import { readInitiative, readInitiatives } from '../app/(dash)/initiatives/read-initiatives';
import { readFirst } from '../app/(dash)/knowledge/read';
import { readAudit } from '../app/(dash)/platform/audit/read-audit';
import { readBug, readBugs, readDuplicates } from '../app/(dash)/platform/bugs/read-bugs';
import { readEvaluation } from '../app/(dash)/platform/evaluation/read-evaluation';
import { readKnowledgeHealth } from '../app/(dash)/platform/knowledge/read-knowledge';
import { readPeople } from '../app/(dash)/platform/people/read-people';
import { readStatus } from '../app/(dash)/platform/read-status';
import { readRelease, readReleases } from '../app/(dash)/platform/releases/read-releases';
import { readTeam, readTeams } from '../app/(dash)/platform/teams/read-teams';
import { readUsage } from '../app/(dash)/platform/usage/read-usage';
import { readPlugin, readPlugins, readSkill } from '../app/(dash)/plugins/read-plugins';
import { readRecord } from '../app/(dash)/record/read-record';
import { readRuns } from '../app/(dash)/runs/read-runs';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { SHELF } from '../scripts/fake-gateway/work-knowledge.ts';
import { startFakeGateway } from './fake-gateway-start';

type Input = Record<string, string>;
type Person = { name: 'member' | 'superadmin'; email: string; team: string };
const PEOPLE: Person[] = [
  { name: 'member', email: MEMBER.email, team: MEMBER.activeTeam! },
  { name: 'superadmin', email: ME.email, team: ME.activeTeam! },
];
/** The tools only the superadmin's pages open: the fleet's. */
const FLEET_ONLY = ['teams', 'team', 'people', 'audit', 'bug'];

/** The record each detail tool opens, one the fixture answers both people with. */
const NODE = SHELF.find((n) => n.team === 'atlas')!;
const INPUTS: Record<string, Input> = {
  audit: { filter: 'administration' }, team: { slug: 'atlas' }, initiative: { team: 'atlas', slug: '2026-09-28-search-relevance' },
  document: { team: 'atlas', slug: '2026-09-28-search-relevance', path: 'spec.md' }, knowledge_node: { team: 'atlas', path: NODE.path },
  search: { q: 'latency' }, plugin: { plugin: 'sdlc' }, skill: { plugin: 'sdlc', skill: 'sdlc-spec' }, release: { version: '0.97.0' },
  bug: { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01' },
};
const inputOf = (name: string): Input => INPUTS[name] ?? {};

/**
 * What each tool's page reads for the same address: `server`, the page's server read, called as the page calls it with
 * the address's parameters (none, for a list at its first page); `browser`, the gateway paths the page reads in the
 * browser beside it, made by the page's own path functions. A document and a search have no server read at all.
 */
type PageRead = { server?: (i: Input) => Promise<unknown>; browser?: (i: Input) => string[] };
const PAGES: Record<string, PageRead> = {
  home: { server: () => readHome() },
  record: { server: () => readRecord(recordFilters({})) },
  teams: { server: () => readTeams(teamsFilters({})) },
  team: { server: (i) => readTeam(i.slug) },
  initiatives: { server: () => readInitiatives(initiativesFilters({})) },
  initiative: { server: (i) => readInitiative(i.team, i.slug) },
  // As `DocumentView` asks it (src/views/pages/document.tsx).
  document: { browser: (i) => [`/document/${i.team}/${i.slug}/${i.path}`] },
  approvals: { server: () => readApprovals(approvalsFilters({})) },
  knowledge: { server: () => readFirst('/knowledge/summary'), browser: () => [knowledgePath({ kind: 'all' })] },
  // As the node's page names it (app/(dash)/knowledge/[team]/[...path]/page.tsx).
  knowledge_node: { server: (i) => readFirst(`/knowledge/${i.team}/${i.path}`) },
  knowledge_log: { server: () => readFirst('/knowledge/log') },
  search: { browser: (i) => [searchPath(i.q)] },
  people: { server: () => readPeople(peopleFilters({})) },
  plugins: { server: () => readPlugins() },
  plugin: { server: (i) => readPlugin(i.plugin) },
  skill: { server: (i) => readSkill(i.plugin, i.skill) },
  runs: { server: () => readRuns(runsFilters({})) },
  activity: { server: () => readSummary(), browser: () => [activityPath(NO_FILTER)] },
  access: { server: () => readAccess() },
  platform_status: { server: () => readStatus() },
  releases: { server: () => readReleases(releasesFilters({})) },
  release: { server: (i) => readRelease(i.version) },
  bugs: { server: () => readBugs(bugsFilters({})) },
  bug: { server: (i) => Promise.all([readBug(i.id), readDuplicates(i.id)]) },
  evaluation: { server: () => readEvaluation() },
  usage: { server: () => readUsage() },
  knowledge_health: { server: () => readKnowledgeHealth() },
  audit: { server: () => readAudit(auditFilters({})) },
};

/** Values the platform never answers, planted where a shape carries their kind of field. */
const DECLARED = { token: 'zz_pat_DECLARED0123456789abcdef', hash: 'sha256:d3c1a7ed0f1e2d3c4b5a69788796a5b4', session: 'cs_DECLAREDsession0123456789', link: 'https://console.example.com/enrol#t=zze_DECLAREDLINK0123' };
/** The same four kinds, planted as fields no shape declares on every object of every answer. */
const UNDECLARED = { token: 'zz_pat_UNDECLARED0123456789abcd', hash: 'sha256:0bad0bad0f1e2d3c4b5a69788796a5b4', session: 'cs_UNDECLAREDsession012345678', link: 'https://console.example.com/enrol#t=zze_UNDECLAREDLINK01' };
const ALL_SECRETS = [...Object.values(DECLARED), ...Object.values(UNDECLARED)];

type Row = Record<string, unknown>;
/** Access's carriers, filled with `DECLARED`: each token's id, each browser's id and user agent, and the setup text. */
function plantDeclared(path: string, body: unknown): unknown {
  if (path !== '/api/console/access') return body;
  const a = body as { issued: Row[]; browsers: Row[]; setup: Row };
  return {
    ...a,
    issued: a.issued.map((t) => ({ ...t, id: DECLARED.hash })),
    browsers: a.browsers.map((b) => ({ ...b, id: DECLARED.session, userAgent: `${String(b.userAgent ?? '')} ${DECLARED.token}` })),
    setup: { ...a.setup, config: `${String(a.setup.config)}\n${DECLARED.link}\nexport ZZ_TOKEN=${DECLARED.token}` },
  };
}
/**
 * `UNDECLARED` as four more fields on the answer and on every row of every list in it, nested ones included. A nested
 * object that is not a row is left its keys, because some are maps whose every key is a name the page lists (a count
 * by kind), and a planted key there would be a kind, not a careless field.
 */
function plantUndeclared(body: unknown, row = true): unknown {
  if (Array.isArray(body)) return body.map((v) => plantUndeclared(v, true));
  if (body === null || typeof body !== 'object') return body;
  const own = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, plantUndeclared(v, false)]));
  return row ? { ...own, token: UNDECLARED.token, tokenHash: UNDECLARED.hash, sessionId: UNDECLARED.session, enrolmentLink: UNDECLARED.link } : own;
}

/**
 * How the wrapped transport answers a read other than `/me`, which always reaches the fixture as it is: as the fixture
 * answers it; with secrets planted in the fixture's answer; with the status given and a body naming everything a
 * failure must not repeat; or by rejecting, as a fetch that could not connect or gave up waiting does.
 */
type Mode = { as: 'fixture' } | { as: 'planted' } | { as: 'status'; status: number } | { as: 'rejected'; error: () => unknown };
let mode: Mode = { as: 'fixture' };
let calls: { method: string; url: string }[] = [];
let base = '';
let fixture: Awaited<ReturnType<typeof startFakeGateway>> | undefined;
const fetch$ = global.fetch;
/** What a failing gateway says, with the path asked, the person, their team and its own address in it. */
const failureBody = (path: string, who: Person, status: number) => ({ error: `${path} refused for ${who.email} acting for ${who.team}: HTTP ${status}, connection to 10.0.0.12:5432 refused` });
let asking: Person = PEOPLE[0];

beforeAll(async () => {
  fixture = await startFakeGateway();
  base = fixture.base;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url });
    const path = new URL(url).pathname;
    if (path !== '/api/console/me') {
      if (mode.as === 'status') return new Response(JSON.stringify(failureBody(path, asking, mode.status)), { status: mode.status, headers: { 'content-type': 'application/json' } });
      if (mode.as === 'rejected') throw mode.error();
    }
    const res = await fetch$(input, init);
    if (mode.as !== 'planted' || path === '/api/console/me' || !res.ok) return res;
    const body = plantUndeclared(plantDeclared(path, await res.json()));
    return new Response(JSON.stringify(body), { status: res.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
});
afterAll(() => {
  global.fetch = fetch$;
  fixture?.proc.kill();
});

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, { ZZ_GATEWAY: base, NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
  mode = { as: 'fixture' };
  calls = [];
});
afterEach(() => { process.env = { ...saved }; });

/** Sign `who` in as the fixture knows them, and start a fresh record of what is read. */
function as(who: Person) {
  jar.zz_console = who.name;
  asking = who;
  calls = [];
}
const opens = (who: Person, name: string) => who.name === 'superadmin' || !FLEET_ONLY.includes(name);

/** The tools as the route builds them for the assistant: every view's, no collection's, no page's prepared query. */
const writer = { write() {}, merge() {}, onError: undefined } as never;
const guard = { authorize: async () => true, invalidate: () => {} };
const built = () => assistantTools([], writer, guard, viewTools);
/** What `view_<name>` hands the model for `input`, or what it threw. */
async function execute(name: string, input: Input): Promise<{ output?: unknown; error?: unknown }> {
  const t = built().tools[`view_${name}`];
  try {
    return { output: await t.execute!(input, { toolCallId: `c_${name}`, messages: [] } as never) };
  } catch (error) {
    return { error };
  }
}
/** The gateway reads recorded since `as`, by address, `/me` left out. */
const reads = () => calls.filter((c) => new URL(c.url).pathname !== '/api/console/me');
const addressOf = (url: string) => { const u = new URL(url); return u.pathname.replace(/^\/api\/console/, '') + u.search; };
const pathOf = (address: string) => address.split('?')[0];

describe('the registry the sweep covers', () => {
  it('names a page read and an input for every view tool, and no tool the registry lacks', () => {
    expect(Object.keys(PAGES).sort()).toEqual(viewTools.map((v) => v.name).sort());
    for (const name of Object.keys(INPUTS)) expect(viewTools.map((v) => v.name)).toContain(name);
    for (const v of viewTools) expect(v.input.safeParse(inputOf(v.name)).success, v.name).toBe(true);
  });

  it('builds a read-only view tool for every view and nothing that writes', () => {
    const { tools, toolApproval } = built();
    expect(Object.keys(tools).sort()).toEqual(viewTools.map((v) => `view_${v.name}`).sort());
    expect(Object.keys(toolApproval)).toEqual([]);
  });
});

describe.each(PEOPLE)('every view tool, as the $name', (who) => {
  it('refuses a tool whose page they may not open with the console\'s sentence, having read nothing but /me', async () => {
    const refused = viewTools.filter((v) => !opens(who, v.name));
    expect(refused.map((v) => v.name)).toEqual(who.name === 'member' ? ['teams', 'team', 'people', 'bug', 'audit'] : []);
    for (const v of refused) {
      as(who);
      const { output, error } = await execute(v.name, inputOf(v.name));
      expect(output, `view_${v.name} as the ${who.name}`).toBeUndefined();
      expect((error as Error).message, `view_${v.name} as the ${who.name}`).toBe('You do not have access to that.');
      expect(calls.length, `view_${v.name} as the ${who.name}`).toBeGreaterThan(0);
      expect(calls.map((c) => new URL(c.url).pathname), `view_${v.name} as the ${who.name} read before it refused`).toEqual(calls.map(() => '/api/console/me'));
    }
  });

  it('reads, with GET alone, what the tool\'s page reads for the same address', async () => {
    for (const v of viewTools.filter((t) => opens(who, t.name))) {
      const where = `view_${v.name} as the ${who.name}`;
      const page = PAGES[v.name];
      as(who);
      if (page.server) await page.server(inputOf(v.name));
      const server = reads().map((c) => addressOf(c.url));
      const browser = (page.browser?.(inputOf(v.name)) ?? []).map(pathOf);
      as(who);
      const { output, error } = await execute(v.name, inputOf(v.name));
      expect(error, where).toBeUndefined();
      expect(output, where).toBeDefined();
      const tool = reads();
      expect(tool.filter((c) => c.method !== 'GET'), `${where} wrote`).toEqual([]);
      const asked = tool.map((c) => addressOf(c.url));
      for (const s of server) expect(asked, `${where} did not read its page's ${s}`).toContain(s);
      for (const b of browser) expect(asked.map(pathOf), `${where} did not read its page's ${b}`).toContain(b);
      expect(asked.filter((a) => !server.includes(a) && !browser.includes(pathOf(a))), `${where} read another path than its page`).toEqual([]);
    }
  });

  it('holds no planted token, hash, session id or enrolment link in what it tells the model', async () => {
    for (const v of viewTools.filter((t) => opens(who, t.name))) {
      const where = `view_${v.name} as the ${who.name}`;
      as(who);
      mode = { as: 'planted' };
      const { output, error } = await execute(v.name, inputOf(v.name));
      expect(error, where).toBeUndefined();
      const read = await v.read(v.input.parse(inputOf(v.name)) as never);
      const said = [JSON.stringify(output), JSON.stringify(read.context)];
      for (const s of ALL_SECRETS) for (const t of said) expect(t.includes(s), `${where} passed ${s} to the model`).toBe(false);
      for (const s of Object.values(DECLARED)) expect(JSON.stringify(read.data).includes(s), `${where} kept ${s} in its data`).toBe(false);
    }
  });

  it('plants what it says it plants: Access, as the tools read it, carries all eight values', async () => {
    as(who);
    mode = { as: 'planted' };
    // The sweep above passes on answers that hold every secret, not on answers the planting missed.
    const res = await global.fetch(`${base}/api/console/access`, { headers: { cookie: `zz_console=${who.name}` } });
    const body = JSON.stringify(await res.json());
    for (const s of [...Object.values(DECLARED), ...Object.values(UNDECLARED)]) expect(body).toContain(s);
  });
});

/** The sentences the model is told, word for word; `refused` is the console's own refusal (`AccessDenied`). */
const TOLD = {
  refused: 'You do not have access to that.',
  rejected: 'The platform did not accept that read: nothing is at that address, or the read does not take those arguments. Check them against the tool\'s description.',
  failed: 'The platform could not answer that read just now. Tell the person it is unavailable, and do not guess what it would have said.',
  timeout: 'The platform did not answer that read in time. Try once more, or tell the person it is slow.',
};

/** Each way a read fails, and the sentence the model is told for it. */
const FAILURES: { what: string; mode: Mode; told: string }[] = [
  { what: 'a 400', mode: { as: 'status', status: 400 }, told: TOLD.rejected },
  { what: 'a 404', mode: { as: 'status', status: 404 }, told: TOLD.rejected },
  { what: 'a 401', mode: { as: 'status', status: 401 }, told: TOLD.refused },
  { what: 'a 403', mode: { as: 'status', status: 403 }, told: TOLD.refused },
  { what: 'a 500', mode: { as: 'status', status: 500 }, told: TOLD.failed },
  { what: 'a 503', mode: { as: 'status', status: 503 }, told: TOLD.failed },
  { what: 'a refused connection', mode: { as: 'rejected', error: () => new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED 10.0.0.12:443'), { code: 'ECONNREFUSED' }) }) }, told: TOLD.failed },
  { what: 'a signal\'s timeout', mode: { as: 'rejected', error: () => new DOMException('The operation was aborted due to timeout', 'TimeoutError') }, told: TOLD.timeout },
  { what: 'undici\'s headers timeout', mode: { as: 'rejected', error: () => new TypeError('fetch failed', { cause: Object.assign(new Error('Headers Timeout Error'), { code: 'UND_ERR_HEADERS_TIMEOUT' }) }) }, told: TOLD.timeout },
];

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
const stream = (parts: unknown[]) => ({ stream: new ReadableStream({ start(c) { for (const p of parts) c.enqueue(p as never); c.close(); } }) });
const ask: UIMessage[] = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'what does it show?' }] }];
type Prompt = { role: string; content: unknown }[];

/**
 * One call of `toolName` with `input`, through `respond()`: what the model reads back, the tool's result in the prompt
 * of its next step, and what the person's panel is sent for it, the errorText of a failed tool.
 */
async function afterCall(toolName: string, input: Record<string, unknown>, handed: { views?: ViewTool[]; explore?: HandedExplore; path: string }): Promise<{ told: unknown; panel: string | undefined }> {
  const prompts: Prompt[] = [];
  const model = new MockLanguageModelV4({
    doStream: async (options: { prompt: Prompt }) => {
      prompts.push(options.prompt);
      return prompts.length === 1
        ? stream([{ type: 'tool-call', toolCallId: 'c1', toolName, input: JSON.stringify(input) }, { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage }])
        : stream([{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'ok' }, { type: 'text-end', id: 't' }, { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage }]);
    },
  } as never);
  const res = await respond({ model, secret: 's'.repeat(43), messages: ask, page: { path: handed.path, title: 'Page', text: '' }, collections: [], views: handed.views ?? [], explore: handed.explore, guard, now: new Date('2026-10-18T09:00:00Z') });
  const events = (await res.text()).split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)) as { type: string; errorText?: string });
  const results = (prompts[1] ?? []).flatMap((m) => (m.role === 'tool' ? (m.content as { type: string; output: unknown }[]) : [])).filter((p) => p.type === 'tool-result');
  expect(results).toHaveLength(1);
  return { told: results[0].output, panel: events.find((e) => e.type === 'tool-output-error')?.errorText };
}
const viewCall = (v: ViewTool, input: Input) => afterCall(`view_${v.name}`, input, { views: [v], path: v.page });

describe.each(PEOPLE)('a tool that throws, as the $name', (who) => {
  it('gives the model the console\'s refusal for a page they may not open, and nothing it read', async () => {
    for (const v of viewTools.filter((t) => !opens(who, t.name))) {
      as(who);
      expect((await viewCall(v, inputOf(v.name))).told, `view_${v.name}`).toEqual({ type: 'error-text', value: TOLD.refused });
    }
  });

  it.each(FAILURES)('gives the model and the panel one fixed sentence for $what, naming no path, body, person or team', async ({ mode: failing, told }) => {
    for (const v of viewTools.filter((t) => opens(who, t.name))) {
      const where = `view_${v.name} as the ${who.name}`;
      as(who);
      mode = failing;
      const { error } = await execute(v.name, inputOf(v.name));
      // The SDK tells the model `String(error)`: the sentence, with no class name before it.
      expect((error as Error).message, where).toBe(told);
      expect(String(error), where).toBe(told);
      as(who);
      const after = await viewCall(v, inputOf(v.name));
      expect(after.told, where).toEqual({ type: 'error-text', value: told });
      // The person's panel is sent the same sentence, not the provider's "could not reach" (`plainError`).
      expect(after.panel, where).toBe(told);
      const text = JSON.stringify(after.told);
      for (const leak of [who.email, who.team, '10.0.0.12', 'HTTP', 'refused for', '/api/console', ...Object.values(inputOf(v.name))]) {
        expect(text.includes(leak), `${where} told the model ${leak}`).toBe(false);
      }
    }
  });
});

describe('a tool that throws, on the server', () => {
  it('is logged once with what the gateway said, and the panel is sent only the sentence', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      as(PEOPLE[1]);
      mode = { as: 'status', status: 503 };
      const after = await viewCall(viewTools.find((v) => v.name === 'platform_status')!, {});
      expect(after.panel).toBe(TOLD.failed);
      const told = logged.mock.calls.filter((c) => c[0] === 'assistant: a tool failed');
      expect(told).toHaveLength(1);
      expect(told[0][1]).toMatchObject({ name: 'GatewayError', status: 503 });
      expect(logged.mock.calls.filter((c) => c[0] === 'assistant: model call failed')).toEqual([]);
    } finally {
      logged.mockRestore();
    }
  });
});

/**
 * The page's prepared query, `explore_<view>`, as the route hands it to `who` (`app/api/assistant/route.ts`): the
 * collections they may read, the fields only a superadmin may name withheld from anyone else, and the reads that ask
 * the grant again. Undefined where the page's query reads nothing they may read, as the route hands none there.
 */
async function handedExplore(v: ViewTool, input: Input): Promise<HandedExplore | undefined> {
  const scope = await resolveAccess();
  const names = new Set((await Promise.all(collections.map(async (c) => ((await can(scope, c.name, 'read')) ? c.name : null)))).filter((n): n is string => n !== null));
  if (!Object.values(v.explore.sources).some((src) => names.has(src.collection))) return undefined;
  const wide = await may(FLEET);
  const page = v.page.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, k: string) => input[k]);
  return { view: v, rights: { readable: names, hidden: (name) => (wide ? [] : FLEET_FIELDS[name] ?? []) }, io: { aggregate, read: readCollection, today: dayOf(clock()) }, page };
}
/** The smallest call the person's own schema offers: the page's record, its first source and that source's first measure. */
function smallestCall(handed: HandedExplore, input: Input): Record<string, unknown> {
  const own = handed.view.page.includes('[') ? handed.view.input : undefined;
  const shape = exploreSchema(handed.view.explore, handed.rights, own).shape as unknown as { source: { options: string[] }; measures: { element: { options: string[] } } };
  const source = shape.source.options[0];
  const measure = Object.keys(handed.view.explore.sources[source].measures).find((m) => shape.measures.element.options.includes(m))!;
  return { ...(own ? input : {}), source, measures: [measure] };
}

describe.each(PEOPLE)('a prepared query that throws, as the $name', (who) => {
  it.each(FAILURES)('gives the model and the panel one fixed sentence for $what', async ({ mode: failing, told }) => {
    let asked = 0;
    for (const v of viewTools.filter((t) => opens(who, t.name))) {
      const where = `explore_${v.name} as the ${who.name}`;
      as(who);
      const handed = await handedExplore(v, inputOf(v.name));
      if (!handed) continue;
      const call = smallestCall(handed, inputOf(v.name));
      const t = assistantTools([], writer, guard, [], handed).tools[`explore_${v.name}`];
      mode = failing;
      const error = await Promise.resolve(t.execute!(call, { toolCallId: 'e1', messages: [] } as never)).then(() => undefined, (e: unknown) => e);
      expect(String(error), where).toBe(told);
      const after = await afterCall(`explore_${v.name}`, call, { explore: handed, path: handed.page });
      expect(after.told, where).toEqual({ type: 'error-text', value: told });
      expect(after.panel, where).toBe(told);
      mode = { as: 'fixture' };
      asked++;
    }
    // Every page the person opens hands them its prepared query, so every one was asked.
    expect(asked).toBe(viewTools.filter((t) => opens(who, t.name)).length);
  });
});

describe('the fixed sentences', () => {
  it('are four, and none names a path, a status, a person or a team', () => {
    const sentences = Object.values(TOLD);
    expect(new Set(sentences).size).toBe(4);
    for (const s of sentences) expect(s).not.toMatch(/\/|\d{3}|@|atlas|beacon/);
  });
});
