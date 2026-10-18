// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Asked for a change, the assistant names the page where the person makes it (Task I-120, AC-7.7).
 *
 * Three things hold it. The system prompt ZZ Meridian's `prompt.ts` and `agent-guidance.ts` build says the assistant
 * changes nothing itself, that a change exists only as a Proposal a write tool returns, and how to answer a change
 * another page makes. Every context of a page with a change says, in one line, what the person changes there. And the
 * assistant cannot write: no collection hands it a write tool, and the one transport its view tools reach the gateway
 * through sends a GET and nothing else. What a configured model answers is read in the transcripts `scripts/ask.ts`
 * writes under `out/asks/`, not here.
 */
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

import { MockLanguageModelV4 } from 'ai/test';
import type { Me } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import type { People, Teams } from '@/lib/fleet-shapes';
import type { Approvals, InitiativeList } from '@/lib/work-shapes';
import { collections } from '@/data/collections';
import { gatewayGet } from '@/data/gateway';
import { AGENT_GUIDANCE } from '@/lib/agent-guidance';
import { systemPrompt } from '@/lib/assistant/prompt';
import { respond } from '@/lib/assistant/respond';
import { assistantTools } from '@/lib/assistant/tools';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { accessContext } from '@/views/access-context';
import { APPROVAL_IS_THE_PERSON_S, approvalsContext } from '@/views/approvals-context';
import { documentContext } from '@/views/document-context';
import { initiativeContext } from '@/views/initiative-context';
import { CLOSE_IS_THE_PERSON_S, initiativesContext } from '@/views/initiatives-context';
import { PEOPLE_CHANGES, peopleContext } from '@/views/people-context';
import { bugContext } from '@/views/platform-bugs-context';
import { teamChanges, teamContext } from '@/views/team-context';
import { TEAMS_CHANGES, teamsContext } from '@/views/teams-context';
import { viewTools } from '@/views/tools';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { startFakeLlm } from '../scripts/fake-llm.ts';
import { POST } from '../app/api/assistant/route';
import { bugReport, duplicates } from '../scripts/fake-gateway/platform-bugs.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { documentDetail, initiativeDetail } from '../scripts/fake-gateway/work.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const NOW = new Date('2026-10-18T09:00:00Z');
const OPEN_REPORT = '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01';
const USAGE = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };

describe('the system prompt', () => {
  const prompt = systemPrompt({ path: '/access', title: 'Access', text: '' }, NOW, '', [], { addresses: [{ label: 'Access', address: '/access' }] });

  it('says the assistant changes nothing itself, and that a change exists only as the Proposal a write tool returns', () => {
    expect(prompt).toContain('you change nothing yourself');
    expect(prompt).toContain('A change exists only as the Proposal a write tool returns');
    expect(prompt).toContain('Never write that a change is proposed or awaiting approval unless a tool returned one');
    // The managed guidance is where those words come from, and the prompt carries all of it.
    for (const line of AGENT_GUIDANCE) expect(prompt).toContain(line);
  });

  it('asked for a change another page makes, names that page when the person may open it, or says it is not theirs to make', () => {
    expect(prompt).toContain('Asked for a change another page makes, give that page\'s address when it is one this person may open');
    expect(prompt).toContain('A page they may not open is never where they can make a change: say it is not a change they can make');
    expect(prompt).toContain('Give only these addresses and name no other');
  });
});

