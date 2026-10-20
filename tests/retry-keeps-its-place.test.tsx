import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement as h, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A page that draws the state its server read ended in (not found, failed, unanswered within the bound) keeps that
 * state, and its Retry, where they are while the browser reads again (Task I-150, AC-2.9). `pnpm verify`'s keyboard path
 * lost a person's place on Retry when a hint made the browser read a missing document again (#3763): the page dropped
 * the state for a skeleton while the read was in flight, and a first fix that kept it but marked Retry busy for any
 * read in flight disabled the focused button, which loses focus all the same. Only the person's own press makes Retry
 * busy, and only until that read answers.
 *
 * Each case runs the page's own server read against a gateway that ends it in one trouble, draws the page's view with
 * what it returned, and then answers the browser's reads by hand: held until the case answers them, so what stands
 * while a read is in flight is what is asserted. A change is every console read invalidated, as `ConsoleLive` does for
 * a hint; each is one browser read of each address the page follows, never two. A resource hint the page writes for a
 * read (`useConsole`'s `preload`) is a read too, the browser's own: one written after a read answered fetched it a
 * second time, 3 ms after the first (#3772), so every hint asked for is counted with the reads.
 */
const hinted = vi.hoisted(() => ({ hint: (_href: string) => {} }));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  preload: (href: string) => hinted.hint(href),
}));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  chromeAccess: async () => ({ only: ['/'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava@example.com' }),
}));

import { AccessView } from '@/views/pages/access';
import { ActivityView } from '@/views/pages/activity';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { InitiativeView } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { PlatformAuditView } from '@/views/pages/platform-audit';
import { PlatformBugView } from '@/views/pages/platform-bug';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformTeamView } from '@/views/pages/platform-team';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { RecordView } from '@/views/pages/record';
import { RunsView } from '@/views/pages/runs';
import { SkillView } from '@/views/pages/skill';
import { filtersOf as approvalsFilters } from '@/views/approvals-context';
import { readDocument } from '@/views/document-read';
import { filtersOf as initiativesFilters } from '@/views/initiatives-filter';
import { filtersOf as peopleFilters } from '@/views/people-filter';
import { filtersOf as auditFilters } from '@/views/platform-audit-context';
import { filtersOf as bugsFilters } from '@/views/platform-bugs-context';
import { filtersOf as releasesFilters } from '@/views/platform-releases-context';
import { filtersOf as recordFilters } from '@/views/record-context';
import { filtersOf as runsFilters } from '@/views/runs-context';
import { filtersOf as teamsFilters } from '@/views/teams-filter';
import { readAccess } from '../app/(dash)/access/read-access';
import { readSummary } from '../app/(dash)/activity/read-summary';
import { readApprovals } from '../app/(dash)/approvals/read-approvals';
import { readInitiative, readInitiatives } from '../app/(dash)/initiatives/read-initiatives';
import { readAudit } from '../app/(dash)/platform/audit/read-audit';
import { readBug, readBugs, readDuplicates } from '../app/(dash)/platform/bugs/read-bugs';
import { readPeople } from '../app/(dash)/platform/people/read-people';
import { readRelease, readReleases } from '../app/(dash)/platform/releases/read-releases';
import { readTeam, readTeams } from '../app/(dash)/platform/teams/read-teams';
import { readPlugin, readPlugins, readSkill } from '../app/(dash)/plugins/read-plugins';
import { readRecord } from '../app/(dash)/record/read-record';
import { readRuns } from '../app/(dash)/runs/read-runs';

const GATEWAY = 'http://gateway.test';
/** Every bound a server read is given is 4.5 s; past it the read is `slow`. */
const PAST_THE_BOUND = 4_600;

type Trouble = 'missing' | 'failed' | 'slow';

/** How the console's server's reads end: a 404, a 503, or no answer at all. */
let ending: Trouble = 'failed';
/** The browser's reads, by address past `/api/console`, in the order sent. */
let reads: string[] = [];
/** The browser's reads still waiting for an answer. */
let held: { path: string; answer: (status: number, body: unknown) => void }[] = [];

