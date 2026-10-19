import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { Component, createElement as h, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A page read on the console's server hands its `useLive` the revisions that read was answered at, so the tab's first
 * stream asks whether anything moved since instead of reading every collection again (ZZ Meridian 0.18.0's `since`).
 *
 * Each case runs the page's own server read against a gateway that answers every read with `x-zz-revision`, then draws
 * the page's view with what the read returned, and records what the view hands `useLive`. The view is stopped at that
 * call: the bodies here are empty, and what the view draws from them is every other test's business.
 */
const live = vi.hoisted(() => ({ calls: [] as { names: string[]; since: unknown }[], stop: true, scopeKeys: [] as string[] }));
const STOP = new Error('stopped at useLive');
vi.mock('@/lib/live', () => ({
  useLive: (names: string[], since?: unknown) => {
    live.calls.push({ names, since });
    if (live.stop) throw STOP;
    return 'live';
  },
  LiveProvider: ({ scopeKey, children }: { scopeKey: string; children: ReactNode }) => { live.scopeKeys.push(scopeKey); return children; },
}));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  chromeAccess: async () => ({ only: ['/'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava@example.com' }),
}));

import type { KnowledgeBody, KnowledgeLogEntry } from '@/lib/api-shapes';
import type { KnowledgeSummary } from '@/lib/destination-shapes';
import { ConsoleLive } from '@/views/console-live';
import { AccessView } from '@/views/pages/access';
import { ActivityView } from '@/views/pages/activity';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { InitiativeView } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformTeamView } from '@/views/pages/platform-team';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { RunsView } from '@/views/pages/runs';
import { SkillView } from '@/views/pages/skill';
import { filtersOf as approvalsFilters } from '@/views/approvals-context';
import { readDocument } from '@/views/document-read';
import { filtersOf as initiativesFilters } from '@/views/initiatives-filter';
import { filtersOf as peopleFilters } from '@/views/people-filter';
import { filtersOf as runsFilters } from '@/views/runs-context';
import { filtersOf as teamsFilters } from '@/views/teams-filter';
import { readAccess } from '../app/(dash)/access/read-access';
import { readSummary } from '../app/(dash)/activity/read-summary';
import { readApprovals } from '../app/(dash)/approvals/read-approvals';
import { readInitiative, readInitiatives } from '../app/(dash)/initiatives/read-initiatives';
import { readFirst } from '../app/(dash)/knowledge/read';
import { readPeople } from '../app/(dash)/platform/people/read-people';
import { readTeam, readTeams } from '../app/(dash)/platform/teams/read-teams';
import { readPlugin, readPlugins, readSkill } from '../app/(dash)/plugins/read-plugins';
import { readRuns } from '../app/(dash)/runs/read-runs';

const BOOT = 'b00t';

/** The collection a read is kept under, as the gateway names it in the header. */
const collectionOf = (path: string) => {
  const head = path.split('?')[0]!.split('/').filter(Boolean)[0]!;
  return ({ approvals: 'initiatives', access: 'settings' } as Record<string, string>)[head] ?? head;
};

/** How the gateway answers a read, by its path past `/api/console`: a status and the count in its revision, or none. */
let answer: (path: string) => { status: number; n: number | null };
let asked: string[] = [];

beforeEach(() => {
  live.calls = [];
  live.stop = true;
  live.scopeKeys = [];
  asked = [];
  answer = () => ({ status: 200, n: 7 });
  process.env.ZZ_GATEWAY = 'http://gateway.test';
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const path = url.pathname.replace('/api/console', '') + url.search.replace(/[?&]scope=platform$/, '');
    asked.push(path);
    const { status, n } = answer(path);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (n !== null) headers['x-zz-revision'] = `${collectionOf(path)}:${BOOT}:${n}`;
    return new Response(JSON.stringify(status < 300 ? {} : { error: `refused ${status}` }), { status, headers });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZZ_GATEWAY;
});

/** Renders `ui` until the view's `useLive`, which stops it; the stop is caught here and nowhere else. */
class Stopped extends Component<{ children: ReactNode }, { stopped: boolean }> {
  state = { stopped: false };
  static getDerivedStateFromError() { return { stopped: true }; }
  componentDidCatch(error: unknown) { if (error !== STOP) throw error; }
  render() { return this.state.stopped ? null : this.props.children; }
}

/** What the view handed `useLive` when it was drawn with `ui`. */
function handed(ui: ReactElement): { names: string[]; since: unknown } {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(h(QueryClientProvider, { client: new QueryClient() }, h(Stopped, null, ui)));
  } finally {
    quiet.mockRestore();
  }
  expect(live.calls.length).toBeGreaterThan(0);
  return live.calls[0]!;
}

const at = (n: number) => `${BOOT}:${n}`;

