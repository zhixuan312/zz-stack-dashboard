import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import type { Me } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import type { AdminBugRow, PlatformStatus } from '@/lib/platform-shapes';
import { PlatformBugView } from '@/views/pages/platform-bug';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { BUGS_DEFAULTS, bugsPath, type BugsRead } from '@/views/platform-bugs-context';
import { RELEASES_DEFAULTS, TILES, clientActionOf, observedText, releasesPath, type ReleasesRead } from '@/views/platform-releases-context';
import { statusRead } from '@/views/platform-status-context';
import { REPORTS, bugReport, bugs, duplicates } from '../scripts/fake-gateway/platform-bugs.ts';
import { RELEASES, releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import PlatformBugPage from '../app/(dash)/platform/bugs/[id]/page';

/**
 * The findings of "Phase 7, I-129: a non-builder's review of the Platform destinations" on Status, Releases, a release,
 * Bugs and a report, each as the cause the review traced it to: what is running named tagged, not released; figures and
 * dates that never wrap into towers; a phone scoreboard that labels its pairs and a door card that keeps its run; every
 * row of what needs attention a link that says so; one plural and no foot that repeats the title; every card a row gap
 * apart; the Releases table inside its card and a phone card that keeps a release's summary and action; units on the
 * tiles; a release that says each thing once in one date range; the queue right after the tiles; a member's withheld
 * titles told apart by surface, impact and filed date; and a report titled by itself.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

function browser() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (String(input).endsWith('/me')
    ? Promise.resolve({ ok: true, status: 200, json: async () => SUPERADMIN } as unknown as Response)
    : new Promise(() => {}))));
}
function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
async function markupOf(answer: ReactNode | Promise<ReactNode>): Promise<HTMLElement> {
  const node = await answer;
  let container = document.body;
  await act(async () => { container = mount(<>{node}</>).container; });
  return container;
}
/** The page's own body: the first element the view draws, which must be a Stack so its rows keep the page's gap. */
const isStack = (el: Element | null) => Boolean(el && el.classList.contains('flex-col') && [...el.classList].some((c) => c.startsWith('gap-')));
const tableNamed = (name: string) => screen.getByRole('table', { name });
const rowWith = (table: HTMLElement, text: string) => within(table).getAllByRole('row').find((r) => r.textContent!.includes(text))!;
/** A release's row, by the version its first cell leads with. */
const releaseRow = (table: HTMLElement, version: string) => within(table).getAllByRole('row').find((r) => r.querySelector('td .font-mono')?.textContent === version)!;
const cell = (row: Element, role: string) => row.querySelector<HTMLElement>(`td[data-mobile="${role}"]`)!;
/** What a cell says on a phone: its phone words where the column gives it some, its own otherwise. */
const phone = (td: Element) => (td.querySelector(':scope > span.hidden') ?? td).textContent!.replace('·', '').trim();

beforeEach(() => { gateway.get.mockReset(); browser(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Status', () => {
  const draw = (s: PlatformStatus = PLATFORM_STATUS) => mount(<PlatformStatusView read={statusRead(s)} />);

  it('names the running version\'s time as its tag\'s, never as a release or a deployment (F-1)', () => {
    draw();
    const running = screen.getByRole('heading', { name: 'What is running' }).closest('section, .card') as HTMLElement;
    expect(running.textContent).toContain('Tagged');
    expect(running.textContent).not.toMatch(/Released/);
    expect(running.textContent).toMatch(/runs/);
  });

  it('keeps every figure and date of the scoreboard, Activity and the doors\' Today on one line (F-3)', () => {
    draw();
    for (const name of ['Five measures with a direction, each against the week before', 'Three activity measures, each against the week before']) {
      const table = tableNamed(name);
      const dated = [...table.querySelectorAll('tbody td')].filter((td) => /Week of/.test(td.textContent!) && td.getAttribute('data-mobile') !== 'title');
      expect(dated.length).toBeGreaterThan(0);
      for (const td of dated) expect(td.getAttribute('data-num') === 'num' || td.querySelector('.whitespace-nowrap'), td.textContent!).toBeTruthy();
    }
    const doors = tableNamed('Each door\'s fault days and its run of days under 1% tool failures');
    for (const td of doors.querySelectorAll('tbody td')) {
      if (/so far/.test(td.textContent!) && td.getAttribute('data-mobile') !== 'title') expect(td.getAttribute('data-num') === 'num' || td.querySelector('.whitespace-nowrap')).toBeTruthy();
    }
  });

  it('labels each pair on a phone and keeps the door\'s run sentence as its card\'s line (F-4)', () => {
    draw();
    const score = tableNamed('Five measures with a direction, each against the week before');
    const followup = rowWith(score, 'Refusals put right');
    const facts = [...followup.querySelectorAll('td[data-mobile="fact"]')].map(phone);
    expect(facts[0]).toMatch(/^Best \S+, week of \d+ [A-Z]/);
    expect(facts[1]).toMatch(/^Last \S+/);
    const activity = tableNamed('Three activity measures, each against the week before');
    expect([...rowWith(activity, 'Sessions').querySelectorAll('td[data-mobile="fact"]')].map(phone)[0]).toMatch(/^High /);
    const doors = tableNamed('Each door\'s fault days and its run of days under 1% tool failures');
    const door = PLATFORM_STATUS.doors.state === 'ok' ? PLATFORM_STATUS.doors.data[0] : null;
    expect(phone(cell(rowWith(doors, door!.finding.text), 'title'))).toContain(door!.finding.text);
  });

  it('makes every row of what needs attention that has a page a link that says it leads there (F-5)', () => {
    draw();
    const list = screen.getByRole('list', { name: 'What needs attention' });
    for (const [i, item] of within(list).getAllByRole('listitem').entries()) {
      const need = PLATFORM_STATUS.needs.rows[i];
      if (!need.href) continue;
      const link = within(item).getByRole('link');
      expect(link.getAttribute('href')).toBe(need.href);
      expect(link.textContent).toContain(need.title);
      expect(link.querySelector('[data-goes]')).not.toBeNull();
    }
  });

  it('says one fault day in the singular and has no foot that only repeats the title (F-6)', () => {
    draw();
    const doors = tableNamed('Each door\'s fault days and its run of days under 1% tool failures');
    for (const d of PLATFORM_STATUS.doors.state === 'ok' ? PLATFORM_STATUS.doors.data : []) {
      const n = d.totals.faultDays;
      expect(phone(cell(rowWith(doors, d.finding.text), 'fact'))).toMatch(new RegExp(`^${n} ${n === 1 ? 'fault day' : 'fault days'} in `));
    }
    expect(document.querySelector('[data-needs-foot]')).toBeNull();
    const over = { ...PLATFORM_STATUS, needs: { ...PLATFORM_STATUS.needs, overflowByKind: { bugs: 2 } } } as PlatformStatus;
    document.body.innerHTML = '';
    draw(over);
    expect(document.querySelector('[data-needs-foot]')!.textContent).toBe('2 more not shown: bug reports 2.');
  });

  it('writes every date of its own in the console\'s one month style (F-6)', () => {
    draw(MEMBER_STATUS);
    const own = [...document.querySelectorAll('time, td, [data-own-bugs], dd')].map((e) => e.textContent!).join(' ');
    expect(own).toMatch(/\d Sept\b/);
  });
});

describe('Releases and a release', () => {
  const LIST = releases(10, 0);
  const served: ReleasesRead = { state: 'ok', path: releasesPath(RELEASES_DEFAULTS), data: LIST };
  const table = () => tableNamed('Releases with what was observed either side of each');
  const [NEWEST, PAIRED, , , OLDEST] = RELEASES.map((r) => r.version);

  it('keeps its rows a gap apart, on the list and on a release (F-9)', () => {
    const { container } = mount(<PlatformReleasesView served={served} />);
    expect(isStack(container.firstElementChild)).toBe(true);
    document.body.innerHTML = '';
    const one = mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: releaseDetail(PAIRED)! }} />);
    expect(isStack(one.container.firstElementChild)).toBe(true);
  });

  it('holds the version on one line, so the table stays inside its card (F-3, F-8)', () => {
    mount(<PlatformReleasesView served={served} />);
    const version = releaseRow(table(), PAIRED).querySelector('td')!;
    expect(version.textContent).not.toMatch(/Within 72 hours/);
    expect(version.querySelector('.whitespace-nowrap')).not.toBeNull();
  });

  it('keeps a release\'s summary and client action on its phone card, then its figure in words (F-10, F-11)', () => {
    mount(<PlatformReleasesView served={served} />);
    const rows = LIST.rows.state === 'ok' ? LIST.rows.data.rows : [];
    for (const r of rows) {
      const title = cell(releaseRow(table(), r.version), 'title');
      expect(title.textContent).toContain(r.summary);
      expect(title.textContent).toContain(clientActionOf(r));
    }
    expect(cell(releaseRow(table(), OLDEST), 'title').textContent).toMatch(/Not observed before; [\d.]+ after \(partial\)/);
    expect(table().textContent).not.toContain('—');
  });

  it('gives its count tiles their unit (F-11)', () => {
    mount(<PlatformReleasesView served={served} />);
    const tile = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-split="tiles"] > .card')].find((c) => c.textContent!.startsWith(label))!;
    expect(tile('Releases').textContent).toMatch(new RegExp(`${LIST.tiles.releases}\\s*releases`));
    expect(tile('Last week').textContent).toMatch(new RegExp(`${LIST.tiles.lastWeek}\\s*release`));
    expect(tile('Latest tag').textContent).toMatch(/^Latest tag/);
    expect(TILES.latest.definition).toMatch(/not a deployment/);
  });

  it('says a release\'s summary and its upgrade notes once each (F-12)', () => {
    const r = releaseDetail(PAIRED)!;
    mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: r }} />);
    const count = (text: string) => document.body.textContent!.split(text).length - 1;
    expect(count(r.summary)).toBe(1);
    expect(count('Every client takes the new skill text on its next pull.')).toBe(1);
  });

  it('says what of a running window was observed in one range (F-13)', () => {
    const r = releaseDetail(PAIRED)!;
    const text = observedText(r.after, LIST.meta.asOf);
    expect(text.match(/ to /g)).toHaveLength(1);
    expect(text).toMatch(/^Observed \d+ of 72 hours so far: /);
    expect(text).not.toMatch(/ of \d+ \w+ \d{4},/);
    expect(NEWEST).toBeTruthy();
  });
});

