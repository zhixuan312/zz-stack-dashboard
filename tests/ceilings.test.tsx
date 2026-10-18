import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { AccessProvider } from '@/console/settings/access-read';
import { TeamMembersPanel } from '@/console/settings/team-members-panel';
import { TeamsPanel } from '@/console/settings/teams-panel';
import { TokensPanel } from '@/console/settings/tokens-panel';
import type { DocumentDetail, InitiativeDetail, KnowledgeBody, PluginEval, TeamMemberRow } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { APPROVALS_DEFAULTS, approvalsAddress, approvalsPath } from '@/views/approvals-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { HomeView } from '@/views/pages/home';
import { InitiativeView } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { PlatformAuditView } from '@/views/pages/platform-audit';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { RecordView } from '@/views/pages/record';
import { AUDIT_DEFAULTS, auditPath } from '@/views/platform-audit-context';
import { BUGS_DEFAULTS, bugsPath } from '@/views/platform-bugs-context';
import { releasesPath } from '@/views/platform-releases-context';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { recordPath } from '@/views/record-context';
import { TEAMS_DEFAULTS, teamsPath } from '@/views/teams-filter';
import { RELEASES } from '../scripts/fake-gateway/platform-releases.ts';
import { EXTREME_EXPECTS, LIB, extremeRule } from '../scripts/states-check.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * Every ceiling drawn above it (Task I-127, AC-2.7): each page drawn from the fake gateway's own answer in the `extreme`
 * state, asked as `pnpm verify`'s sweep asks it, with the session value `superadmin+extreme`, so what is drawn here is
 * what `scripts/states-check.ts` draws in a browser. Every table pages at ten (reconciliation 78) and says its total; a
 * second page holds other rows than the first, the same ones each time it is drawn; a list cut to a count says how many
 * it shows; and a series regrouped past 26 weeks is titled by the grain it arrives in. Task I-139 holds every other
 * table to the same ten: a plugin's skills, a document's claims, an initiative's two tables, a knowledge node's
 * neighbours, Access's three paged panels, a release's windows and Status's three tables.
 */
let base = '';
let stop = () => {};
beforeAll(async () => {
  const gateway = await startFakeGateway();
  base = gateway.base;
  stop = () => gateway.proc.kill();
});
afterAll(() => stop());
afterEach(() => vi.unstubAllGlobals());

const realFetch = globalThis.fetch;
const AT = '2026-10-18T00:00:00Z';
const VALUE = 'superadmin+extreme';