describe('the prompt\'s limits, said over every collection the person may read', () => {
  /** The system prompt `respond()` hands the model for a question on `/access`, every collection readable. */
  async function system(): Promise<string> {
    let told = '';
    const model = new MockLanguageModelV4({
      doStream: async ({ prompt }) => {
        told = prompt.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
        return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: USAGE } as never); c.close(); } }) };
      },
    });
    const res = await respond({
      model, secret: 's'.repeat(43), now: NOW, page: { path: '/access', title: 'Access', text: '' },
      messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Revoke my laptop token for me.' }] }],
      collections: [], readable: collections, guard: { authorize: async () => false, invalidate: () => {} },
    });
    await res.text();
    return told;
  }

  // Each change a page makes with a control of its own, told as the page's: a model told "nobody can remove your tokens
  // here" answered that revoking one was not a change the person could make, on the page that revokes it.
  const PAGE_CHANGES = [
    ['Your tokens', 'create and remove'], ['Teams', 'create and remove'], ['People', 'create and remove'],
    ['Closures', 'create'], ['Bugs resolved', 'create'], ['Approvals', 'create'],
  ] as const;

  it('says a change a page makes is made there, by the person, and never that nobody can make it', async () => {
    const told = await system();
    for (const [label, ops] of PAGE_CHANGES) {
      expect(told).toContain(`- ${label}: ${ops} only on its page, by the person; you cannot propose it.`);
      for (const op of ops.split(' and ')) expect(told).not.toMatch(new RegExp(`- ${label}: nobody can [a-z ]*\\b${op}\\b`));
    }
  });

  it('still builds no write tool for any of them', () => {
    for (const [label] of PAGE_CHANGES) {
      const c = collections.find((x) => x.label === label)!;
      for (const op of ['create', 'update', 'remove'] as const) expect(c[op], `${label}.${op}`).toBeUndefined();
    }
  });
});

describe('a change only some readers make, as the route tells each of them', () => {
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  const real = global.fetch;
  beforeAll(async () => { llm = await startFakeLlm({ port: 0 }); });
  afterAll(async () => { await llm.close(); });
  afterEach(() => { global.fetch = real; vi.unstubAllEnvs(); });

  /** The system prompt the route hands the model for a question on Bugs, the gateway answering `who` is asking. */
  async function told(who: Me): Promise<string> {
    vi.stubEnv('ZZ_GATEWAY', 'http://gateway.test');
    vi.stubEnv('ASSISTANT_PROVIDER', 'openai-compatible');
    vi.stubEnv('ASSISTANT_API_KEY', 'k');
    vi.stubEnv('ASSISTANT_MODEL', 'm');
    vi.stubEnv('ASSISTANT_BASE_URL', llm.url);
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(llm.url)) return real(input, init);
      if (new URL(String(input)).pathname === '/api/console/me') return new Response(JSON.stringify(who), { status: 200 });
      return new Response(JSON.stringify({ error: 'not in this test' }), { status: 404 });
    }) as typeof fetch;
    llm.requests.length = 0;
    const res = await POST(new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Resolve the newest open report for me.' }] }], page: { path: '/platform/bugs', title: 'Bugs', text: '' } }) }));
    await res.text();
    const sent = llm.requests.at(-1) as { messages: { role: string; content: string }[] };
    return sent.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  }

  it('tells a superadmin a report is resolved on its page, and a member that nobody can resolve one here', async () => {
    expect(await told(ME)).toContain('- Bugs resolved: create only on its page, by the person; you cannot propose it.');
    const member = await told(MEMBER);
    expect(member).not.toMatch(/- Bugs resolved: [a-z ]* only on its page/);
    expect(member).toMatch(/- Bugs resolved: nobody can create\b/);
  });
});

