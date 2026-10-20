import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { InitiativeList } from '@/lib/work-shapes';
import { READ_BOUND_MS } from '@/views/context';
import type { InitiativesRead } from '@/views/initiatives-context';
import { INITIATIVES_DEFAULTS, filtersOf, filtersOfPath, listPath } from '@/views/initiatives-filter';
import { InitiativeView } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { initiativeDetail, initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import InitiativesLoading from '../app/(dash)/initiatives/loading';
import InitiativesPage, { generateMetadata as listMetadata } from '../app/(dash)/initiatives/page';
import { readInitiative, readInitiatives } from '../app/(dash)/initiatives/read-initiatives';
import InitiativePage from '../app/(dash)/initiatives/[team]/[slug]/page';

/**
 * Initiatives (Task I-106, AC-5.5): the active team's work drawn from the release's Records template, from the fake
 * gateway's own answer. Three tiles over the whole team's work, its closures by week and outcome, then the table of
 * initiative, flow position from zz-core's `next_move`, state, gates passed and last touched, with no Team column. The
 * gateway filters, searches and pages it, ten to a page, and the first read of an address is the console's server's.
 */
const ME: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const listOf = (path: string) => initiativeList(ME, new URLSearchParams(path.split('?')[1]))[1] as InitiativeList;
const PATH = listPath(INITIATIVES_DEFAULTS);
const LIST = listOf(PATH);
const ok = (data: InitiativeList = LIST, path = PATH): InitiativesRead => ({ state: 'ok', path, data, team: 'atlas' });

/** The browser's reads: answered by the fake, or never when `answer` is null. */
function browser(answer: ((path: string) => [number, unknown]) | null = (p) => [200, listOf(p)]) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!answer) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = answer(url.pathname.replace('/api/console', '') + url.search);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u));

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
/** The Initiatives table, apart from the chart's own table of its columns. */
const table = () => screen.getByRole('table', { name: 'Initiatives' });
const rows = () => table().querySelectorAll('tbody tr');
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/initiatives');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the page draws the team\'s work as the gateway answered it', () => {
  it('three tiles over the whole team\'s work: open, waiting, and closed by outcome', () => {
    browser(null);
    mount(<InitiativesView served={ok()} />);
    const tile = (label: string) => screen.getAllByText(label).map((n) => n.closest('[data-tile], .card, section, article') ?? n.parentElement!)[0];
    const { open, waiting, closed } = LIST.tiles;
    expect(tile('Open').textContent).toContain(String(open));
    expect(tile('Waiting').textContent).toContain(String(waiting));
    expect(text()).toContain(`${closed.accepted} accepted, ${closed.delivered} delivered, ${closed.abandoned} abandoned`);
    expect(tile('Closed').textContent).toContain(String(closed.accepted + closed.delivered + closed.abandoned));
  });

  it('the closures by week, each column split by the outcome the platform recorded', async () => {
    browser(null);
    mount(<InitiativesView served={ok()} />);
    // The chart loads after the page's first paint.
    const chart = (await screen.findByText('Closures by week and outcome', { selector: 'caption' })).closest('table')!;
    expect([...chart.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Period', 'Accepted', 'Delivered', 'Abandoned', 'Total']);
    const weeks = LIST.closures.state === 'ok' ? LIST.closures.data : [];
    const rows = [...chart.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(weeks.length);
    const counted = rows.map((tr) => [...tr.querySelectorAll('td')].slice(0, 3).map((td) => Number(td.textContent)));
    expect(counted).toEqual(weeks.map((w) => [w.accepted.value, w.delivered.value, w.abandoned.value]));
    expect(rows.at(-1)!.querySelector('th')?.textContent).toContain('so far');
  });

  it('the table: initiative, flow position, state, gates passed and last touched, ten to a page, and no Team column', () => {
    browser(null);
    mount(<InitiativesView served={ok()} />);
    expect([...table().querySelectorAll('thead th')].map((h) => h.textContent?.trim())).toEqual(['Initiative', 'Flow position', 'State', 'Gates passed', 'Last touched']);
    expect(rows()).toHaveLength(Math.min(10, LIST.total));
    expect(LIST.total).toBeGreaterThan(10);
    expect(text()).toContain(`${LIST.total} initiatives`);
    expect(screen.getAllByRole('button', { name: 'Next page' }).length).toBeGreaterThan(0);
    // Each row opens its initiative under the team the server read the list for.
    const first = LIST.rows[0];
    expect(document.querySelector(`a[href="/initiatives/atlas/${first.slug}"]`)).not.toBeNull();
  });

  it('a filter bar of search, state and flow, its flows the population\'s own', () => {
    browser(null);
    mount(<InitiativesView served={ok()} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search initiatives');
    expect(screen.getByRole('combobox', { name: /State/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Flow/ })).toBeInTheDocument();
  });
});

describe('a filter, a search and a page are the server\'s parameters', () => {
  it('the address it reads carries them, and nothing else', () => {
    const filters = filtersOf({ state: 'quiet', flow: 'sdlc-flow', q: 'search', page: '2' });
    const p = Object.fromEntries(new URLSearchParams(listPath(filters).split('?')[1]));
    expect(p).toEqual({ state: 'quiet', flow: 'sdlc-flow', q: 'search', limit: '10', offset: '10' });
  });

  it('the browser reads nothing on mount after the server, nor while a new address is the server\'s to read', async () => {
    browser();
    const { unmount } = mount(<InitiativesView served={ok()} />);
    await settle();
    expect(reads()).toEqual([]);
    unmount();
    window.history.replaceState(null, '', '/initiatives?q=search');
    mount(<InitiativesView served={ok()} />);
    await settle();
    expect(reads()).toEqual([]);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('Retry after a server read that brought nothing is the browser\'s first read, at the same address', async () => {
    browser();
    mount(<InitiativesView served={{ state: 'failed', path: PATH, reason: 'could not read the initiatives' }} />);
    expect(text()).toContain('The initiatives did not load');
    expect(text()).toContain('could not read the initiatives');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(text()).not.toContain('…');
    act(() => { screen.getByRole('button', { name: 'Retry' }).click(); });
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(reads()).toHaveLength(1);
    expect(reads()[0]).toContain(`/api/console${PATH}`);
  });

  it('a read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    mount(<InitiativesView served={{ state: 'slow', path: PATH }} />);
    expect(text()).toContain(`The read did not answer within ${READ_BOUND_MS / 1000} seconds.`);
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('no initiative yet is said, and the closures that could not be read are said, never drawn as zero', () => {
    browser(null);
    const none: InitiativeList = { ...LIST, rows: [], total: 0, closures: { state: 'unavailable', reason: 'zz-core did not answer' } };
    mount(<InitiativesView served={ok(none)} />);
    expect(text()).toContain('No initiative yet');
    expect(text()).toContain('The closures could not be read');
  });
});

describe('the first paint of a searched address', () => {
  it('draws the search and the rows the server read, then hydrates onto the same markup', async () => {
    const q = LIST.rows[0]!.slug;
    window.history.replaceState(null, '', `/initiatives?q=${q}`);
    browser(null);
    const path = listPath({ ...INITIATIVES_DEFAULTS, q });
    const found = listOf(path);
    expect(found.rows.length).toBeGreaterThan(0);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><InitiativesView served={ok(found, path)} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="Initiatives"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(found.rows.length);
      expect(container.querySelector<HTMLInputElement>('input[placeholder="Search initiatives"]')?.value).toBe(q);
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(found.rows.length);
      await settle();
      expect(reads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [INITIATIVES_DEFAULTS, { ...INITIATIVES_DEFAULTS, page: '2' }, { q: 'search', state: 'waiting', flow: 'sdlc', page: '3' }]) {
      expect(filtersOfPath(listPath(f))).toEqual(f);
    }
  });
});

describe('the reads on the console\'s server', () => {
  const answer = (path: string) => (path === '/me' ? ME : path.startsWith('/initiatives?') ? listOf(path) : initiativeDetail('atlas', path.split('/').at(-1)!));

  it('read the address\'s page of the list with the team the person acts for, and an initiative with it', async () => {
    gateway.get.mockImplementation(async (path: string) => answer(path));
    expect(await readInitiatives(filtersOf({ state: 'quiet' }))).toEqual({ state: 'ok', path: '/initiatives?state=quiet&limit=10&offset=0', data: listOf('/initiatives?state=quiet&limit=10&offset=0'), team: 'atlas' });
    const one = await readInitiative('atlas', '2026-09-28-search-relevance');
    expect(one).toMatchObject({ state: 'ok', team: 'atlas', data: initiativeDetail('atlas', '2026-09-28-search-relevance') });
    expect(gateway.get).toHaveBeenCalledWith('/initiatives/atlas/2026-09-28-search-relevance');
  });

  it('say a failure and an address no initiative has, and never reject', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return ME;
      throw path.startsWith('/initiatives?') ? new GatewayError(500, 'could not read the initiatives') : new GatewayError(404, 'HTTP 404');
    });
    expect(await readInitiatives(INITIATIVES_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'could not read the initiatives' });
    expect(await readInitiative('atlas', 'nonesuch')).toEqual({ state: 'missing' });
  });

  it('are slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const list = readInitiatives(INITIATIVES_DEFAULTS);
    const one = readInitiative('atlas', '2026-09-28-search-relevance');
    await vi.advanceTimersByTimeAsync(READ_BOUND_MS);
    expect(await list).toEqual({ state: 'slow', path: PATH });
    expect(await one).toEqual({ state: 'slow' });
  });
});

/** The text a server page's answer renders. */
async function markupOf(page: ReactNode | Promise<ReactNode>): Promise<string> {
  const node = await page;
  let out = '';
  await act(async () => { out = mount(<>{node}</>).container.textContent ?? ''; });
  await settle();
  return document.body.textContent ?? out;
}

describe('the routes', () => {
  beforeEach(() => {
    browser(null);
    gateway.get.mockImplementation(async (path: string) => (path === '/me' ? ME : path.startsWith('/initiatives?') ? listOf(path) : initiativeDetail('atlas', path.split('/').at(-1)!)));
  });

  it('Initiatives is titled, and drawn from the server\'s read of its address', async () => {
    expect(await listMetadata()).toMatchObject({ title: 'Initiatives' });
    const shown = await markupOf(InitiativesPage({ searchParams: Promise.resolve({ state: 'waiting' }) }));
    expect(gateway.get).toHaveBeenCalledWith('/initiatives?state=waiting&limit=10&offset=0');
    expect(shown).toContain('Every piece of work your active team has open or closed');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('an initiative is drawn from the server\'s read, its documents beside Close', async () => {
    await markupOf(InitiativePage({ params: Promise.resolve({ team: 'atlas', slug: '2026-10-08-result-explanations' }) }));
    expect(gateway.get).toHaveBeenCalledWith('/initiatives/atlas/2026-10-08-result-explanations');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close initiative' })).toBeInTheDocument());
    expect(within(screen.getByRole('table', { name: /Documents/ })).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('an address no initiative has says so, with the way back', () => {
    mount(<InitiativeView team="atlas" slug="nonesuch" served={{ state: 'missing' }} />);
    expect(text()).toContain('No initiative called nonesuch');
    expect(screen.getByRole('link', { name: 'All initiatives' })).toHaveAttribute('href', '/initiatives');
  });

  it('Initiatives waits on its tiles, its chart and its table, naming nothing a refused address would', () => {
    const { container } = render(<InitiativesLoading />);
    expect(container.querySelectorAll('.card').length).toBeGreaterThanOrEqual(5);
    expect(container.textContent).not.toMatch(/initiative/i);
  });
});
