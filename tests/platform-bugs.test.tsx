import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The router as the address writer sees it: a replace lands in the address, as a navigation does. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { GatewayError } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import type { Me } from '@/lib/api-shapes';
import type { AdminBugRow, Bugs } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { PlatformBugView } from '@/views/pages/platform-bug';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import {
  BUGS_BOUND_MS, BUGS_DEFAULTS, bugContext, bugPath, bugsContext, bugsPath, duplicatesPath, filtersOfPath, formatHours, lastWhole, rateIn, waited,
  type BugsFilters, type BugsRead, type DuplicatesRead,
} from '@/views/platform-bugs-context';
import { bugTool, bugsTool } from '@/views/tools/bugs';
import { REPORTS, bugReport, bugs, duplicates } from '../scripts/fake-gateway/platform-bugs.ts';
import PlatformBugsLoading from '../app/(dash)/platform/bugs/loading';
import PlatformBugsPage, { generateMetadata as bugsMetadata } from '../app/(dash)/platform/bugs/page';
import { readBug, readBugs, readDuplicates } from '../app/(dash)/platform/bugs/read-bugs';
import PlatformBugLoading from '../app/(dash)/platform/bugs/[id]/loading';
import PlatformBugPage, { generateMetadata as bugMetadata } from '../app/(dash)/platform/bugs/[id]/page';

/**
 * Bugs under Platform (Task I-97): the queue and a report's page drawn from the fake gateway's own answers, each read
 * first on the console's server; the four tiles, filed and resolved by the week filed on one cursor, the outcomes, the
 * impacts and the median by week filed; the queue's three filters read on the server for the new address; a member's
 * rows that open nothing and a member refused a report's page; the resolve form, whose duplicate choice is the duplicates
 * read's alone, which keeps what was typed on a refusal and asks a target of a duplicate; every state each page draws;
 * the Ask on each page's protagonist; the view tools answering the pages' own responses; and the prepared query.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};
const MEMBER: Me = {
  email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false,
  via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon',
};

const ID = (n: number) => `0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d0${n}`;
const OPEN = ID(1);
const DUPLICATE = ID(2);
const NO_FILTER = { state: null, impact: null, surface: null };
const PATH = bugsPath(BUGS_DEFAULTS);
const ADMIN: Bugs = bugs(true, NO_FILTER, 10, 0);
const PUBLIC: Bugs = bugs(false, NO_FILTER, 10, 0);
const ok = (data: Bugs = ADMIN, path = PATH): BugsRead => ({ state: 'ok', path, data });
const counts = ADMIN.counts.state === 'ok' ? ADMIN.counts.data : (undefined as never);
const rowsOf = (b: Bugs) => (b.queue.state === 'ok' ? b.queue.data.rows : []);
const targets = (id: string): DuplicatesRead => ({ state: 'ok', data: duplicates(id)! });
const at = { updatedAt: null, now: new Date() };

/** The browser's reads and writes: answered by `answer`, or never when it is null. */
function browser(answer: ((path: string, init?: RequestInit) => [number, unknown]) | null, me: Me = SUPERADMIN) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (!answer) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, me] : answer(url.pathname.replace('/api/console', ''), init);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
type Call = [RequestInfo | URL, RequestInit | undefined];
const calls = () => (fetch as unknown as { mock: { calls: Call[] } }).mock.calls.filter(([u]) => !String(u).endsWith('/me'));
/** What the browser has read, past who it is. */
const reads = () => calls().filter(([, init]) => (init?.method ?? 'GET') === 'GET').map(([u]) => String(u).split('?')[0]);
/** What the browser has written, as the bodies it sent. */
const writes = () => calls().filter(([, init]) => init?.method === 'POST').map(([u, init]) => [String(u), JSON.parse(String(init!.body))]);

