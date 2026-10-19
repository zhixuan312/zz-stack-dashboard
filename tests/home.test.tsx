import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tooltip } from 'radix-ui';
import { cloneElement, isValidElement, Suspense, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ refresh: vi.fn(), redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); }) }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
  redirect: router.redirect,
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  gate: async () => null,
  chromeAccess: async () => ({ only: ['/'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava.lindqvist@example.com' }),
}));
/** The live stream as the frame and the console's live provider see it: the bell's registration, and the refresh it is handed. */
const live = vi.hoisted(() => ({ registered: [] as string[][], refresh: null as null | ((names: string[]) => Promise<void>) }));
vi.mock('@/lib/live', () => ({
  useLive: (names: string[]) => { live.registered.push(names); return 'live'; },
  LiveProvider: ({ refresh, children }: { refresh: (names: string[]) => Promise<void>; children: ReactNode }) => { live.refresh = refresh; return children; },
}));

import { refusal } from '@/app.config';
import { SurfaceOverride } from '@/components/base/surface';
import { ConsoleTools } from '@/console/frame';
import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { Approvals, Home } from '@/lib/work-shapes';
import { ConsoleLive } from '@/views/console-live';
import { HOME_BOUND_MS, type HomeRead } from '@/views/home-context';
import { HomeView } from '@/views/pages/home';
import { formatDay } from '@/lib/format-date';
import HomeLoading from '../app/(dash)/(home)/loading';
import HomePage from '../app/(dash)/(home)/page';
import { readHome } from '../app/(dash)/(home)/read-home';
import { ME } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';

/**
 * Home as the person reads it, drawn from the read the page makes on the console's server. The weeks come from the fake
 * gateway's own answer, the one `pnpm verify` serves the page: atlas's plain week with four revisions waiting, beacon's
 * first observed week with one, and the other states built from them here: a quiet week, an empty team, and a read
 * whose parts failed one by one.
 */
const ATLAS = homeOf('atlas', ME.email);
const BEACON = homeOf('beacon', ME.email);
const ok = (home: Home, team: string | null = 'atlas'): HomeRead => ({ state: 'ok', home, team });
/** The fixture's weeks move with the day it is run: every date and count here is read off its own answer. */
const LAST = formatDay(ATLAS.tiles.closed.window.from);
const value = (p: { figure: { value: number | null } }) => String(p.figure.value);
const FIRST_WEEK = ATLAS.words.state === 'ok' ? formatDay(ATLAS.words.data.weeks[0].window.from) : '';
const MINE_LAST = ATLAS.approvals.state === 'ok' ? ATLAS.approvals.data.weeks.find((w) => w.window.from === ATLAS.tiles.closed.window.from)! : null;
const OPEN = ATLAS.openWork.state === 'ok' ? ATLAS.openWork.data : { rows: [], quiet: 0, total: 0 };
const CLOSED = ATLAS.closedLastWeek.state === 'ok' ? ATLAS.closedLastWeek.data : [];

const QUIET: Home = {
  ...ATLAS,
  title: { sentence: 'A quieter week: 2 pieces of work closed', rule: 7 },
  waiting: { state: 'ok', data: { count: 0, oldestSince: null, one: null } },
  runs: { state: 'ok', data: { active: [], more: 0, lastRunAt: new Date(Date.parse(ATLAS.meta.asOf) - 3 * 3_600_000).toISOString() } },
};
const none = (weeks: Home['tiles']['closed'][]) => weeks.map((w) => ({ ...w, figure: { value: null, why: 'no_data' as const }, numerator: null }));
const WEEKS = ATLAS.words.state === 'ok' ? ATLAS.words.data.weeks : [];
const EMPTY: Home = {
  ...ATLAS,
  title: { sentence: 'Your work at a glance', rule: 'fallback' },
  waiting: { state: 'ok', data: { count: 0, oldestSince: null, one: null } },
  words: { state: 'ok', data: { weeks: none(WEEKS), finding: null, coverage: { documents: 0, revisions: 0, importMade: 0, unrecorded: 0, mixed: 0, datedByLastWrite: 0, undated: 0, missingLegacy: 0 } } },
  approvals: { state: 'ok', data: { weeks: none(WEEKS), finding: null } },
  foot: { estimate: null, coverageMs: { value: null, why: 'no_data' }, peak: { value: null, why: 'no_data' } },
  tiles: {
    closed: { ...ATLAS.tiles.closed, figure: { value: 0, why: null }, numerator: 0 },
    medianHoursToClose: { ...ATLAS.tiles.medianHoursToClose, figure: { value: null, why: 'no_data' }, denominator: 0 },
    searchesWithResults: { ...ATLAS.tiles.searchesWithResults, figure: { value: null, why: 'no_data' }, numerator: 0, denominator: 0 },
    agentDays: { ...ATLAS.tiles.agentDays, figure: { value: 0, why: null }, numerator: 0 },
  },
  runs: { state: 'ok', data: { active: [], more: 0, lastRunAt: null } },
  openWork: { state: 'ok', data: { rows: [], quiet: 0, total: 0 } },
  closedLastWeek: { state: 'ok', data: [] },
};
const gone = { state: 'unavailable', reason: 'query_failed' } as const;
const PARTIAL: Home = {
  ...ATLAS,
  waiting: gone, words: gone, runs: gone, milestones: gone, closedLastWeek: gone,
  foot: { estimate: null, coverageMs: { value: null, why: 'unavailable' }, peak: { value: null, why: 'unavailable' } },
  tiles: { ...ATLAS.tiles, searchesWithResults: { ...ATLAS.tiles.searchesWithResults, figure: { value: null, why: 'unavailable' }, numerator: null, denominator: null } },
};