/** One read as the console's server makes it, for the superadmin on a busy platform. */
async function served<T>(path: string): Promise<T> {
  const res = await realFetch(`${base}/api/console${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: `zz_console=${VALUE}` } });
  expect(res.status, path).toBe(200);
  return await res.json() as T;
}

/** The browser's reads, sent to the fake gateway as the same session. */
const browser = () => vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(`${base}${String(input)}`, { method: init?.method, body: init?.body, headers: { accept: 'application/json', cookie: `zz_console=${VALUE}` } })));

/** `reads` stubs the browser's reads in place of the fake gateway's, before anything is drawn. */
function mount(ui: ReactElement, address: string, reads?: typeof fetch) {
  window.history.replaceState(null, '', address);
  if (reads) vi.stubGlobal('fetch', reads);
  else browser();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider><div data-scroll-region>{ui}</div></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 5_000 });
/** One table, by its caption, or the one table drawn when there is none to find it by: its rows' words and its pager's. */
const table = (caption: string | null) => {
  const section = (caption === null ? document.body : document.querySelector(`section[aria-label="${caption}"]`)) as HTMLElement | null;
  expect(section, `a table captioned "${caption}"`).not.toBeNull();
  return {
    section: section!,
    rows: [...section!.querySelectorAll('tbody tr')].map((r) => (r.textContent ?? '').trim()),
    pager: section!.querySelector('nav[aria-label="Pagination"]')?.textContent ?? '',
  };
};
const ofTotal = (pager: string) => Number(/of ([\d,]+)/.exec(pager)?.[1].replace(/,/g, '') ?? Number.NaN);

/**
 * A table the gateway pages: page one and page two each the console server's read of its own address, and page two
 * drawn twice. Each is ten rows under its total, and the second page's rows are none of the first's.
 */
type ServerPaged = { route: string; caption: string; address: (page: number) => string; path: (page: number) => string; draw: (path: string, data: never) => ReactElement };
const SERVER_PAGED: ServerPaged[] = [
  { route: '/initiatives', caption: 'Initiatives', address: (n) => `/initiatives?page=${n}`, path: (n) => listPath({ ...INITIATIVES_DEFAULTS, page: String(n) }),
    draw: (path, data) => <InitiativesView served={{ state: 'ok', path, data, team: 'atlas' }} /> },
  { route: '/record', caption: 'The record', address: (n) => `/record?page=${n}`, path: (n) => recordPath({ period: 'all', page: String(n) }),
    draw: (path, data) => <RecordView served={{ state: 'ok', path, data, team: 'atlas' }} /> },
  { route: '/approvals', caption: 'Team approvals', address: (n) => approvalsAddress('waiting', n), path: (n) => approvalsPath({ ...APPROVALS_DEFAULTS, page: String(n) }),
    draw: (path, data) => <ApprovalsView served={{ state: 'ok', path, data, team: 'atlas' }} /> },
  { route: '/platform/releases', caption: 'Releases with what was observed either side of each', address: (n) => `/platform/releases?page=${n}`, path: (n) => releasesPath({ page: String(n) }),
    draw: (path, data) => <PlatformReleasesView served={{ state: 'ok', path, data }} /> },
  { route: '/platform/bugs', caption: 'Bug reports, newest filed first', address: (n) => `/platform/bugs?page=${n}`, path: (n) => bugsPath({ ...BUGS_DEFAULTS, page: String(n) }),
    draw: (path, data) => <PlatformBugsView served={{ state: 'ok', path, data }} /> },
  { route: '/platform/audit', caption: 'Events, newest first', address: (n) => `/platform/audit?filter=all&page=${n}`, path: (n) => auditPath({ ...AUDIT_DEFAULTS, filter: 'all', page: String(n) }),
    draw: (path, data) => <PlatformAuditView served={{ state: 'ok', path, data }} /> },
  { route: '/platform/teams', caption: 'Teams', address: (n) => `/platform/teams?page=${n}`, path: (n) => teamsPath({ ...TEAMS_DEFAULTS, page: String(n) }),
    draw: (path, data) => <PlatformTeamsView served={{ state: 'ok', path, data }} /> },
  { route: '/platform/people', caption: 'People', address: (n) => `/platform/people?page=${n}`, path: (n) => peoplePath({ ...PEOPLE_DEFAULTS, page: String(n) }),
    draw: (path, data) => <PlatformPeopleView served={{ state: 'ok', path, data }} /> },
];

describe('a table the gateway pages, drawn above its ceiling', () => {
  it.each(SERVER_PAGED.map((p) => [p.route, p] as const))('%s: ten a page under its total, a second page of other rows, the same each time', async (_, p) => {
    const page = async (n: number) => {
      const view = mount(p.draw(p.path(n), await served(p.path(n)) as never), p.address(n));
      await settled();
      const drawn = table(p.caption);
      view.unmount();
      return drawn;
    };
    const [first, second, again] = [await page(1), await page(2), await page(2)];
    expect(first.rows, p.route).toHaveLength(10);
    expect(ofTotal(first.pager), `${p.route}: the pager's total`).toBeGreaterThan(10);
    expect(first.pager, p.route).toMatch(/1–10 of/);
    expect(second.pager, p.route).toMatch(/11–20 of/);
    expect(second.rows, p.route).toHaveLength(10);
    for (const row of second.rows) expect(first.rows, p.route).not.toContain(row);
    expect(again.rows, `${p.route}: the second page drawn again`).toEqual(second.rows);
  });
});

/** A table that pages what it was handed: page one, then page two, then back and forward, at ten a page. */
async function pagesItself(caption: string | null) {
  const named = caption ?? 'the table';
  const first = table(caption);
  expect(first.rows, named).toHaveLength(10);
  expect(ofTotal(first.pager), named).toBeGreaterThan(10);
  const go = (n: number) => fireEvent.click(within(table(caption).section).getAllByRole('button', { name: `Page ${n}` })[0]);
  go(2);
  const second = table(caption);
  expect(second.rows, named).toHaveLength(10);
  for (const row of second.rows) expect(first.rows, named).not.toContain(row);
  go(1);
  go(2);
  expect(table(caption).rows, `${named}: the second page again`).toEqual(second.rows);
}