describe('every context of a page with a change says what the person changes there', () => {
  const teamsPage = teams(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as Teams;
  const peoplePage = people(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as People;
  const atlas = teamDetail('atlas')!;
  const said = (c: SharedContext) => contextText(c);

  it('Access: every change is the person\'s, made on the page', () => {
    const text = said(accessContext(access(ME)[1] as Access, arrival));
    expect(text).toContain('Every change here is the person\'s, made on this page');
    expect(text).toContain('The assistant does none of them');
  });

  it('Approvals: a person approves with Approve on the document\'s own page', () => {
    const text = said(approvalsContext(approvals(ME, new URLSearchParams('tab=waiting'))[1] as Approvals, { tab: 'waiting', page: 1, ...arrival }));
    expect(text).toContain(APPROVAL_IS_THE_PERSON_S);
  });

  it('Initiatives and an initiative: a person closes one with Close initiative, in the dialog', () => {
    const list = initiativeList(ME, new URLSearchParams())[1] as InitiativeList;
    expect(said(initiativesContext(list, { filters: { q: '', state: 'all', flow: 'all' }, page: 1, ...arrival }))).toContain(CLOSE_IS_THE_PERSON_S);
    expect(said(initiativeContext(initiativeDetail('atlas', '2026-09-28-search-relevance')!, arrival))).toContain(CLOSE_IS_THE_PERSON_S);
  });

  it('a document awaiting approval: approval is given on its page, and an agent cannot give it', () => {
    const text = said(documentContext(documentDetail('atlas', '2026-09-28-search-relevance', 'plan.md')!, arrival));
    expect(text).toContain('Approval is given on this page');
    expect(text).toContain('An agent cannot approve it');
  });

  it('a bug report: a person closes it on its page, never the assistant', () => {
    expect(said(bugContext(bugReport(OPEN_REPORT)!, duplicates(OPEN_REPORT), arrival))).toContain('A report is closed on its page by a person, never by the assistant');
  });

  it('Teams: Create a team on /platform/teams, and Archive, Add member and Remove on a team\'s own page', () => {
    expect(said(teamsContext(teamsPage, { filters: { q: '', status: 'all', page: '1' }, ...arrival }))).toContain(TEAMS_CHANGES);
    for (const words of ['/platform/teams', 'Create a team', '/platform/teams/<slug>', 'Archive', 'Add member', 'Remove', 'The assistant']) expect(TEAMS_CHANGES).toContain(words);
  });

  it('a team: Archive while it is active, Add member and Remove, on its own address', () => {
    const line = teamChanges('atlas', 'active');
    expect(said(teamContext('atlas', { team: atlas, ...arrival }))).toContain(line);
    for (const words of ['/platform/teams/atlas', 'Archive', 'Add member', 'Remove', 'The assistant']) expect(line).toContain(words);
    // An archived team has no Archive: the page says creating its slug again restores it, on Teams.
    const archived = teamChanges('cinder', 'archived');
    expect(said(teamContext('cinder', { team: teamDetail('cinder')!, ...arrival }))).toContain(archived);
    expect(archived).not.toMatch(/\bArchive\b/);
    for (const words of ['/platform/teams/cinder', 'Create a team', '/platform/teams', 'Add member', 'Remove']) expect(archived).toContain(words);
  });

  it('People: Add a person, Enrolment link and Deactivate, on /platform/people, and still no address of anybody\'s', () => {
    const text = said(peopleContext(peoplePage, { filters: { q: '', state: 'all', page: '1' }, ...arrival }));
    expect(text).toContain(PEOPLE_CHANGES);
    for (const words of ['/platform/people', 'Add a person', 'Enrolment link', 'Deactivate', 'The assistant']) expect(PEOPLE_CHANGES).toContain(words);
    expect(PEOPLE_CHANGES).not.toMatch(/@|enrol#|https?:/);
  });
});

describe('the assistant makes no write', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('no collection declares a change, so no write tool is built and nothing waits on an approval', () => {
    for (const c of collections) for (const op of ['create', 'update', 'remove'] as const) expect(c[op], `${c.name}.${op}`).toBeUndefined();
    const writer = { write() {}, merge() {}, onError: undefined } as never;
    const { tools, toolApproval } = assistantTools(collections, writer, { authorize: async () => true, invalidate: () => {} }, viewTools);
    const names = Object.keys(tools);
    expect(names.filter((n) => !/^view_/.test(n))).toEqual([]);
    expect(names).toHaveLength(viewTools.length);
    expect(toolApproval).toEqual({});
  });

  it('every view tool reaches the gateway through gatewayGet alone, which sends a GET with no body', async () => {
    const dir = path.join(ROOT, 'src/views/tools');
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/\bfetch\s*\(|useConsoleMutation|@\/lib\/api['"]/);
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/data\/gateway'/g)) {
        expect(m[1].split(',').map((s) => s.trim()).filter(Boolean).every((s) => s === 'gatewayGet' || s === 'GatewayError'), f).toBe(true);
      }
    }
    // The transport itself: one fetch, no method named, no body.
    const transport = fs.readFileSync(path.join(ROOT, 'src/data/gateway.ts'), 'utf8');
    expect(transport.match(/\bfetch\s*\(/g)).toHaveLength(1);
    expect(transport).not.toMatch(/\bmethod\s*:|\bbody\s*:/);
    vi.stubEnv('ZZ_GATEWAY', 'http://gateway.test');
    const sent: (RequestInit | undefined)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => { sent.push(init); return new Response('{}', { status: 200 }); }));
    await gatewayGet('/teams');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method ?? 'GET').toBe('GET');
    expect(sent[0]?.body).toBeUndefined();
  });
});