/** Every page read on the console's server that follows a collection: its read, its view, and what it follows. */
const PAGES: [string, () => Promise<ReactElement>, string[]][] = [
  ['Knowledge', async () => h(KnowledgeView, { read: await readFirst<KnowledgeSummary>('/knowledge/summary') }), ['knowledge']],
  ['the knowledge log', async () => h(KnowledgeLogView, { read: await readFirst<{ entries: KnowledgeLogEntry[] }>('/knowledge/log') }), ['knowledge']],
  ['a lesson', async () => h(KnowledgeNodeView, { read: await readFirst<KnowledgeBody>('/knowledge/atlas/decisions/search.md'), team: 'atlas', rel: 'decisions/search.md' }), ['knowledge']],
  ['a document', async () => h(DocumentView, { team: 'atlas', slug: 's', rel: 'spec.md', served: await readDocument('atlas', 's', 'spec.md'), teamPage: false }), ['document']],
  ['Access', async () => h(AccessView, { served: await readAccess() }), ['settings']],
  ['Plugins', async () => h(PluginsView, { served: await readPlugins() }), ['plugins']],
  ['a plugin', async () => h(PluginView, { name: 'zz-core', served: await readPlugin('zz-core') }), ['plugins']],
  ['a skill', async () => h(SkillView, { plugin: 'zz-core', skill: 'zz-platform', view: 'read', served: await readSkill('zz-core', 'zz-platform') }), ['plugins', 'skills']],
  ['Approvals', async () => h(ApprovalsView, { served: await readApprovals(approvalsFilters({})) }), ['initiatives']],
  ['Activity', async () => h(ActivityView, { read: await readSummary() }), ['activity']],
  ['Teams', async () => h(PlatformTeamsView, { served: await readTeams(teamsFilters({})) }), ['teams']],
  ['a team', async () => h(PlatformTeamView, { slug: 'atlas', served: await readTeam('atlas') }), ['teams']],
  ['People', async () => h(PlatformPeopleView, { served: await readPeople(peopleFilters({})) }), ['people']],
  ['Initiatives', async () => h(InitiativesView, { served: await readInitiatives(initiativesFilters({})) }), ['initiatives']],
  ['an initiative', async () => h(InitiativeView, { team: 'atlas', slug: 's', served: await readInitiative('atlas', 's') }), ['initiatives']],
  ['Runs', async () => h(RunsView, { served: await readRuns(runsFilters({})) }), ['runs']],
];

describe('a page read on the console\'s server hands useLive the revisions its read returned', () => {
  it.each(PAGES)('%s', async (_name, page, names) => {
    const { names: followed, since } = handed(await page());
    expect(followed).toEqual(names);
    expect(since).toEqual(Object.fromEntries(names.map((n) => [n, at(7)])));
  });

  it('a page of several reads hands the oldest revision of each collection it read', async () => {
    const counts: Record<string, number> = { '/plugins': 9, '/plugins/zz-core/skills/zz-platform': 4, '/skills/zz-platform': 6 };
    answer = (path) => ({ status: 200, n: counts[path.split('?')[0]!] ?? 8 });
    const { since } = handed(h(SkillView, { plugin: 'zz-core', skill: 'zz-platform', view: 'read', served: await readSkill('zz-core', 'zz-platform') }));
    expect(since).toEqual({ plugins: at(4), skills: at(6) });
  });

  it('a refusal the page draws, a plugin\'s evaluation withheld from this reader, carries its revision too', async () => {
    answer = (path) => (path.endsWith('/eval') ? { status: 403, n: 3 } : { status: 200, n: 7 });
    const served = await readPlugin('zz-core');
    expect(served.evaluation.state).toBe('withheld');
    expect(handed(h(PluginView, { name: 'zz-core', served })).since).toEqual({ plugins: at(3) });
  });
});

describe('a page whose read brought no revision hands useLive none, and the stream resyncs it', () => {
  it('a read that failed', async () => {
    answer = () => ({ status: 503, n: 7 });
    const served = await readTeams(teamsFilters({}));
    expect(served.state).toBe('failed');
    expect(handed(h(PlatformTeamsView, { served }))).toEqual({ names: ['teams'], since: undefined });
  });

  it('a read answered while the gateway was not listening, which carries none', async () => {
    answer = () => ({ status: 200, n: null });
    expect(handed(h(KnowledgeView, { read: await readFirst<KnowledgeSummary>('/knowledge/summary') })).since).toBeUndefined();
  });

  it('a page of several reads, one of which carried none', async () => {
    answer = (path) => ({ status: 200, n: path.startsWith('/skills/') ? null : 7 });
    expect(handed(h(SkillView, { plugin: 'zz-core', skill: 'zz-platform', view: 'read', served: await readSkill('zz-core', 'zz-platform') })).since).toBeUndefined();
  });
});

/**
 * The bell is on every page and is read in the browser, so the tab's stream waits for it: its `useLive` registers
 * `initiatives` with the revision that read was answered at, and only then is the stream's key set, which is what opens
 * it (`LiveProvider`'s `scopeKey`).
 */
describe('the bell', () => {
  it('registers initiatives with the revision its read was answered at, and the stream opens only once it has', async () => {
    live.stop = false;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/console/me')) {
        return new Response(JSON.stringify({ email: 'ava@example.com', mayRead: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      await held;
      return new Response(JSON.stringify({ waiting: { state: 'ok', data: { rows: [], total: 0 } } }), {
        status: 200, headers: { 'content-type': 'application/json', 'x-zz-revision': `initiatives:${BOOT}:12` },
      });
    }));
    render(h(QueryClientProvider, { client: new QueryClient() }, h(ConsoleLive, null, h('span'))));
    await waitFor(() => expect(live.calls.some((c) => c.names.join() === 'initiatives')).toBe(true));
    // The bell's read has not answered: no revision yet, and no stream.
    expect(live.calls.at(-1)).toEqual({ names: ['initiatives'], since: undefined });
    expect(live.scopeKeys.at(-1)).toBe('');
    await act(async () => { release(); });
    await waitFor(() => expect(live.scopeKeys.at(-1)).toBe('ava@example.com'));
    expect(live.calls.at(-1)).toEqual({ names: ['initiatives'], since: { initiatives: at(12) } });
  });

  it('opens the stream without waiting for a bell that is not drawn, for a person the console does not read for', async () => {
    live.stop = false;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ email: 'pat@example.com', mayRead: false }), { status: 200, headers: { 'content-type': 'application/json' } })));
    render(h(QueryClientProvider, { client: new QueryClient() }, h(ConsoleLive, null, h('span'))));
    await waitFor(() => expect(live.scopeKeys.at(-1)).toBe('pat@example.com'));
    expect(live.calls).toEqual([]);
  });
});