describe('a table that pages what it was handed, at ten', () => {
  it('Plugins: the catalog ten a page', async () => {
    mount(<PluginsView served={{ state: 'ok', path: '/plugins', at: AT, data: await served('/plugins') }} />, '/plugins');
    await pagesItself('Plugins');
  });

  it('Evaluation: each plugin, every series and the findings waiting, ten a page', async () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: await served('/platform/evaluation') }} />, '/platform/evaluation');
    for (const caption of ['Each plugin\'s latest score', 'Every score, by series', 'Findings waiting for a decision, oldest first']) await pagesItself(caption);
  });

  it('Knowledge health: every shelf ten a page, and the questions ten of the many asked', async () => {
    const health = await served<{ questions: { data: { total: number } } }>('/platform/knowledge');
    mount(<PlatformKnowledgeView read={{ state: 'ok', health: health as never }} />, '/platform/knowledge');
    await pagesItself('Each shelf\'s lessons and last week\'s searches');
    expect(table('Questions the searches that found nothing asked').rows).toHaveLength(10);
    expect(text()).toContain(`10 shown of ${health.questions.data.total.toLocaleString('en-US')}`);
  });

  it('The knowledge log: ten entries a page', async () => {
    mount(<KnowledgeLogView read={{ state: 'ok', data: await served('/knowledge/log'), at: AT }} />, '/knowledge/log');
    await pagesItself('Knowledge log');
  });
});

describe('a list cut to a count says how many it shows', () => {
  it('Usage: the browser check reads each legend item as its own label, so Other is found beside a long team name', async () => {
    // The W3 acceptance run read the legend's text whole, `…came-from-a-tiOther`, where no word boundary stands before
    // Other; the check's own in-page reader runs here over the page as drawn.
    mount(<main><PlatformUsageView read={{ state: 'ok', usage: await served('/platform/usage') }} /></main>, '/platform/usage');
    const { legend } = new Function(`${LIB}; return { legend: legend() };`)() as { legend: string[] };
    expect(extremeRule({ path: '/platform/usage' }, 'superadmin', { years: 0, tables: [], legend }).problems).toEqual([]);
  });

  it('Usage: ten tools of the many called, and the fourth part of the calls by team is Other', async () => {
    mount(<PlatformUsageView read={{ state: 'ok', usage: await served('/platform/usage') }} />, '/platform/usage');
    expect(table('Each tool\'s median call, first week against last').rows).toHaveLength(10);
    expect(text()).toMatch(/10 of 23 tools/);
    const legend = [...document.querySelectorAll('[data-legend]')].map((l) => l.textContent ?? '').join(' ');
    expect(legend).toContain('Other');
  });

  it('Knowledge: the five newest lessons, said as five, and the searches titled by the grain they arrive in', async () => {
    mount(<KnowledgeView read={{ state: 'ok', data: await served('/knowledge/summary'), at: AT }} />, '/knowledge');
    await settled();
    expect(text()).toMatch(/The 5 lessons your team recorded most recently/);
    expect(screen.getByRole('heading', { name: 'Searches with results, by week' })).toBeInTheDocument();
  });

  it('Status: five needs, and what the five leave out counted by its kind', async () => {
    mount(<PlatformStatusView read={{ state: 'ok', status: await served('/platform/status') }} />, '/platform/status');
    expect(text()).toMatch(/14 things need you/);
    expect(text()).toMatch(/latency drift/);
  });

  it('Home: four groups of runs and the rest counted, five rows of open work, and the one document waiting named', async () => {
    const home = await served<{ waiting: { data: { one: { path: string } } }; runs: { data: { more: number } } }>('/home');
    mount(<HomeView read={{ state: 'ok', home: home as never, team: 'atlas' }} />, '/');
    expect(text()).toContain(home.waiting.data.one.path);
    expect(text()).toMatch(new RegExp(`${home.runs.data.more} more`));
  });
});

