import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { cloneElement, isValidElement, Suspense, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The router as the address writer sees it: a replace lands in the address and tells its readers, as a navigation does. */
const nav = vi.hoisted(() => ({ subs: new Set<() => void>() }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
    replace(url: string) { window.history.replaceState(null, '', url); nav.subs.forEach((f) => f()); },
  }),
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  gate: async () => null,
  chromeAccess: async () => ({ only: ['/runs'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava.lindqvist@example.com' }),
}));

import { refusal } from '@/app.config';
import { GatewayError } from '@/data/gateway';
import type { Runs } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { formatKb } from '@/lib/format-units';
import { READ_BOUND_MS } from '@/views/context';
import { RunsActions, RunsView } from '@/views/pages/runs';
import { RUNS_DEFAULTS, filtersOfPath, runsPath, stateCellOf, stateOf, type RunsRead } from '@/views/runs-context';
import RunsLoading from '../app/(dash)/runs/loading';
import RunsPage from '../app/(dash)/runs/page';
import { readRuns } from '../app/(dash)/runs/read-runs';
import { ME } from '../scripts/fake-gateway/people.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * Runs as the person reads it (Task I-110), drawn from the fake gateway's own answers, the ones `pnpm verify` serves
 * the page: the three tiles, the runs by skill in the gateway's order, the recent runs with their initiative and their
 * state, the skill control and the pages of recent runs each read on the console's server, and every state. Every
 * count and date here is read off the answer itself, never worked out beside it.
 */
const answer = (path: string) => runs(ME, new URLSearchParams(path.split('?')[1]))[1] as Runs;
const PATH = runsPath(RUNS_DEFAULTS);
const ALL = answer(PATH);
const PLAN = runsPath({ skill: 'sdlc-plan', page: '1' });
const ok = (data: Runs, path = PATH): RunsRead => ({ state: 'ok', path, data });
const EMPTY: Runs = {
  ...ALL, since: null,
  tiles: { runs: { value: 0, why: null }, outputPerRun: { value: null, why: 'no_data', unmeasured: 0 }, largest: null },
  coverage: { coverageMs: 0, summedMs: 0, peak: 0, oneCall: 0 },
  bySkill: { state: 'ok', data: { rows: [] } },
  recent: { state: 'ok', data: { rows: [], total: 0 } },
};
const PARTIAL: Runs = {
  ...ALL,
  bySkill: { state: 'unavailable', reason: 'The runs by skill could not be read.' },
  recent: { state: 'unavailable', reason: 'The recent runs could not be read.' },
};
const bySkill = (r: Runs) => (r.bySkill.state === 'ok' ? r.bySkill.data.rows : []);
const recent = (r: Runs) => (r.recent.state === 'ok' ? r.recent.data : { rows: [], total: 0 });

/** The browser's reads: answered by `reply`, or never when it is null. */
function browser(reply: ((path: string) => [number, unknown]) | null) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!reply) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, ME] : reply(url.pathname.replace('/api/console', '') + url.search);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
/** What the browser has asked the gateway for, past who it is. */
const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'));

/** The masthead's control over the body, as the page lays them out, in the console's providers. */
function mount(served: RunsRead) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (s: RunsRead) => (
    <QueryClientProvider client={client}><Tooltip.Provider><RunsActions served={s} /><RunsView served={s} /></Tooltip.Provider></QueryClientProvider>
  );
  const rendered = render(tree(served));
  /** The navigation committing: the console's server rendered the page again, with its own read of the new address. */
  return { ...rendered, serve: (next: RunsRead) => act(() => rendered.rerender(tree(next))) };
}

/** A tile by its label: its figure as drawn (a unit is its own span, so `512 KB` reads `512KB`) and the line under it. */
function tile(label: string) {
  const head = [...document.querySelectorAll('[data-figures="read"] h2')].find((h) => h.textContent === label);
  const card = head!.closest('.card') as HTMLElement;
  return { value: card.querySelector('[data-value]')!.textContent, text: card.textContent ?? '' };
}
const tiles = () => [...document.querySelectorAll('[data-figures="read"] h2')].map((h) => h.textContent);
/** A table by its card's title, and the first cell of each of its body rows as drawn on a wide screen: a cell with
 *  other words for a phone holds both, the wide one first. */