/** The view as the shell holds it: the tooltips, and the console's surface with an assistant when `ask` is given. */
const draw = (read: HomeRead, ask?: (q: string) => void) =>
  render(<SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><HomeView read={read} /></Tooltip.Provider></SurfaceOverride>);
const halves = () => [...document.querySelectorAll('[data-figures] [data-figure]')] as HTMLElement[];
const tile = (label: string) => screen.getByText(label).closest('.card') as HTMLElement;

beforeEach(() => { router.refresh.mockReset(); router.redirect.mockClear(); gateway.get.mockReset(); live.registered = []; live.refresh = null; });
afterEach(() => vi.useRealTimers());

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

describe('the page', () => {
  it('is headed by the gateway\'s sentence as it wrote it, under the page\'s name, with the read\'s own cutoff', async () => {
    gateway.get.mockResolvedValue(ATLAS);
    const tree = await settled(await HomePage());
    render(<Tooltip.Provider><Suspense fallback={null}>{tree}</Suspense></Tooltip.Provider>);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe(`Home: ${ATLAS.title.sentence}`);
    expect(document.querySelector('[data-title]')!.textContent).toBe(ATLAS.title.sentence);
    expect(gateway.get).toHaveBeenCalledWith('/home');
    expect(screen.getByText(/^As of /)).toBeInTheDocument();
  });

  it('leaves the name to head the page when the read brought no sentence', async () => {
    gateway.get.mockRejectedValue(new GatewayError(503, 'down'));
    const tree = await settled(await HomePage());
    render(<Tooltip.Provider><Suspense fallback={null}>{tree}</Suspense></Tooltip.Provider>);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Home: ');
    expect(screen.getByText('Home did not load')).toBeInTheDocument();
  });

  it('is loading before the gate has answered, the sentence\'s block held where the refusal lets it name the page', () => {
    render(<HomeLoading />);
    expect(screen.getByRole('status', { name: refusal === 'absent' ? 'Loading page' : 'Loading home' })).toHaveAttribute('aria-busy', 'true');
    if (refusal === 'explain') expect(document.querySelector('[data-title-pending]')).not.toBeNull();
  });
});

describe('the read on the server', () => {
  it('is Home and the team the gate named', async () => {
    gateway.get.mockResolvedValue(ATLAS);
    expect(await readHome()).toEqual({ state: 'ok', home: ATLAS, team: 'atlas' });
  });

  it('says it failed, or that it took longer than its bound, and never waits past it', async () => {
    gateway.get.mockRejectedValue(new GatewayError(500, 'could not read home'));
    expect(await readHome()).toEqual({ state: 'failed' });
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const pending = readHome();
    await vi.advanceTimersByTimeAsync(HOME_BOUND_MS);
    expect(await pending).toEqual({ state: 'slow' });
  });

  it('sends a session that ended since the gate to sign-in', async () => {
    gateway.get.mockRejectedValue(new GatewayError(401, 'not signed in'));
    await expect(readHome()).rejects.toThrow('NEXT_REDIRECT /login?next=%2F');
  });
});