describe('a series past 26 weeks is titled by the grain it arrives in', () => {
  it('Record: the whole record by quarter, five years stepped one at a time, and the five most rewritten said as five', async () => {
    const path = recordPath({ period: 'all', page: '1' });
    mount(<RecordView served={{ state: 'ok', path, data: await served(path), team: 'atlas' }} />, '/record');
    await settled();
    expect(text()).toContain('Words added, a running total, by quarter');
    expect(text()).not.toMatch(/by (week|month)\b/);
    const year = document.querySelector('[aria-label="Year"]')!;
    expect(year.querySelectorAll('[role="radio"]').length).toBeGreaterThan(1);
    expect(text()).toMatch(/The 5 documents given the most versions/);
  });

  it('Record: this year by month', async () => {
    const path = recordPath({ period: 'year', page: '1' });
    mount(<RecordView served={{ state: 'ok', path, data: await served(path), team: 'atlas' }} />, '/record?period=year');
    await settled();
    expect(text()).toContain('Words added, a running total, by month');
    expect(text()).not.toMatch(/by (week|quarter)\b/);
  });

  it('Initiatives: the closures by month', async () => {
    const path = listPath(INITIATIVES_DEFAULTS);
    mount(<InitiativesView served={{ state: 'ok', path, data: await served(path), team: 'atlas' }} />, '/initiatives');
    await settled();
    expect(screen.getByText('Closures by month and outcome', { selector: 'caption' })).toBeInTheDocument();
    expect(text()).not.toContain('Closures by week');
  });
});

/**
 * The page sizes a table's pager offers, read by opening its menu: ten alone is a table that pages at ten and offers no
 * larger page. `null` when the pager draws no menu.
 */
function sizesOffered(caption: string | null): string[] | null {
  const trigger = [...table(caption).section.querySelectorAll('nav[aria-label="Pagination"] button')].find((b) => /per page/.test(b.textContent ?? ''));
  if (!trigger) return null;
  fireEvent.keyDown(trigger, { key: 'Enter' });
  const sizes = screen.getAllByRole('menuitem').map((m) => (m.textContent ?? '').trim());
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  return sizes;
}
/** Ten a page under the total, every page another ten, and no larger page offered. */
async function pagesAtTen(caption: string | null) {
  await pagesItself(caption);
  expect(sizesOffered(caption), `${caption ?? 'the table'}: the page sizes offered`).toEqual(['10 per page']);
}
/** `n` rows made of one, each its own. */
const grow = <T,>(rows: T[], n: number, own: (row: T, i: number) => T): T[] => Array.from({ length: n }, (_, i) => own(rows[i % rows.length], i));

const SLUG = '2026-09-28-search-relevance';
const NODE = 'nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md';

/**
 * Every table outside the pages above, drawn above ten rows (Task I-139): the fake gateway's answer for the route, its
 * list grown past ten where the busy platform does not grow it, each table then ten a page under its total with no
 * larger page offered.
 */