const table = (title: string) => screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement;
const firstCell = (r: Element) => { const td = r.querySelector('td')!; return (td.firstElementChild ?? td).textContent; };
const firstCells = (t: HTMLElement) => [...t.querySelectorAll('tbody tr')].map(firstCell);
const tight = (s: string) => s.replace(/\s/g, '');

/** A server page's tree as Next hands it over: every async component awaited where it stands, in children and props. */
async function settled(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(settled));
  if (!isValidElement(node)) return node;
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (typeof type === 'function' && type.constructor.name === 'AsyncFunction') return settled(await (type as (p: unknown) => Promise<ReactNode>)(props));
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) next[k] = isValidElement(v) || Array.isArray(v) ? await settled(v as ReactNode) : v;
  return cloneElement(node, next);
}

beforeEach(() => { gateway.get.mockReset(); window.history.replaceState(null, '', '/runs'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the page', () => {
  it('reads the runs on the console\'s server for the address, and draws them under its name with the read\'s cutoff', async () => {
    gateway.get.mockImplementation(async (path: string) => (path === '/plugins' ? plugins(ME)[1] : ALL));
    browser(null);
    const tree = await settled(await RunsPage({ searchParams: Promise.resolve({}) }));
    render(<QueryClientProvider client={new QueryClient()}><Tooltip.Provider><Suspense fallback={null}>{tree}</Suspense></Tooltip.Provider></QueryClientProvider>);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Runs');
    expect(gateway.get).toHaveBeenCalledWith('/runs?limit=10&offset=0');
    // The catalog beside it says where each skill's page is, so a skill's row opens it.
    expect(gateway.get).toHaveBeenCalledWith('/plugins');
    expect(screen.getByRole('link', { name: 'sdlc-spec' })).toHaveAttribute('href', '/plugins/sdlc/sdlc-spec');
    expect(screen.getByText(/^As of /)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Skill' })).toBeInTheDocument();
    expect(reads()).toEqual([]);
  });

  it('offers the skill before the server\'s read has answered, and reads nothing in the browser meanwhile', async () => {
    browser(() => [200, ALL]);
    render(<QueryClientProvider client={new QueryClient()}><RunsActions served={null} /></QueryClientProvider>);
    expect(screen.getByRole('combobox', { name: 'Skill' })).toHaveTextContent('Every skill');
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
  });

  it('reads the skill and the page the address names, and sends a session that ended to sign-in', async () => {
    gateway.get.mockResolvedValue(ALL);
    await expect(readRuns({ skill: 'sdlc-plan', page: '2' })).resolves.toMatchObject({ state: 'ok', path: '/runs?skill=sdlc-plan&limit=10&offset=10' });
    gateway.get.mockRejectedValue(new GatewayError(401, 'signed out'));
    await expect(readRuns(RUNS_DEFAULTS)).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fruns');
    gateway.get.mockRejectedValue(new GatewayError(500, 'could not read the runs'));
    await expect(readRuns(RUNS_DEFAULTS)).resolves.toEqual({ state: 'failed', path: PATH, reason: 'could not read the runs' });
  });

  it('says a read slower than its bound is slow, never an endless skeleton', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const read = readRuns(RUNS_DEFAULTS);
    await vi.advanceTimersByTimeAsync(READ_BOUND_MS);
    await expect(read).resolves.toEqual({ state: 'slow', path: PATH });
  });

  it('is loading before the gate has answered, naming the page only where the refusal lets it', () => {
    render(<RunsLoading />);
    expect(screen.getByRole('status', { name: refusal === 'absent' ? 'Loading page' : 'Loading runs' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('the tiles', () => {
  it('count the runs since the first, the observed output per run with the runs that measured none, and the largest run', () => {
    browser(null);
    mount(ok(ALL));
    expect(tiles()).toEqual(['Runs', 'Observed output per run', 'Largest run']);
    expect(tile('Runs').value).toBe(String(ALL.tiles.runs.value));
    expect(tile('Runs').text).toContain(`Since ${formatDate(ALL.since!)}`);
    expect(tile('Observed output per run').value).toBe(tight(formatKb(ALL.tiles.outputPerRun.value! / 1024)));
    expect(ALL.tiles.outputPerRun.unmeasured).toBeGreaterThan(0);
    expect(tile('Observed output per run').text).toContain(`${ALL.tiles.outputPerRun.unmeasured} not measured`);
    expect(tile('Largest run').value).toBe(tight(formatKb(ALL.tiles.largest!.bytes! / 1024)));
    expect(tile('Largest run').text).toContain(ALL.tiles.largest!.skill);
    // Each says what it counts.
    for (const label of tiles()) expect(screen.getByRole('button', { name: `About ${label}` })).toBeInTheDocument();
  });
});

describe('the runs by skill', () => {
  it('lists every skill in the gateway\'s order, by observed output per run, with its runs, calls, refusals and typical length', async () => {
    browser(null);
    mount(ok(ALL));
    const card = table('By skill');
    expect([...card.querySelectorAll('thead th')].map((h) => h.textContent)).toEqual(['Skill', 'Runs', 'Calls per run', 'Refused', 'Output per run', 'Typical length']);
    // Ten a page, as every table pages, in the order the gateway answered.
    expect(bySkill(ALL).length).toBeGreaterThan(10);
    expect(firstCells(card)).toEqual(bySkill(ALL).slice(0, 10).map((k) => k.skill));
    // A skill timed over fewer runs than it ran says what its length rests on.
    const thin = bySkill(ALL).slice(0, 10).find((k) => k.timed < k.runs)!;
    const row = [...card.querySelectorAll('tbody tr')].find((r) => firstCell(r) === thin.skill)!;
    expect(row.textContent).toContain(thin.timed ? `${thin.timed} of ${thin.runs} timed` : 'none timed');
    // The rest on the next page, still in the gateway's order.
    await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Page 2' })); });
    expect(firstCells(card)).toEqual(bySkill(ALL).slice(10).map((k) => k.skill));
    // Paging the skills is the card's own: nothing is read for it.
    expect(reads()).toEqual([]);
  });

  it('says how many runs were one call, the gateway\'s own count, under the table', () => {
    browser(null);
    mount(ok(ALL));
    expect(ALL.coverage.oneCall).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`the ${ALL.coverage.oneCall} single-call runs have no span`))).toBeInTheDocument();
  });
});

describe('the recent runs', () => {
  it('lists ten, newest last call first, each with its initiative and its state as the gateway gave it, and none running', () => {
    browser(null);
    mount(ok(ALL));
    const card = table('Recent runs');
    const rows = [...card.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(10);
    expect(recent(ALL).total).toBeGreaterThan(10);
    recent(ALL).rows.forEach((r, i) => {
      expect(firstCell(rows[i])).toBe(r.skill);
      expect(rows[i].textContent).toContain(r.initiative ?? 'No initiative');
      // A wide table's words for the state first, then a narrower one's, which adds the day the Started column leaves.
      const state = rows[i].lastElementChild!;
      expect(state.querySelector(':scope > span')?.textContent ?? state.textContent).toBe(r.state === 'last_call' ? `${stateCellOf(r)}${stateCellOf(r, { started: false })}` : stateOf(r));
      if (r.state === 'last_call') expect(state.querySelector('[title]')!.getAttribute('title')).toBe(stateOf(r));
    });
    const states = rows.map((r) => r.lastElementChild!.textContent!);
    expect(states).toContain('Active');
    expect(states).toContain('One call');
    expect(states.some((s) => s.startsWith('Last call '))).toBe(true);
    expect(document.body.textContent).not.toMatch(/running/i);
  });

  it('pages at ten, the next page read on the server and not again in the browser', async () => {
    browser((path) => [200, answer(path)]);
    const { serve } = mount(ok(ALL));
    await act(async () => { fireEvent.click(within(table('Recent runs')).getByRole('button', { name: 'Page 2' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    expect(window.location.search).toBe('?page=2');
    const next = runsPath({ skill: 'all', page: '2' });
    serve(ok(answer(next), next));
    await waitFor(() => expect(table('Recent runs').querySelectorAll('tbody tr')).toHaveLength(recent(ALL).total - 10));
    expect(reads()).toEqual([]);
  });
});

describe('the skill control', () => {
  it('narrows the whole page to a skill, read on the server and never in the browser beside it', async () => {
    browser((path) => [200, answer(path)]);
    const { serve } = mount(ok(ALL));
    await userEvent.click(screen.getByRole('combobox', { name: 'Skill' }));
    await userEvent.click(await screen.findByRole('option', { name: 'sdlc-plan' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(window.location.search).toBe('?skill=sdlc-plan');
    expect(reads()).toEqual([]);
    // Meanwhile the runs drawn stay, marked busy.
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    const narrowed = answer(PLAN);
    serve(ok(narrowed, PLAN));
    await waitFor(() => expect(tile('Runs').value).toBe(String(narrowed.tiles.runs.value)));
    expect(narrowed.tiles.runs.value).toBeLessThan(ALL.tiles.runs.value!);
    expect(firstCells(table('By skill'))).toEqual(['sdlc-plan']);
    expect(new Set(firstCells(table('Recent runs')))).toEqual(new Set(['sdlc-plan']));
    expect(reads()).toEqual([]);
  });
});

describe('the first paint of a skill\'s address', () => {
  it('draws the runs of the skill the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/runs?skill=sdlc-plan');
    browser(null);
    const plan = answer(PLAN);
    expect(recent(plan).rows.length).toBeGreaterThan(0);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><RunsActions served={ok(plan, PLAN)} /><RunsView served={ok(plan, PLAN)} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="Recent runs"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(recent(plan).rows.length);
      // The browser takes the server's markup over as it stands: no mismatch, the runs stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(recent(plan).rows.length);
      await waitFor(() => expect(within(container).getByRole('combobox', { name: 'Skill' }).textContent).toContain('sdlc-plan'));
      expect(reads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [RUNS_DEFAULTS, { skill: 'all', page: '2' }, { skill: 'sdlc-plan', page: '3' }]) expect(filtersOfPath(runsPath(f))).toEqual(f);
  });
});

describe('every state draws', () => {
  it('loading, while the server\'s read of a new address is on its way', () => {
    window.history.replaceState(null, '', '/runs?skill=sdlc-plan');
    browser(null);
    mount(ok(ALL));
    expect(screen.getByRole('status', { name: 'Loading runs' })).toHaveAttribute('aria-busy', 'true');
  });

  it('empty: no run says so in each part, and output nothing measured is never a zero', () => {
    browser(null);
    mount(ok(EMPTY));
    expect(tile('Runs').value).toBe('0');
    expect(tile('Observed output per run').value).toBe('Not measured');
    expect(tile('Largest run').value).toBe('None measured');
    expect(screen.getByText('Your team has run no skill yet')).toBeInTheDocument();
    expect(screen.getByText('No run recorded yet')).toBeInTheDocument();
  });

  it('empty for a skill: each part names the skill that has no run', () => {
    window.history.replaceState(null, '', '/runs?skill=sdlc-never');
    const path = runsPath({ skill: 'sdlc-never', page: '1' });
    browser(null);
    mount(ok(answer(path), path));
    expect(tile('Runs').value).toBe('0');
    expect(screen.getAllByText('No run of sdlc-never recorded')).toHaveLength(2);
  });

  it('error: the gateway\'s sentence and Retry, which reads again in the browser', async () => {
    browser(() => [200, ALL]);
    mount({ state: 'failed', path: PATH, reason: 'could not read the runs' });
    expect(screen.getByText('The runs did not load')).toBeInTheDocument();
    expect(screen.getByText('could not read the runs')).toBeInTheDocument();
    expect(reads()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(tiles()).toHaveLength(3));
    expect(reads()).toHaveLength(1);
  });

  it('slow: the bounded error, saying how long the read was given', () => {
    browser(null);
    mount({ state: 'slow', path: PATH });
    expect(screen.getByText(`The read did not answer within ${READ_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading runs' })).toBeNull();
  });

  it('partial: a part that could not be read says so in its place, and the tiles stand', () => {
    browser(null);
    mount(ok(PARTIAL));
    expect(screen.getByText('The runs by skill could not be read.')).toBeInTheDocument();
    expect(screen.getByText('The recent runs could not be read.')).toBeInTheDocument();
    expect(tiles()).toHaveLength(3);
  });
});

describe('the words', () => {
  it('call a run\'s bytes observed output, and never a context, tokens, a cost or a payload', () => {
    browser(null);
    mount(ok(ALL));
    expect(document.body.textContent).toContain('Observed output per run');
    expect(document.body.textContent).not.toMatch(/context|token|cost|payload/i);
  });
});