/** A browser read's address past `/api/console`, as the gateway is asked it. */
const addressOf = (url: string) => {
  const at = new URL(url, 'http://console.test');
  return at.pathname.replace(/^\/api\/console/, '') + at.search.replace(/[?&]scope=platform$/, '');
};
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  ending = 'failed';
  reads = [];
  held = [];
  process.env.ZZ_GATEWAY = GATEWAY;
  hinted.hint = (href) => { reads.push(addressOf(href)); };
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith(GATEWAY)) {
      if (ending === 'slow') return new Promise(() => {});
      return Promise.resolve(ending === 'missing' ? respond(404, { error: 'Nothing is recorded at this address.' }) : respond(503, { error: 'The gateway is not answering.' }));
    }
    const path = addressOf(url);
    reads.push(path);
    return new Promise<Response>((resolve) => { held.push({ path, answer: (status, body) => resolve(respond(status, body)) }); });
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.ZZ_GATEWAY;
});

/** The server's read, ended in `trouble`: past its bound under fake timers when it never answers. */
async function serverRead<T>(trouble: Trouble, read: () => Promise<T>): Promise<T> {
  ending = trouble;
  if (trouble !== 'slow') return read();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    const pending = read();
    await vi.advanceTimersByTimeAsync(PAST_THE_BOUND);
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });
/** Answers every browser read still waiting, with the same failure. An answer is no reason to read: nothing is sent for it. */
const answerAll = async (reason: string) => {
  const waiting = held;
  held = [];
  const sent = reads.length;
  await act(async () => { for (const r of waiting) r.answer(503, { error: reason }); });
  await settle();
  expect(reads.slice(sent)).toEqual([]);
};
const shimmers = () => document.querySelectorAll('.shimmer').length;
/**
 * The browser reads one change sent: each address once. `/me` is the person, which a document reads beside itself, and
 * a read the page makes in the browser from the start (Activity's log) is read again with the rest; neither twice.
 */
async function readsOfOneChange(from: number, follows: string[]): Promise<string[]> {
  await waitFor(() => { for (const f of follows) expect(reads.slice(from).some((r) => r.split('?')[0] === f)).toBe(true); });
  await settle();
  const sent = reads.slice(from);
  expect(sent).toEqual([...new Set(sent)]);
  return sent;
}

/**
 * A page of the nineteen: its view drawn from its own server read, the addresses it follows in the browser, and the
 * troubles that read can end in that the view draws (a detail route whose server read answers 404 draws the missing
 * page at the route, never the view). Every Retry is busy for the person's own press, the managed DataTable's included
 * (`retrying`, ZZ Meridian 0.19.0). `pressed` is how many reads a press sends: a page whose Retry reads two of its reads
 * asks both.
 */
type Page = {
  name: string;
  view: (trouble: Trouble) => Promise<ReactElement>;
  follows: string[];
  troubles: Trouble[];
  pressed?: number;
  /** The control the missing state offers in place of Retry, where it offers one. */
  missing?: string;
};