const tree = (ui: ReactElement, ask?: (q: string) => void) => <SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>;
/** `ui` in the console's providers, with an assistant listening when `ask` is given; `serve` rerenders it as the server would. */
function mount(ui: ReactElement, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}>{tree(ui, ask)}</QueryClientProvider>);
  return { ...rendered, serve: (next: ReactElement) => rendered.rerender(<QueryClientProvider client={client}>{tree(next, ask)}</QueryClientProvider>) };
}
const tile = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-split="tiles"] > .card')].find((c) => c.textContent!.startsWith(label))!;
const queue = () => screen.getByRole('table', { name: 'Bug reports, newest filed first' });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });
/** Choose `option` in the Select named `name`. */
async function choose(name: string, option: string | RegExp) {
  fireEvent.keyDown(screen.getByRole('combobox', { name }), { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: option }), { key: 'Enter' });
}

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/platform/bugs');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Bugs draws its tiles, its weeks and its figures', () => {
  it('the four tiles: open, the oldest open, reports per 1,000 calls, the median hours to resolve with its cohort counts', () => {
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    expect(tile('Open').textContent).toContain(String(counts.open));
    expect(tile('Oldest open').textContent).toContain(waited(ADMIN.oldestOpenAt!, ADMIN.meta.asOf));
    expect(tile('Oldest open').textContent).toContain('Filed');
    const week = lastWhole(ADMIN.cohorts, ADMIN.meta.asOf)!;
    expect(tile('Reports per 1,000 calls').textContent).toContain(rateIn(week.filedPer1000));
    expect(tile('Reports per 1,000 calls').textContent).toContain('Week of');
    expect(tile('Median hours to resolve').textContent).toContain(formatHours(ADMIN.medianResolveHours.value!));
    expect(tile('Median hours to resolve').textContent).toContain(`Over ${counts.resolved} resolved; ${counts.open} still open`);
  });

  it('filed by week and resolved by week filed, two Column charts on one cursor, the running week drawn unfinished', () => {
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    const charts = [screen.getByRole('figure', { name: 'Filed by week' }), screen.getByRole('figure', { name: 'Resolved by week filed' })];
    for (const c of charts) expect(c.querySelectorAll('[data-column]')).toHaveLength(ADMIN.cohorts.length);
    fireEvent.keyDown(charts[0].querySelector('[data-plot]')!, { key: 'Home' });
    expect(charts[1].querySelector('[data-column][data-active]')?.getAttribute('data-column')).toBe(ADMIN.cohorts[0].week);
    for (const c of charts) expect(c.querySelector('[data-column]:last-child[data-running]')).not.toBeNull();
  });

  it('the outcomes as a Composition bar, the impacts as a Bar list, and the median by week filed', () => {
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    const outcomes = screen.getByRole('figure', { name: 'Outcomes' });
    for (const label of ['Open', 'Fixed', 'Not a bug', 'Duplicate']) expect(outcomes.textContent).toContain(label);
    const impact = screen.getByRole('list', { name: 'By impact' });
    expect(within(impact).getAllByRole('listitem')).toHaveLength(4);
    expect(within(impact).getByText('Blocks work').closest('li')!.textContent).toContain(String(counts.byImpact.blocks_work));
    const median = screen.getByRole('figure', { name: 'Median hours to resolve by week filed' });
    expect(median.querySelectorAll('[data-column]')).toHaveLength(ADMIN.cohorts.length);
  });
});