describe('a detail page\'s table, drawn above ten rows, pages at ten', () => {
  it('a plugin: its skills, as the busy platform answers them', async () => {
    const catalog = await served<{ plugins: { plugin: string; skills: unknown[] }[] }>('/plugins');
    expect(catalog.plugins.find((p) => p.plugin === 'sdlc')!.skills.length).toBeGreaterThan(10);
    const evaluation = await served<PluginEval>('/plugins/sdlc/eval');
    mount(<PluginView name="sdlc" served={{ catalog: { state: 'ok', path: '/plugins', at: AT, data: catalog as never }, evaluation: { state: 'ok', path: '/plugins/sdlc/eval', at: AT, data: evaluation } }} />, '/plugins/sdlc');
    await settled();
    await pagesAtTen('sdlc\'s skills');
  });

  it('a document: its claims', async () => {
    const doc = await served<DocumentDetail>(`/document/atlas/${SLUG}/spec.md`);
    const decisions = grow(doc.decisions, 23, (d, i) => ({ ...d, key: `AC-${i + 1}.1`, detail: `${d.detail} The ${i + 1}th claim.` }));
    mount(<DocumentView team="atlas" slug={SLUG} rel="spec.md" served={{ state: 'ok', data: { ...doc, decisions, decisionCounts: { ...doc.decisionCounts, rows: 23 } }, at: AT }} teamPage={false} />, `/initiatives/atlas/${SLUG}/spec.md`);
    await settled();
    await pagesAtTen('Claims');
  });

  it('an initiative: its documents and its sources', async () => {
    const d = await served<InitiativeDetail>(`/initiatives/atlas/${SLUG}`);
    const written = d.documents.filter((x) => !x.path.startsWith('sources/'));
    const sources = d.documents.filter((x) => x.path.startsWith('sources/'));
    const documents = [
      ...grow(written, 23, (x, i) => ({ ...x, path: `notes/note-${String(i).padStart(2, '0')}.md`, title: `A note, the ${i + 1}th` })),
      ...grow(sources, 23, (x, i) => ({ ...x, path: `sources/R${i + 1}.md`, title: `R${i + 1}: what someone said, the ${i + 1}th` })),
    ];
    mount(<InitiativeView team="atlas" slug={SLUG} served={{ state: 'ok', data: { ...d, documents }, team: 'atlas', at: AT }} />, `/initiatives/atlas/${SLUG}`);
    await settled();
    await pagesAtTen('Documents');
    await pagesAtTen('Sources');
  });

  it('a knowledge node: the nodes that share a tag', async () => {
    const node = await served<KnowledgeBody>(`/knowledge/atlas/${NODE}`);
    const related = grow(node.related ?? [], 23, (n, i) => ({ ...n, key: `atlas/nodes/${1000 + i}.md`, num: String(1000 + i), path: `nodes/${1000 + i}.md`, title: `A neighbour, the ${i + 1}th` }));
    mount(<KnowledgeNodeView read={{ state: 'ok', data: { ...node, related }, at: AT }} team="atlas" rel={NODE} />, `/knowledge/atlas/${NODE}`);
    await settled();
    await pagesAtTen('Nodes that share a tag');
  });

  it('Status: the doors, and the scoreboard\'s two tables, which hold five and three measures and so never page', async () => {
    const status = await served<PlatformStatus>('/platform/status');
    if (status.doors.state !== 'ok') throw new Error('the busy platform answers its doors');
    // More doors than the platform has, each named its own, so a page of them is told from the next.
    const doors = grow(status.doors.data, 23, (d, i) => ({ ...d, door: `${d.door}-${i + 1}` as typeof d.door }));
    mount(<PlatformStatusView read={{ state: 'ok', status: { ...status, doors: { state: 'ok', data: doors } } }} />, '/platform/status');
    await pagesAtTen('Each door\'s fault days and its run of days under 1% tool failures');
    for (const [caption, n] of [['Five measures with a direction, each against the week before', 5], ['Three activity measures, each against the week before', 3]] as const) {
      expect(table(caption).rows, caption).toHaveLength(n);
      expect(table(caption).pager, caption).toBe('');
    }
  });

  it('a release: its two windows, the most it holds, with no pager', () => {
    const release = RELEASES[0];
    mount(<PlatformReleaseView version={release.version} served={{ state: 'ok', data: release }} />, `/platform/releases/${release.version}`);
    const windows = table(`What was observed in the 72 hours either side of ${release.version}`);
    expect(windows.rows).toHaveLength(2);
    expect(windows.pager).toBe('');
  });
});

describe('Access\'s paged panels, drawn above ten rows, page at ten', () => {
  const access = async () => served<Access>('/access');

  it('your tokens', async () => {
    const a = await access();
    const issued = grow(a.issued, 23, (t, i) => ({ ...t, id: `tok_${String(i).padStart(4, '0')}`, label: `laptop number ${i + 1}` }));
    mount(<AccessProvider value={{ access: { ...a, issued } }}><TokensPanel /></AccessProvider>, '/access');
    await pagesAtTen(null);
  });

  it('the teams you belong to', async () => {
    const a = await access();
    const teams = { ...a.teams, teams: grow(a.teams.teams, 23, (t, i) => ({ ...t, team: `team-${String(i).padStart(2, '0')}`, active: i === 0 })) };
    mount(<TeamsPanel teams={teams} />, '/access');
    await pagesAtTen(null);
  });

  it('a team admin\'s members', async () => {
    const members: TeamMemberRow[] = Array.from({ length: 23 }, (_, i) => ({ email: `person.${i + 1}@example.com`, role: i % 3 ? 'member' : 'admin' }));
    // The roster is the browser's read: answered here with more people than a page holds.
    mount(<TeamMembersPanel team="atlas" />, '/access', vi.fn(async () => ({ ok: true, status: 200, json: async () => members }) as unknown as Response));
    await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
    await pagesAtTen(null);
  });
});