const PAGES: Page[] = [
  {
    name: 'a document', follows: ['/document/atlas/s/spec.md'], troubles: ['missing', 'failed', 'slow'],
    view: async (t) => h(DocumentView, { team: 'atlas', slug: 's', rel: 'spec.md', served: await serverRead(t, () => readDocument('atlas', 's', 'spec.md')), teamPage: false }),
  },
  {
    name: 'an initiative', follows: ['/initiatives/atlas/s'], troubles: ['missing', 'failed', 'slow'], missing: 'All initiatives',
    view: async (t) => h(InitiativeView, { team: 'atlas', slug: 's', served: await serverRead(t, () => readInitiative('atlas', 's')) }),
  },
  {
    name: 'a team', follows: ['/teams/atlas'], troubles: ['missing', 'failed', 'slow'], missing: 'All teams',
    view: async (t) => h(PlatformTeamView, { slug: 'atlas', served: await serverRead(t, () => readTeam('atlas')) }),
  },
  {
    name: 'a release', follows: ['/platform/releases/0.1.0'], troubles: ['failed', 'slow'],
    view: async (t) => h(PlatformReleaseView, { version: '0.1.0', served: await serverRead(t, () => readRelease('0.1.0')) }),
  },
  {
    name: 'a bug report', follows: ['/platform/bugs/b1', '/platform/bugs/b1/duplicates'], troubles: ['failed', 'slow'],
    view: async (t) => {
      const [served, duplicates] = await serverRead(t, () => Promise.all([readBug('b1'), readDuplicates('b1')]));
      return h(PlatformBugView, { id: 'b1', served, duplicates });
    },
  },
  { name: 'Record', follows: ['/record'], troubles: ['failed', 'slow'], view: async (t) => h(RecordView, { served: await serverRead(t, () => readRecord(recordFilters({}))) }) },
  { name: 'Audit', follows: ['/platform/audit'], troubles: ['failed', 'slow'], view: async (t) => h(PlatformAuditView, { served: await serverRead(t, () => readAudit(auditFilters({}))) }) },
  { name: 'Access', follows: ['/access'], troubles: ['failed', 'slow'], view: async (t) => h(AccessView, { served: await serverRead(t, readAccess) }) },
  { name: 'Plugins', follows: ['/plugins'], troubles: ['failed', 'slow'], view: async (t) => h(PluginsView, { served: await serverRead(t, readPlugins) }) },
  {
    name: 'a skill', follows: ['/plugins', '/skills', '/skills/zz-platform', '/plugins/zz-core/skills/zz-platform'], troubles: ['failed', 'slow'], pressed: 2,
    view: async (t) => h(SkillView, { plugin: 'zz-core', skill: 'zz-platform', view: 'read', served: await serverRead(t, () => readSkill('zz-core', 'zz-platform')) }),
  },
  { name: 'Approvals', follows: ['/approvals'], troubles: ['failed', 'slow'], view: async (t) => h(ApprovalsView, { served: await serverRead(t, () => readApprovals(approvalsFilters({}))) }) },
  {
    name: 'a plugin', follows: ['/plugins', '/plugins/zz-core/eval'], troubles: ['failed', 'slow'],
    view: async (t) => h(PluginView, { name: 'zz-core', served: await serverRead(t, () => readPlugin('zz-core')) }),
  },
  { name: 'Activity', follows: ['/activity/summary'], troubles: ['failed', 'slow'], view: async (t) => h(ActivityView, { read: await serverRead(t, readSummary) }) },
  { name: 'Bugs', follows: ['/platform/bugs'], troubles: ['failed', 'slow'], view: async (t) => h(PlatformBugsView, { served: await serverRead(t, () => readBugs(bugsFilters({}))) }) },
  { name: 'Teams', follows: ['/teams'], troubles: ['failed', 'slow'], view: async (t) => h(PlatformTeamsView, { served: await serverRead(t, () => readTeams(teamsFilters({}))) }) },
  { name: 'People', follows: ['/people'], troubles: ['failed', 'slow'], view: async (t) => h(PlatformPeopleView, { served: await serverRead(t, () => readPeople(peopleFilters({}))) }) },
  { name: 'Initiatives', follows: ['/initiatives'], troubles: ['failed', 'slow'], view: async (t) => h(InitiativesView, { served: await serverRead(t, () => readInitiatives(initiativesFilters({}))) }) },
  { name: 'Releases', follows: ['/platform/releases'], troubles: ['failed', 'slow'], view: async (t) => h(PlatformReleasesView, { served: await serverRead(t, () => readReleases(releasesFilters({}))) }) },
  { name: 'Runs', follows: ['/runs'], troubles: ['failed', 'slow'], view: async (t) => h(RunsView, { served: await serverRead(t, () => readRuns(runsFilters({}))) }) },
];