describe('Bugs and a report', () => {
  const ADMIN = bugs(true, { state: null, impact: null, surface: null }, 10, 0);
  const PUBLIC = bugs(false, { state: null, impact: null, surface: null }, 100, 0);
  const served = (data = ADMIN): BugsRead => ({ state: 'ok', path: bugsPath(BUGS_DEFAULTS), data });

  it('keeps its rows a gap apart, on the queue and on a report (F-9)', () => {
    const { container } = mount(<PlatformBugsView served={served()} />);
    expect(isStack(container.firstElementChild)).toBe(true);
    document.body.innerHTML = '';
    const id = REPORTS[0].id;
    const one = mount(<PlatformBugView id={id} served={{ state: 'ok', data: bugReport(id)! }} duplicates={{ state: 'ok', data: duplicates(id)! }} />);
    expect(isStack(one.container.firstElementChild)).toBe(true);
  });

  it('draws the queue right after the tiles, before every chart (F-15)', () => {
    mount(<PlatformBugsView served={served()} />);
    const queue = tableNamed('Bug reports, newest filed first');
    const chart = screen.getByRole('heading', { name: 'Filed by week' });
    expect(queue.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('titles a member\'s withheld reports by surface, impact and filed date, each told apart, with no reporter\'s word (F-14)', () => {
    const rows = PUBLIC.queue.state === 'ok' ? PUBLIC.queue.data.rows : [];
    for (const r of rows) {
      expect(r.title).toContain(formatDate(r.filedAt));
      expect(r.title).toContain(r.surface ?? 'no surface named');
      expect(r.title.toLowerCase()).toContain({ blocks_work: 'blocks work', wrong_result: 'wrong result', confusing: 'confusing', cosmetic: 'cosmetic' }[r.impact]);
    }
    const own = REPORTS.filter((r) => r.team === 'atlas').map((r) => rows.find((x) => x.id === r.id)!.title);
    expect(new Set(own).size).toBe(own.length);
    const unnamed = rows.filter((r) => r.surface === null).map((r) => r.title);
    expect(new Set(unnamed).size).toBe(unnamed.length);
    const words = JSON.stringify(PUBLIC);
    for (const r of REPORTS) expect(words).not.toContain(r.title);
  });

  it('titles a report\'s page by the report itself, and spells its surface as the queue does (F-16)', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      const [, , , id, sub] = path.split('/');
      return sub === 'duplicates' ? duplicates(id) : bugReport(id);
    });
    const report = REPORTS[0];
    const page = await markupOf(PlatformBugPage({ params: Promise.resolve({ id: report.id }) }));
    expect(page.querySelector('h1')!.textContent).toContain(report.title);
    const row = (ADMIN.queue.state === 'ok' ? ADMIN.queue.data.rows : []).find((r) => r.id === report.id) as AdminBugRow;
    expect(bugReport(report.id)!.surface).toBe(row.surface);
    expect(page.textContent).not.toContain('core:Document_Approve');
  });
});