describe('every table on these pages is written to page at ten', () => {
  const FILES = ['plugin.tsx', 'document.tsx', 'initiative.tsx', 'knowledge-node.tsx', 'platform-release.tsx', 'platform-status.tsx'];
  // A table that holds five rows today is still drawn by the same component, so it is held to the same page size.
  it.each(FILES)('%s: each DataTable says ten a page and offers only ten', (file) => {
    const source = readFileSync(`src/views/pages/${file}`, 'utf8');
    const tables = source.split('<DataTable').length - 1;
    expect(tables, file).toBeGreaterThan(0);
    expect(source.split('pageSize={10}').length - 1, `${file}: pageSize={10}`).toBe(tables);
    expect(source.split('pageSizes={[10]}').length - 1, `${file}: pageSizes={[10]}`).toBe(tables);
  });

  it('Access\'s pager offers only ten', () => {
    expect(readFileSync('src/console/paged.tsx', 'utf8')).toMatch(/pageSizes=\{\[10\]\}/);
  });
});

describe('the browser check of the extreme state', () => {
  const t = (rows: number, pager = '', words = '') => ({ caption: 'A table', rows, pager, words });
  const busy = { years: 0, legend: [] as string[] };

  it('passes ten rows under a pager or their own total, and fewer with neither', () => {
    expect(extremeRule({ path: '/initiatives' }, 'member', { ...busy, tables: [t(10, '1–10 of 3,916 initiatives'), t(10, '', 'Each tool; 10 of 23 tools called'), t(4)] }).problems).toEqual([]);
  });

  it('fails a page of more than ten rows, and ten rows with no total, which is a total clipped to the page', () => {
    expect(extremeRule({ path: '/plugins' }, 'superadmin', { ...busy, tables: [t(20, '1–20 of 34 plugins')] }).problems).toEqual(['"A table" draws 20 rows on one page, past ten']);
    expect(extremeRule({ path: '/plugins' }, 'superadmin', { ...busy, tables: [t(10)] }).problems).toEqual(['"A table" draws ten rows and no total, so the total is clipped to the page']);
  });

  it('wants the year stepper on Record and Other on Usage for the superadmin, whose calls split by team', () => {
    expect(extremeRule({ path: '/record' }, 'member', { ...busy, tables: [] }).problems).toEqual(['no year stepper, though the record holds days in more than one year']);
    expect(extremeRule({ path: '/record' }, 'member', { ...busy, years: 5, tables: [] }).problems).toEqual([]);
    expect(extremeRule({ path: '/platform/usage' }, 'superadmin', { ...busy, legend: ['atlas', 'beacon', 'cinder'], tables: [] }).problems).toHaveLength(1);
    expect(extremeRule({ path: '/platform/usage' }, 'superadmin', { ...busy, legend: ['atlas', 'beacon', 'cinder', 'Other'], tables: [] }).problems).toEqual([]);
    // Each legend item is read as its own label: a long team name runs flush into the next item's text, `…a-tiOther`,
    // where no word boundary stands before Other (the W3 acceptance run, read in a browser on 19 October).
    expect(extremeRule({ path: '/platform/usage' }, 'superadmin', { ...busy, legend: ['team-3-with-a-name-nobody-planned-for-because-it-came-from-a-ti', 'Other'], tables: [] }).problems).toEqual([]);
    expect(extremeRule({ path: '/platform/usage' }, 'superadmin', { ...busy, legend: ['team-3-with-a-name-nobody-planned-for-because-it-came-from-a-tiOther'], tables: [] }).problems).toHaveLength(1);
    expect(extremeRule({ path: '/platform/usage' }, 'member', { ...busy, tables: [] }).problems).toEqual([]);
    expect(EXTREME_EXPECTS['/record']).toEqual({ stepper: true });
  });
});