function draw(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(h(QueryClientProvider, { client }, h(Tooltip.Provider, null, ui)));
  return client;
}

/** A change to everything the console reads, as a hint is: every console read invalidated, and refetched where on screen. */
const change = (client: QueryClient) => act(async () => { void client.invalidateQueries({ queryKey: ['console'] }); });

/** The control the state offers: Retry, or the link a missing state offers in its place. */
const control = (page: Page, trouble: Trouble) => (trouble === 'missing' && page.missing
  ? screen.getByRole('link', { name: page.missing })
  : screen.getAllByRole('button', { name: 'Retry' })[0]!);

/**
 * Nothing has taken the state's place: the same control, neither busy nor disabled and still holding the focus a
 * keyboard user gave it, and no skeleton more than before.
 */
function inPlace(was: HTMLElement, page: Page, trouble: Trouble, skeletons: number) {
  expect(control(page, trouble)).toBe(was);
  expect(was).not.toHaveAttribute('aria-busy');
  expect(was).not.toBeDisabled();
  expect(document.activeElement).toBe(was);
  expect(shimmers()).toBe(skeletons);
}

const CASES = PAGES.flatMap((page) => page.troubles.map((trouble) => [page.name, trouble, page] as const));

describe('a state a server read ended in stays on screen, and its Retry, while the browser reads again', () => {
  it.each(CASES)('%s, its server read %s', async (_name, trouble, page) => {
    const client = draw(await page.view(trouble));
    await settle();
    // The server's read is the page's until something says it is stale: the browser has read nothing of the page.
    expect(reads.filter((r) => page.follows.includes(r.split('?')[0]!))).toEqual([]);
    const was = control(page, trouble);
    const skeletons = shimmers();

    // A change, before the browser has read anything: its first read, once, with the state on screen throughout.
    let from = reads.length;
    was.focus();
    await change(client);
    await readsOfOneChange(from, page.follows);
    inPlace(was, page, trouble, skeletons);
    await answerAll('The first read in the browser failed.');
    expect(document.body.textContent).toContain('The first read in the browser failed.');

    // Another change, after the browser's read failed: the same again.
    const now = control(page, 'failed');
    from = reads.length;
    now.focus();
    await change(client);
    await readsOfOneChange(from, page.follows);
    inPlace(now, page, 'failed', skeletons);
    await answerAll('The second read in the browser failed.');
    expect(document.body.textContent).toContain('The second read in the browser failed.');

    // The person's press: one read of what Retry reads, its Retry busy until that read answers, then the read's own state.
    const retry = control(page, 'failed');
    from = reads.length;
    fireEvent.click(retry);
    await waitFor(() => expect(reads.length).toBe(from + (page.pressed ?? 1)));
    await settle();
    expect(reads.slice(from)).toEqual([...new Set(reads.slice(from))]);
    expect(reads.length).toBe(from + (page.pressed ?? 1));
    expect(retry).toHaveAttribute('aria-busy', 'true');
    await answerAll('The read the person asked for failed.');
    expect(document.body.textContent).toContain('The read the person asked for failed.');
    const after = control(page, 'failed');
    expect(after).not.toHaveAttribute('aria-busy');
    expect(after).not.toBeDisabled();
  });

  it.each(PAGES.map((p) => [p.name, p] as const))('%s: a Retry pressed before the browser has read is its first read, busy until it answers', async (_name, page) => {
    draw(await page.view('failed'));
    await settle();
    const retry = control(page, 'failed');
    const from = reads.length;
    fireEvent.click(retry);
    await waitFor(() => expect(reads.length).toBe(from + (page.pressed ?? 1)));
    expect(retry).toHaveAttribute('aria-busy', 'true');
    expect(control(page, 'failed')).toBe(retry);
    await answerAll('The first read in the browser failed.');
    expect(document.body.textContent).toContain('The first read in the browser failed.');
    expect(control(page, 'failed')).not.toHaveAttribute('aria-busy');
  });
});