describe('what waits', () => {
  it('is a Banner of the count and the oldest, opening Approvals, when two or more wait', () => {
    draw(ok(ATLAS));
    const banner = screen.getByRole('status');
    expect(within(banner).getByText('4 revisions wait for approval')).toBeInTheDocument();
    expect(within(banner).getByText(/^Presented and not yet approved, the oldest since \d+ \w+\.$/)).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Open Approvals' })).toHaveAttribute('href', '/approvals');
  });

  it('names the one revision and opens its document when one waits', () => {
    draw(ok(BEACON, 'beacon'));
    const banner = screen.getByRole('status');
    expect(within(banner).getByText('spec.md, version 1, waits for approval')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/initiatives/beacon/2026-09-30-refund-flow/spec.md');
  });

  it('is absent when nothing waits, and says so when the queue could not be read rather than reading as an all-clear', () => {
    const { unmount } = draw(ok(QUIET));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    draw(ok(PARTIAL));
    expect(screen.getByRole('status')).toHaveTextContent('What waits for approval could not be read');
  });
});

describe('the paired figures', () => {
  it('are one Featured metric of two halves: last week\'s words and approvals in your name, each with its finding', () => {
    draw(ok(ATLAS));
    const [words, mine] = halves();
    expect(halves()).toHaveLength(2);
    expect(words.querySelector('[data-value]')!.textContent).toBe('15,400');
    expect(words.textContent).toContain('Words added · last week');
    expect(words.querySelector('[data-finding]')!.textContent).toBe(ATLAS.words.state === 'ok' ? ATLAS.words.data.finding!.text : '');
    expect(mine.querySelector('[data-value]')!.textContent).toBe(value(MINE_LAST!));
    expect(mine.textContent).toContain('Approvals in your name · last week');
    expect(mine.querySelector('[data-finding]')).toBeNull();
  });

  it('draws each by week, a week with no recorded words as none and the running week unfinished, never a zero', () => {
    draw(ok(ATLAS));
    const columns = halves()[0].querySelectorAll('[data-column]');
    expect(columns).toHaveLength(WEEKS.length);
    WEEKS.forEach((w, i) => expect(columns[i].hasAttribute('data-no-data'), w.window.from).toBe(w.figure.value === null));
    expect(columns[columns.length - 1].hasAttribute('data-running')).toBe(true);
  });

  it('feet the writing estimate, marked estimated at its pace, the run coverage and the peak, and how it is estimated', () => {
    draw(ok(ATLAS));
    const foot = document.querySelector('[data-foot]')!;
    expect(foot.textContent).toContain('One person, writing this31 hestimated at 500 words an hour');
    expect(foot.textContent).toContain('Observed run coverage3.5 h');
    expect(foot.textContent).toContain('Peak concurrency1 at once');
    expect(within(foot as HTMLElement).getByRole('link', { name: 'How it is estimated' })).toHaveAttribute('href', '/record');
  });

  it('says a half that could not be read is unavailable, and the estimate with it, never a zero', () => {
    draw(ok(PARTIAL));
    const [words, mine] = halves();
    expect(words.querySelector('[data-value]')!.textContent).toBe('Unavailable');
    expect(words.textContent).toContain('The words added could not be read.');
    expect(words.querySelector('[data-column]')).toBeNull();
    expect(mine.querySelector('[data-value]')!.textContent).toBe(value(MINE_LAST!));
    const foot = document.querySelector('[data-foot]')!.textContent!;
    expect(foot).toContain('One person, writing thisUnavailable');
    expect(foot).toContain('Observed run coverageUnavailable');
  });

  it('reads an empty week as none recorded, in the figure and in the foot', () => {
    draw(ok(EMPTY));
    const [words, mine] = halves();
    expect(words.querySelector('[data-value]')!.textContent).toBe('No words recorded');
    expect(mine.querySelector('[data-value]')!.textContent).toBe('No approvals recorded');
    expect(document.querySelector('[data-foot]')!.textContent).toContain('Peak concurrencyNo runs recorded');
  });

  it('carries Ask in its head row, asking about last week, then about the week the cursor points at', async () => {
    const ask = vi.fn();
    draw(ok(ATLAS), ask);
    const card = halves()[0].closest('section')!;
    const button = await within(card).findByRole('button', { name: /^Ask: / });
    expect(card.firstElementChild!.contains(button)).toBe(true);
    expect(button).toHaveAccessibleName(`Ask: What stands out in last week, the week of ${LAST}, and why?`);
    const plot = within(halves()[0]).getByRole('group');
    fireEvent.keyDown(plot, { key: 'Home' });
    const pointed = await within(card).findByRole('button', { name: `Ask: What happened in the week of ${FIRST_WEEK}, in words added and approvals in my name?` });
    // The halves keep last week's figure while a week is pointed at: no pill row appears, so nothing below them moves.
    expect(card.querySelector('[data-point]')).toBeNull();
    expect(halves()[0].querySelector('[data-value]')!.textContent).toBe('15,400');
    fireEvent.click(pointed);
    expect(ask).toHaveBeenCalledWith(`What happened in the week of ${FIRST_WEEK}, in words added and approvals in my name?`);
  });

  it('carries no Ask when the console offers no assistant', () => {
    draw(ok(ATLAS));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the tiles', () => {
  it('are the four of last week, each with its count', () => {
    draw(ok(ATLAS));
    expect(tile('Work closed').querySelector('.t-figure')!.textContent).toBe(value(ATLAS.tiles.closed));
    // The unit is the figure's own span, set apart by the card: `484` and `h`.
    expect(tile('Median hours to close').querySelector('.t-figure')!.textContent).toBe('484h');
    expect(tile('Median hours to close')).toHaveTextContent(`Over ${ATLAS.tiles.medianHoursToClose.denominator} piece`);
    expect(tile('Searches with results').querySelector('.t-figure')!.textContent).toBe('75%');
    expect(tile('Searches with results')).toHaveTextContent('12 of 16 searches');
    expect(tile('Days your agents ran').querySelector('.t-figure')!.textContent).toBe('6');
    expect(tile('Days your agents ran')).toHaveTextContent(`Of 7 days, the week of ${LAST}`);
  });

  it('say a figure that was not worked out is unavailable, and one with nothing to measure says so', () => {
    const { unmount } = draw(ok(PARTIAL));
    expect(tile('Searches with results')).toHaveTextContent('Unavailable');
    expect(tile('Searches with results')).toHaveTextContent(`Not worked out for the week of ${LAST}`);
    unmount();
    draw(ok(EMPTY));
    expect(tile('Median hours to close')).toHaveTextContent('Nothing closed');
    expect(tile('Work closed').querySelector('.t-figure')!.textContent).toBe('0');
  });
});

describe('the lists', () => {
  it('draw the runs active now, four groups and the rest counted', () => {
    draw(ok(ATLAS));
    const runs = screen.getByText('Runs active now').closest('.card') as HTMLElement;
    expect(within(runs).getByText('2026-09-28-search-relevance')).toBeInTheDocument();
    expect(within(runs).getByText(/^sdlc-spec-audit, started /)).toBeInTheDocument();
    expect(within(runs).getByRole('link', { name: /1 more run on Runs/ })).toHaveAttribute('href', '/runs');
  });

  it('say when the last run ended when none is active, and that none is recorded on an empty team', () => {
    const { unmount } = draw(ok(QUIET));
    expect(document.querySelector('[data-last-run]')!.textContent).toBe('No run is active now. The last ended 3 h ago.');
    unmount();
    draw(ok(EMPTY));
    expect(document.querySelector('[data-last-run]')!.textContent).toBe('No run is active now, and none is recorded yet.');
  });

  it('draw the next milestones as a Bar list, each with how far there is to go', () => {
    draw(ok(ATLAS));
    const list = screen.getByRole('list', { name: 'Next milestones' });
    // Most of the way there first, as the Bar list ranks them: 41 of 100 documents, 4 of 10 closures, 56,600 of a
    // million words, and the lessons just past their tenth, none of the way from 10 to 25.
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Documents created59 to go to 10041%',
      'Pieces of work closed6 to go to 1040%',
      'Words added943,400 to go to 1,000,0006%',
      'Lessons adopted15 to go to 250%',
    ]);
  });

  it('draw open work waiting first, each with its next move and gates, the quiet folded, and a foot to Initiatives', () => {
    draw(ok(ATLAS));
    const open = screen.getByText('Open work').closest('.card') as HTMLElement;
    expect([...open.querySelectorAll('[data-next-move]')].map((n) => n.textContent)).toEqual(OPEN.rows.map((r) => `Approve ${r.nextMove!.document}, waiting on a person`));
    const first = OPEN.rows[0];
    expect(within(open).getByRole('link', { name: new RegExp(`^${first.slug}`) })).toHaveAttribute('href', `/initiatives/atlas/${first.slug}`);
    expect(within(open).getAllByText(`${first.gates.passed} of ${first.gates.of} gates`).length).toBeGreaterThan(0);
    expect(OPEN.quiet).toBeGreaterThan(1);
    expect(within(open).getByRole('link', { name: `${OPEN.quiet} quiet initiatives, untouched for 14 days or more` })).toHaveAttribute('href', '/initiatives?state=quiet');
    expect(within(open).getByRole('link', { name: new RegExp(`All ${OPEN.total} on Initiatives`) })).toHaveAttribute('href', '/initiatives');
  });

  it('draw what closed last week with its outcome, and the line to Record', () => {
    draw(ok(ATLAS));
    const closed = screen.getByText('Closed last week').closest('.card') as HTMLElement;
    expect(CLOSED.length).toBeGreaterThan(0);
    for (const c of CLOSED) {
      const row = within(closed).getByText(c.slug).closest('a')!;
      expect(row).toHaveAttribute('href', `/initiatives/atlas/${c.slug}`);
      expect(row).toHaveTextContent(`${c.outcome[0].toUpperCase()}${c.outcome.slice(1)}`);
    }
    expect(document.querySelector('[data-record-line]')).toHaveAttribute('href', '/record');
  });

  it('say an empty team has nothing open and nothing closed', () => {
    draw(ok(EMPTY));
    expect(screen.getByText('Nothing is open')).toBeInTheDocument();
    expect(screen.getByText('Nothing closed last week')).toBeInTheDocument();
  });

  it('draw a part that could not be read as its own unavailable state, and the rest stands', () => {
    draw(ok(PARTIAL));
    expect(screen.getByText('The runs could not be read')).toBeInTheDocument();
    expect(screen.getByText('The milestones could not be read')).toBeInTheDocument();
    expect(screen.getByText('Last week\'s closures could not be read')).toBeInTheDocument();
    expect(screen.getByText('Open work').closest('.card')!.querySelectorAll('[data-next-move]').length).toBeGreaterThan(0);
  });
});

describe('the weeks the title speaks of', () => {
  it('draws a first week and a quiet week as the gateway titled them, with the figures they have', () => {
    const { unmount } = draw(ok(BEACON, 'beacon'));
    expect(halves()).toHaveLength(2);
    expect(screen.getByText('Nothing closed last week')).toBeInTheDocument();
    unmount();
    draw(ok(QUIET));
    expect(halves()[0].querySelector('[data-value]')!.textContent).toBe('15,400');
  });
});

describe('a read that did not answer', () => {
  it('is the error state with Retry, which reads again on the server', () => {
    draw({ state: 'failed' });
    expect(screen.getByText('Home did not load')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('says a slow read is unavailable after its bound, never an endless skeleton', () => {
    draw({ state: 'slow' });
    expect(screen.getByText('Home is unavailable')).toBeInTheDocument();
    expect(screen.getByText(`The platform did not answer within ${HOME_BOUND_MS / 1000} seconds. Nothing on this page was read.`)).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});

describe('the bell', () => {
  const asMe: Me = { ...ME, activeTeam: 'atlas' };
  const [, queue] = approvals(asMe, new URLSearchParams('tab=waiting&limit=100')) as [number, Approvals];
  let calls: string[];

  function mount() {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const body = url.endsWith('/me') ? { ...asMe, mayRead: true } : url.includes('/approvals') ? queue : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ConsoleLive><ConsoleTools /></ConsoleLive></QueryClientProvider>);
  }
  afterEach(() => vi.unstubAllGlobals());

  it('counts what waits as Approvals\' Waiting does, from its answer, each opening its document', async () => {
    mount();
    const waiting = queue.waiting.state === 'ok' ? queue.waiting.data : null;
    expect(waiting!.total).toBe(queue.tiles.waiting);
    await screen.findByRole('button', { name: `Alerts, ${queue.tiles.waiting} new` });
    expect(calls.some((u) => u.startsWith('/api/console/approvals?tab=waiting&limit=100'))).toBe(true);
    expect(live.registered.at(-1)).toEqual(['initiatives']);
  });

  it('reads Approvals again when the stream says initiatives changed, which an approval does', async () => {
    mount();
    await screen.findByRole('button', { name: /^Alerts, \d+ new$/ });
    const before = calls.filter((u) => u.includes('/approvals')).length;
    await act(async () => { await live.refresh!(['initiatives']); });
    await waitFor(() => expect(calls.filter((u) => u.includes('/approvals')).length).toBeGreaterThan(before));
    const after = calls.filter((u) => u.includes('/approvals')).length;
    await act(async () => { await live.refresh!(['knowledge']); });
    expect(calls.filter((u) => u.includes('/approvals')).length).toBe(after);
  });
});