describe('the queue', () => {
  it('lists the superadmin\'s rows with the reporter\'s title and team, each opening its report', () => {
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    expect(within(queue()).getAllByRole('row')).toHaveLength(rowsOf(ADMIN).length + 1);
    for (const r of rowsOf(ADMIN) as AdminBugRow[]) expect(queue().textContent).toContain(r.internalTitle);
    for (const r of rowsOf(ADMIN)) expect(document.querySelector(`a[href="${bugPath(r.id)}"]`)).not.toBeNull();
  });

  it('a member\'s rows carry the generated title alone, and open nothing', () => {
    browser(null, MEMBER);
    mount(<PlatformBugsView served={ok(PUBLIC)} />);
    expect(within(queue()).getAllByRole('row')).toHaveLength(rowsOf(PUBLIC).length + 1);
    expect(queue().textContent).toContain('Report concerning document_approve');
    expect(queue().textContent).toContain('Platform issue reported');
    for (const r of REPORTS) expect(document.body.textContent).not.toContain(r.title);
    expect(document.querySelector('a[href^="/platform/bugs/"]')).toBeNull();
  });

  it('has its three filters, state, impact and surface, with the surfaces the page names', async () => {
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    for (const name of ['State', 'Impact', 'Surface']) expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Surface' }), { key: 'ArrowDown' });
    const offered = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(offered).toEqual(expect.arrayContaining(['All', 'core', 'manage', 'eval', 'console', 'document_approve', 'knowledge_search']));
  });

  it('a filter is read on the console\'s server for the new address, never in the browser beside it', async () => {
    browser(() => [200, ADMIN]);
    const { serve } = mount(<PlatformBugsView served={ok()} />);
    await settle();
    expect(reads()).toEqual([]);
    await choose('State', 'Open');
    await settle();
    expect(reads()).toEqual([]);
    expect(window.location.search).toBe('?state=open');
    const filters: BugsFilters = { ...BUGS_DEFAULTS, state: 'open' };
    expect(bugsPath(filters)).toBe('/platform/bugs?state=open&limit=10&offset=0');
    serve(<PlatformBugsView served={ok(bugs(true, { ...NO_FILTER, state: 'open' }, 10, 0), bugsPath(filters))} />);
    await waitFor(() => expect(within(queue()).getAllByRole('row')).toHaveLength(counts.open + 1));
    expect(reads()).toEqual([]);
    // The figures are over every report: the open tile is the same narrowed or not.
    expect(tile('Open').textContent).toContain(String(counts.open));
  });
});

describe('the first paint of a filtered address', () => {
  it('draws the rows of the address the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/platform/bugs?state=open');
    browser(null);
    const open = bugs(true, { ...NO_FILTER, state: 'open' }, 10, 0);
    const view = <PlatformBugsView served={ok(open, bugsPath({ ...BUGS_DEFAULTS, state: 'open' }))} />;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(<QueryClientProvider client={client}>{tree(view)}</QueryClientProvider>);
      const rows = () => container.querySelectorAll('section[aria-label="Bug reports, newest filed first"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(rows()).toHaveLength(counts.open);
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => {
        hydrateRoot(container, <QueryClientProvider client={client}>{tree(view)}</QueryClientProvider>, { onRecoverableError: (e) => mismatches.push(e) });
      });
      expect(mismatches).toEqual([]);
      expect(rows()).toHaveLength(counts.open);
      await waitFor(() => expect(within(container).getByRole('combobox', { name: 'State' }).textContent).toContain('Open'));
      expect(reads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path, for every filter the path carries', () => {
    for (const f of [BUGS_DEFAULTS, { ...BUGS_DEFAULTS, page: '3' }, { state: 'resolved', impact: 'blocks_work', surface: 'document_write', page: '2' }]) {
      expect(filtersOfPath(bugsPath(f))).toEqual(f);
    }
  });
});

describe('each page draws loading, empty, error and partial', () => {
  it('Bugs: loading while the server\'s read of a filtered address is on its way', () => {
    window.history.replaceState(null, '', '/platform/bugs?impact=cosmetic');
    browser(null);
    mount(<PlatformBugsView served={ok()} />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByText('…').length).toBeGreaterThanOrEqual(4);
  });

  it('Bugs: empty, with no report and no zero drawn for a missing figure', () => {
    browser(null);
    const none: Bugs = {
      ...ADMIN, counts: { state: 'ok', data: { ...counts, open: 0, resolved: 0, byImpact: { blocks_work: 0, wrong_result: 0, confusing: 0, cosmetic: 0 }, byStatus: { open: 0, fixed: 0, not_a_bug: 0, duplicate: 0 } } },
      oldestOpenAt: null, medianResolveHours: { value: null, why: 'no_data' },
      cohorts: ADMIN.cohorts.map((c) => ({ ...c, filed: { value: 0, why: null }, resolved: { value: 0, why: null }, stillOpen: { value: 0, why: null }, medianResolveHours: { value: null, why: 'no_data' } })),
      queue: { state: 'ok', data: { rows: [], total: 0 } },
    };
    mount(<PlatformBugsView served={ok(none)} />);
    expect(screen.getByText('No bug report yet')).toBeInTheDocument();
    expect(tile('Oldest open').textContent).toContain('None open');
    expect(tile('Median hours to resolve').textContent).toContain('None resolved');
    expect(screen.getByText('No report resolved yet')).toBeInTheDocument();
  });

  it('Bugs: the error with the gateway\'s sentence and Retry, and no tile counted', () => {
    browser(null);
    mount(<PlatformBugsView served={{ state: 'failed', path: PATH, reason: 'could not read the reports' }} />);
    expect(screen.getByText('could not read the reports')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Bugs: a server read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    mount(<PlatformBugsView served={{ state: 'slow', path: PATH }} />);
    expect(screen.getByText(`The read did not answer within ${BUGS_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('Bugs: partial, the figures standing when the queue could not be listed, and the queue when the counts could not', () => {
    browser(null);
    const noQueue: Bugs = { ...ADMIN, queue: { state: 'unavailable', reason: 'the report store did not answer' } };
    const { unmount } = mount(<PlatformBugsView served={ok(noQueue)} />);
    expect(screen.getByText(/the report store did not answer/)).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Filed by week' })).toBeInTheDocument();
    expect(contextText(bugsContext(noQueue, { filters: BUGS_DEFAULTS, ...at }))).toContain('could not be listed');
    unmount();
    const noCounts: Bugs = { ...ADMIN, counts: { state: 'unavailable', reason: 'query_failed' } };
    mount(<PlatformBugsView served={ok(noCounts)} />);
    expect(tile('Open').textContent).toContain('Unavailable');
    expect(screen.getByText('The outcomes could not be counted')).toBeInTheDocument();
    expect(within(queue()).getAllByRole('row')).toHaveLength(rowsOf(ADMIN).length + 1);
  });

  it('a report: failed and slow are the bounded error with Retry; an id the browser finds missing has the way back', async () => {
    browser(null);
    const { unmount } = mount(<PlatformBugView id={OPEN} served={{ state: 'failed', reason: 'could not read a report' }} duplicates={targets(OPEN)} />);
    expect(screen.getByText('The report did not load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    unmount();
    const again = mount(<PlatformBugView id={OPEN} served={{ state: 'slow' }} duplicates={{ state: 'slow' }} />);
    expect(screen.getByText('The report is unavailable')).toBeInTheDocument();
    again.unmount();
    browser(() => [404, null]);
    mount(<PlatformBugView id={ID(9)} served={{ state: 'slow' }} duplicates={{ state: 'slow' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No report of this id is recorded')).toBeInTheDocument());
  });
});

describe('a report\'s page', () => {
  it('shows the report, what it is about and the resolve form, and nothing that deletes it', () => {
    browser(null);
    const r = bugReport(OPEN)!;
    mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: r }} duplicates={targets(OPEN)} />);
    const report = document.querySelector('[data-protagonist="Report"]')!;
    expect(report.textContent).toContain(r.title);
    expect(report.querySelector('[data-report-detail]')!.textContent).toBe(r.detail);
    expect(document.body.textContent).toContain('Blocks work');
    expect(document.body.textContent).toContain(r.team!);
    expect(screen.getByRole('radiogroup', { name: 'Outcome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve report' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('a closed report shows what was decided and the report it duplicates, and no form', () => {
    browser(null);
    const r = bugReport(DUPLICATE)!;
    mount(<PlatformBugView id={DUPLICATE} served={{ state: 'ok', data: r }} duplicates={targets(DUPLICATE)} />);
    expect(screen.getByText(r.resolution!)).toBeInTheDocument();
    expect(document.querySelector(`a[href="${bugPath(OPEN)}"]`)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve report' })).toBeNull();
  });

  it('a duplicate is chosen from the duplicates read alone, and asks for its target before it posts', async () => {
    browser((path) => (path.endsWith('/resolve') ? [204, null] : path.endsWith('/duplicates') ? [200, duplicates(OPEN)] : [200, bugReport(OPEN)]));
    mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={targets(OPEN)} />);
    await settle();
    expect(reads()).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /^Duplicate/ }));
    fireEvent.change(screen.getByLabelText(/What was decided, and why/), { target: { value: '  The same refusal as the stakeholder report.  ' } });
    // A duplicate with no target is not a whole set of arguments.
    expect(screen.getByRole('button', { name: 'Resolve report' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Duplicate of/ }), { key: 'ArrowDown' });
    const offered = (await screen.findAllByRole('option')).map((o) => o.getAttribute('data-value') ?? o.textContent);
    expect(offered).toHaveLength(duplicates(OPEN)!.rows.length);
    for (const row of duplicates(OPEN)!.rows) expect(screen.getByRole('option', { name: new RegExp(row.title) })).toBeInTheDocument();
    for (const other of REPORTS.filter((r) => r.team !== 'atlas')) expect(screen.queryByRole('option', { name: new RegExp(other.title) })).toBeNull();
    fireEvent.keyDown(screen.getByRole('option', { name: new RegExp(bugReport(DUPLICATE)!.title) }), { key: 'Enter' });
    const submit = screen.getByRole('button', { name: 'Resolve report' });
    expect(submit).toBeEnabled();
    await act(async () => { fireEvent.click(submit); });
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual([`/api/console${bugPath(OPEN)}/resolve`, { status: 'duplicate', resolution: 'The same refusal as the stakeholder report.', duplicate_of: DUPLICATE }]);
    // The write invalidates the console's reads, so the report and its targets are read again.
    await waitFor(() => expect(reads()).toEqual(expect.arrayContaining([`/api/console${bugPath(OPEN)}`, `/api/console${duplicatesPath(OPEN)}`])));
  });

  it('a fixed report posts its status and reasoning alone', async () => {
    browser((path) => (path.endsWith('/resolve') ? [204, null] : [200, path.endsWith('/duplicates') ? duplicates(OPEN) : bugReport(OPEN)]));
    mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={targets(OPEN)} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Fixed/ }));
    fireEvent.change(screen.getByLabelText(/What was decided, and why/), { target: { value: 'Fixed in 0.98.0.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resolve report' })); });
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][1]).toEqual({ status: 'fixed', resolution: 'Fixed in 0.98.0.' });
  });

  it('a refused resolution keeps what was typed and says the gateway\'s sentence', async () => {
    const sentence = 'ERROR: that report was already closed as `fixed` by somebody else — "Fixed in 0.98.0."';
    browser((path) => (path.endsWith('/resolve') ? [409, { error: sentence }] : [200, bugReport(OPEN)]));
    mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={targets(OPEN)} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Not a bug/ }));
    fireEvent.change(screen.getByLabelText(/What was decided, and why/), { target: { value: 'Works as intended.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resolve report' })); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(sentence));
    expect(screen.getByLabelText(/What was decided, and why/)).toHaveValue('Works as intended.');
    expect(screen.getByRole('radio', { name: /^Not a bug/ })).toBeChecked();
  });

  it('offers no duplicate when its targets could not be read, or when its team has no other report', () => {
    browser(null);
    const { unmount } = mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={{ state: 'failed', reason: 'could not read the targets' }} />);
    expect(screen.getByRole('radio', { name: /^Duplicate/ })).toBeDisabled();
    expect(screen.getByText(/could not read the targets/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Fixed/ })).toBeEnabled();
    unmount();
    mount(<PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={{ state: 'ok', data: { rows: [] } }} />);
    expect(screen.getByRole('radio', { name: /^Duplicate/ })).toBeDisabled();
    expect(screen.getByText('No other report of its team exists.')).toBeInTheDocument();
  });
});

describe('the Ask on each page\'s protagonist', () => {
  it('sits in the queue\'s filter bar with the assistant on, and is absent with it off', () => {
    browser(null);
    const ask = vi.fn();
    const { unmount } = mount(<PlatformBugsView served={ok()} />, ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    expect(button.closest('[data-protagonist="Queue"]')).not.toBeNull();
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(<PlatformBugsView served={ok()} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });

  it('sits in the head of a report\'s card with the assistant on, and is absent with it off', () => {
    browser(null);
    const page = <PlatformBugView id={OPEN} served={{ state: 'ok', data: bugReport(OPEN)! }} duplicates={targets(OPEN)} />;
    const { unmount } = mount(page, vi.fn());
    const [button] = screen.getAllByRole('button', { name: /^Ask: / });
    const card = button.closest('[data-protagonist="Report"]')!;
    expect(card.classList.contains('card')).toBe(true);
    expect(card.firstElementChild?.contains(button)).toBe(true);
    unmount();
    mount(page);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the view tools answer the pages\' own responses', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      if (path.startsWith('/platform/bugs?')) {
        const q = new URLSearchParams(path.split('?')[1]);
        return bugs(true, { state: q.get('state'), impact: q.get('impact'), surface: q.get('surface') }, Number(q.get('limit')), Number(q.get('offset')));
      }
      const [, , , id, sub] = path.split('/');
      const found = sub === 'duplicates' ? duplicates(id) : bugReport(id);
      if (!found) throw new GatewayError(404, 'HTTP 404');
      return found;
    });
  });

  it('view_bugs reads the page\'s address and tells the page\'s context', async () => {
    const { data, context } = await bugsTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual(ADMIN);
    expect({ ...context, freshness: null }).toEqual({ ...bugsContext(ADMIN, { filters: BUGS_DEFAULTS, ...at }), freshness: null });
    expect(bugsTool.page).toBe('/platform/bugs');
    expect(bugsTool.needs).toBe(FEATURES.bugs.needs);
  });

  it('view_bugs takes the route\'s own filters, limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(bugsTool.input.shape).sort()).toEqual(['impact', 'limit', 'offset', 'state', 'surface']);
    const onPage = await bugsTool.read({ state: 'open', surface: 'core', limit: 10, offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/bugs?state=open&surface=core&limit=10&offset=10');
    expect(onPage.context.address).toBe('/platform/bugs?state=open&surface=core&page=2');
    const off = await bugsTool.read({ limit: 2, offset: 1 });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/bugs?limit=2&offset=1');
    expect(contextText(off.context)).toContain('The page lists the queue ten a page, so /platform/bugs does not show exactly these');
  });

  it('view_bug reads one report and its targets, as its page does, the superadmin\'s alone', async () => {
    const { data, context } = await bugTool.read({ id: OPEN });
    expect(gateway.get).toHaveBeenCalledWith(bugPath(OPEN));
    expect(gateway.get).toHaveBeenCalledWith(duplicatesPath(OPEN));
    expect(data).toEqual({ report: bugReport(OPEN), duplicates: duplicates(OPEN) });
    expect({ ...context, freshness: null }).toEqual({ ...bugContext(bugReport(OPEN)!, duplicates(OPEN), at), freshness: null });
    expect(bugTool.page).toBe('/platform/bugs/[id]');
    expect(bugTool.needs).toBe(FEATURES.bug.needs);
    expect(Object.keys(bugTool.input.shape)).toEqual(['id']);
  });

  it('explore_bugs declares bugs_filed and bugs_resolved in the caller\'s projection, with reports per 1,000 calls', () => {
    const { sources } = bugsTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ filed: 'bugs_filed', resolved: 'bugs_resolved', calls: 'platform_calls' });
    for (const s of Object.values(sources)) expect(PREPARED.find((p) => p.name === s.collection)?.route).toBe('platform');
    // Read as the caller reads the queue: a member's rows are the generated ones, under the page's own need.
    for (const name of ['bugs_filed', 'bugs_resolved']) expect(PREPARED.find((p) => p.name === name)?.needs).toBe(FEATURES.bugs.needs);
    expect(sources.filed.measures.per1000).toMatchObject({ derive: 'ratio', of: ['filed', 'calls.calls'] });
    for (const s of [sources.filed, sources.resolved]) {
      expect(s.drill.columns).toEqual(expect.arrayContaining(['id', 'title']));
      expect(s.drill.address({ id: OPEN, address: '/platform/bugs' })).toBe('/platform/bugs');
      expect(s.cannot).toContain('generated from its surface');
    }
    expect(sources.calls.facets).not.toContain('team');
    expect(bugTool.explore).toBe(bugsTool.explore);
  });
});

describe('the shared contexts carry what the pages draw, and what it cannot say', () => {
  it('Bugs: the tiles, the queue, the outcomes, the impacts and the weeks, and that a report is filed by choice', () => {
    const text = contextText(bugsContext(ADMIN, { filters: BUGS_DEFAULTS, ...at }));
    expect(text).toContain(`Open: ${counts.open}`);
    expect(text).toContain(waited(ADMIN.oldestOpenAt!, ADMIN.meta.asOf));
    expect(text).toContain(formatHours(ADMIN.medianResolveHours.value!));
    expect(text).toContain(`over ${counts.resolved} resolved; ${counts.open} still open`);
    expect(text).toContain((rowsOf(ADMIN)[0] as AdminBugRow).internalTitle.slice(0, 40));
    expect(text).toContain(`${counts.byStatus.fixed} fixed`);
    expect(text).toContain(`${counts.byImpact.blocks_work} blocks work`);
    expect(text).toContain('By the week filed, oldest first');
    expect(text).toContain('filed by choice');
    expect(text).not.toMatch(/\bfewer (reports )?(is|are) (good|better)\b/i);
  });

  it('a member\'s context names no reporter\'s words, and says so', () => {
    const text = contextText(bugsContext(PUBLIC, { filters: BUGS_DEFAULTS, ...at }));
    for (const r of REPORTS) expect(text).not.toContain(r.title);
    expect(text).toContain('Report concerning document_approve');
    expect(text).toContain('generated from its surface');
  });

  it('a narrowed queue says its figures are over every report', () => {
    const filters = { ...BUGS_DEFAULTS, state: 'open', impact: 'blocks_work' };
    const text = contextText(bugsContext(bugs(true, { ...NO_FILTER, state: 'open', impact: 'blocks_work' }, 10, 0), { filters, ...at }));
    expect(text).toContain('the queue narrowed to open, blocks work');
    expect(text).toContain('The filters narrow the queue alone');
  });

  it('a report: its words, its facts, its targets and what the assistant cannot do', () => {
    const r = bugReport(OPEN)!;
    const text = contextText(bugContext(r, duplicates(OPEN), at));
    expect(text).toContain(r.detail);
    expect(text).toContain('Blocks work');
    expect(text).toContain(bugReport(DUPLICATE)!.title.slice(0, 40));
    expect(text).toContain('changes nothing');
    const closed = contextText(bugContext(bugReport(DUPLICATE)!, duplicates(DUPLICATE), at));
    expect(closed).toContain(bugReport(DUPLICATE)!.resolution!);
    expect(closed).toContain(OPEN);
  });

  it('hold to the budget on a full page of long titles and a long report', () => {
    const long = 'A title somebody wrote in full because the report keeps what it is given and never shortens it, '.repeat(3);
    const many = Array.from({ length: 10 }, (_, i) => ({ ...(rowsOf(ADMIN)[i % rowsOf(ADMIN).length] as AdminBugRow), id: ID(i), internalTitle: long, team: `team-with-a-long-name-${i}` }));
    const full: Bugs = { ...ADMIN, queue: { state: 'ok', data: { rows: many, total: 240 } } };
    const text = contextText(bugsContext(full, { filters: { ...BUGS_DEFAULTS, page: '7' }, ...at }));
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(text).toContain('and 6 more (see the page)');
    const told = contextText(bugContext({ ...bugReport(OPEN)!, title: long, detail: `${long}\n\n`.repeat(40), resolution: long }, { rows: Array.from({ length: 20 }, (_, i) => ({ id: ID(i), title: long, status: 'open', reportedAt: ADMIN.meta.asOf })) }, at));
    expect(told.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });
});

/** The text a server page's answer renders, once rendered with nothing listening. */
async function markupOf(answer: ReactNode | Promise<ReactNode>): Promise<HTMLElement> {
  const node = await answer;
  let container = document.body;
  await act(async () => { container = mount(<>{node}</>).container; });
  return container;
}

describe('the pages on the console\'s server', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      if (path.startsWith('/platform/bugs?')) return ADMIN;
      const [, , , id, sub] = path.split('/');
      const found = sub === 'duplicates' ? duplicates(id) : bugReport(id);
      if (!found) throw new GatewayError(404, 'HTTP 404');
      return found;
    });
  });

  it('are titled as their own pages', async () => {
    expect(await bugsMetadata()).toEqual({ title: 'Bugs' });
    expect(await bugMetadata()).toEqual({ title: 'Bug report' });
  });

  it('read the address\'s queue once, as the person, and hand the one read to the as-of line and the page', async () => {
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props.read) found.push(props.read);
      Object.values(props).forEach(walk);
    };
    walk(await PlatformBugsPage({ searchParams: Promise.resolve({}) }));
    expect(found).toHaveLength(2);
    expect(found[0]).toBe(found[1]);
    expect(await found[0]).toEqual(ok());
    expect(gateway.get.mock.calls.filter(([p]) => p === PATH)).toHaveLength(1);
  });

  it('read a report and its targets together, and answer an unknown id with the missing page', async () => {
    const page = await markupOf(PlatformBugPage({ params: Promise.resolve({ id: OPEN }) }));
    expect(page.querySelector('[data-report-detail]')!.textContent).toBe(bugReport(OPEN)!.detail);
    expect(gateway.get).toHaveBeenCalledWith(duplicatesPath(OPEN));
    document.body.innerHTML = '';
    const missing = await markupOf(PlatformBugPage({ params: Promise.resolve({ id: ID(9) }) }));
    expect(missing.querySelector('[data-missing-page]')).not.toBeNull();
    expect(missing.textContent).not.toMatch(/report|bug/i);
  });

  it('wait on loading states under refusal: \'absent\' that name nothing', () => {
    for (const Loading of [PlatformBugsLoading, PlatformBugLoading]) {
      const { container, unmount } = render(<Loading />);
      expect(container.textContent).not.toMatch(/bug|report/i);
      unmount();
    }
  });
});

describe('a member asking for a report\'s page', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return MEMBER;
      throw new GatewayError(403, 'not permitted');
    });
  });

  it('is titled as an address that names nothing', async () => {
    expect(await bugMetadata()).toEqual({ title: 'Not found', robots: { index: false } });
  });

  it('is answered by the refused page, which names nothing and reads nothing', async () => {
    const page = await markupOf(PlatformBugPage({ params: Promise.resolve({ id: OPEN }) }));
    expect(page.textContent).not.toMatch(/report|bug|atlas/i);
    expect(gateway.get.mock.calls.map(([p]) => p)).not.toContainEqual(expect.stringMatching(/^\/platform\/bugs/));
  });
});

describe('the reads on the console\'s server', () => {
  it('read the address\'s queue, a report and its targets, as the person', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    expect(await readBugs(BUGS_DEFAULTS)).toEqual(ok());
    expect(gateway.get).toHaveBeenLastCalledWith(PATH);
    gateway.get.mockResolvedValueOnce(bugReport(OPEN));
    expect(await readBug(OPEN)).toEqual({ state: 'ok', data: bugReport(OPEN) });
    expect(gateway.get).toHaveBeenLastCalledWith(bugPath(OPEN));
    gateway.get.mockResolvedValueOnce(duplicates(OPEN));
    expect(await readDuplicates(OPEN)).toEqual(targets(OPEN));
    expect(gateway.get).toHaveBeenLastCalledWith(duplicatesPath(OPEN));
  });

  it('say an id that names no report and a failure, and never reject', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read the reports'));
    expect(await readBugs(BUGS_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'could not read the reports' });
    gateway.get.mockRejectedValueOnce(new GatewayError(404, 'HTTP 404'));
    expect(await readBug(ID(9))).toEqual({ state: 'missing' });
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read the targets'));
    expect(await readDuplicates(OPEN)).toEqual({ state: 'failed', reason: 'could not read the targets' });
  });

  it('are slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const list = readBugs(BUGS_DEFAULTS);
    const one = readBug(OPEN);
    const others = readDuplicates(OPEN);
    await vi.advanceTimersByTimeAsync(BUGS_BOUND_MS);
    expect(await list).toEqual({ state: 'slow', path: PATH });
    expect(await one).toEqual({ state: 'slow' });
    expect(await others).toEqual({ state: 'slow' });
  });
});
