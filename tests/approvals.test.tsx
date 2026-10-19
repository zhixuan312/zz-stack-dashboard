import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
/** What the gate answers: nothing, which lets the person in, unless a test refuses them. */
const access = vi.hoisted(() => ({ denied: null as ReactNode }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  gate: async () => access.denied,
  chromeAccess: async () => ({ only: ['/approvals'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava.lindqvist@example.com' }),
}));

import { refusal } from '@/app.config';
import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { ApprovalRow, Approvals, WaitingRow } from '@/lib/work-shapes';
import {
  APPROVALS_BOUND_MS, APPROVALS_DEFAULTS, DECISION_BASIS, PRESENTATION, approvalsPath, approvedWhen, filtersOfPath, noPresentationLine, waited, type ApprovalsRead,
} from '@/views/approvals-context';
import { ApprovalsView } from '@/views/pages/approvals';
import ApprovalsLoading from '../app/(dash)/approvals/loading';
import ApprovalsPage, { generateMetadata } from '../app/(dash)/approvals/page';
import { readApprovals } from '../app/(dash)/approvals/read-approvals';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';

/**
 * Approvals as the person reads it (Task I-107, AC-5.7, AC-5.9), drawn from the fake gateway's own answers, the ones
 * `pnpm verify` serves the page: the Records template's four tiles, the approvals in the caller's name by week, and two
 * tabs composed with `LinkTabs`. Waiting is the team's queue, `Team approvals`, each row opening its revision on the
 * document's page for review; History is every approval recorded in the caller's name with its exact version and
 * content revision, when, and its presentation and decision basis as the gateway classified them. The fixture's dates
 * move with the day it is run, so every date and count here is read off its own answer.
 */
const answer = (who: Me, path: string) => approvals(who, new URLSearchParams(path.split('?')[1]))[1] as Approvals;
const WAITING_PATH = approvalsPath(APPROVALS_DEFAULTS);
const HISTORY_PATH = approvalsPath({ tab: 'history', page: '1' });
const WAITING = answer(ME, WAITING_PATH);
const HISTORY = answer(ME, HISTORY_PATH);
const ok = (data: Approvals, path = WAITING_PATH): ApprovalsRead => ({ state: 'ok', path, data, team: 'atlas' });
const gone = { state: 'unavailable', reason: 'query_failed' } as const;
const queueOf = (a: Approvals) => (a.waiting.state === 'ok' ? a.waiting.data : null)!;
const historyOf = (a: Approvals) => (a.history.state === 'ok' ? a.history.data : null)!;

/** The browser's reads: answered by `reply`, or never when it is null. */
function browser(reply: ((path: string) => [number, unknown]) | null = (p) => [200, answer(ME, p)]) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!reply) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = reply(url.pathname.replace('/api/console', '') + url.search);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u));

/** The page in the console's providers; `serve` is the navigation committing with the server's read of the new address. */
function mount(served: ApprovalsRead) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (s: ApprovalsRead) => <QueryClientProvider client={client}><Tooltip.Provider><ApprovalsView served={s} /></Tooltip.Provider></QueryClientProvider>;
  const rendered = render(tree(served));
  return { ...rendered, serve: (next: ApprovalsRead) => act(() => rendered.rerender(tree(next))) };
}
const text = () => document.body.textContent ?? '';
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });
/** The tab's table, apart from the chart's own table of its columns. */
const table = (name: string) => screen.getByRole('table', { name });
const rows = (name: string) => [...table(name).querySelectorAll('tbody tr')];
const headers = (name: string) => [...table(name).querySelectorAll('thead th')].map((h) => h.textContent?.trim());
const tile = (label: string) => screen.getAllByText(label).map((n) => n.closest('.card') ?? n.parentElement!)[0] as HTMLElement;

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

beforeEach(() => { gateway.get.mockReset(); access.denied = null; window.history.replaceState(null, '', '/approvals'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the page', () => {
  it('reads the address\'s tab on the console\'s server, and draws it under its name with the read\'s cutoff', async () => {
    gateway.get.mockImplementation(async (path: string) => answer(ME, path));
    browser(null);
    window.history.replaceState(null, '', '/approvals?tab=history');
    expect(await generateMetadata()).toMatchObject({ title: 'Approvals' });
    const tree = await settled(await ApprovalsPage({ searchParams: Promise.resolve({ tab: 'history' }) }));
    render(<QueryClientProvider client={new QueryClient()}><Tooltip.Provider><Suspense fallback={null}>{tree}</Suspense></Tooltip.Provider></QueryClientProvider>);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Approvals');
    expect(gateway.get).toHaveBeenCalledWith('/approvals?tab=history&limit=10&offset=0');
    expect(screen.getByText(/^As of /)).toBeInTheDocument();
    expect(reads()).toEqual([]);
  });

  it('is refused before anything is read, for a person who does not hold it', async () => {
    access.denied = <p>No such page</p>;
    expect(await ApprovalsPage({ searchParams: Promise.resolve({}) })).toBe(access.denied);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it('reads the tab and the page the address names, Waiting for a tab the route does not take, and sends a session that ended to sign-in', async () => {
    gateway.get.mockImplementation(async (path: string) => answer(ME, path));
    await expect(readApprovals({ tab: 'history', page: '2' })).resolves.toMatchObject({ state: 'ok', path: '/approvals?tab=history&limit=10&offset=10', team: 'atlas' });
    await expect(readApprovals({ tab: 'nonesuch', page: '1' })).resolves.toMatchObject({ path: WAITING_PATH });
    gateway.get.mockRejectedValue(new GatewayError(500, 'could not read the approvals'));
    await expect(readApprovals(APPROVALS_DEFAULTS)).resolves.toEqual({ state: 'failed', path: WAITING_PATH, reason: 'could not read the approvals' });
    gateway.get.mockRejectedValue(new GatewayError(401, 'signed out'));
    await expect(readApprovals(APPROVALS_DEFAULTS)).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fapprovals');
  });

  it('says a read slower than its bound is slow, never an endless skeleton', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const read = readApprovals(APPROVALS_DEFAULTS);
    await vi.advanceTimersByTimeAsync(APPROVALS_BOUND_MS);
    await expect(read).resolves.toEqual({ state: 'slow', path: WAITING_PATH });
  });

  it('is loading before the gate has answered, naming the page only where the refusal lets it', () => {
    const { container } = render(<ApprovalsLoading />);
    expect(screen.getByRole('status', { name: refusal === 'absent' ? 'Loading page' : 'Loading approvals' })).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card').length).toBeGreaterThanOrEqual(6);
    if (refusal === 'absent') expect(container.textContent).not.toMatch(/approval/i);
  });
});

describe('the Records template', () => {
  it('four tiles over both lists: waiting now, the oldest wait, approvals in your name, and approved with no presentation recorded', () => {
    browser(null);
    mount(ok(WAITING));
    const { tiles, meta } = WAITING;
    expect(tile('Waiting now').textContent).toContain(String(tiles.waiting));
    expect(tile('Waiting now').textContent).toContain(`${queueOf(WAITING).summary.olderThan14Days} waiting longer than 14 days`);
    expect(tile('Oldest wait').textContent).toContain(waited(tiles.oldestWaitingSince!, meta.asOf));
    expect(tile('Approvals in your name').textContent).toContain(String(tiles.inYourName));
    expect(tiles.noPresentation!.count).toBeGreaterThan(0);
    // The count over the approvals whose presentation is known, and the unknown rest, which add up to the tile beside it.
    const unknown = tiles.inYourName! - tiles.noPresentation!.of;
    expect(unknown).toBeGreaterThan(0);
    expect(tile('No presentation recorded').textContent).toContain(`${tiles.noPresentation!.count}of ${tiles.noPresentation!.of} known, ${unknown} unknown`);
    expect(document.querySelectorAll('[data-template="records"] [data-split="tiles"] > *')).toHaveLength(4);
  });

  it('approvals in your name by week, a column a week, the running week drawn unfinished', () => {
    browser(null);
    mount(ok(WAITING));
    const chart = screen.getByText('Approvals in your name by week', { selector: 'caption' }).closest('table')!;
    const weeks = [...chart.querySelectorAll('tbody tr')];
    expect(weeks).toHaveLength(WAITING.weeks.length);
    expect(weeks.map((tr) => Number(tr.querySelector('td')!.textContent))).toEqual(WAITING.weeks.map((w) => w.figure.value));
    expect(weeks.at(-1)!.querySelector('th')?.textContent).toContain('so far');
  });

  it('two tabs as addresses of their own, with LinkTabs, each carrying its list\'s total', () => {
    browser(null);
    mount(ok(WAITING));
    const tabs = screen.getByRole('navigation', { name: 'Approvals views' });
    const [waiting, history] = within(tabs).getAllByRole('link');
    expect(waiting).toHaveAttribute('href', '/approvals');
    expect(waiting).toHaveAttribute('aria-current', 'page');
    expect(waiting.textContent).toBe(`Waiting${queueOf(WAITING).total}`);
    expect(history).toHaveAttribute('href', '/approvals?tab=history');
    expect(history).not.toHaveAttribute('aria-current');
    expect(history.textContent).toBe(`History${historyOf(WAITING).total}`);
  });
});

describe('Waiting', () => {
  it('reads Team approvals, and lists document, initiative, version, waiting since and Review, longest waiting first', () => {
    browser(null);
    mount(ok(WAITING));
    expect(headers('Team approvals')).toEqual(['Document', 'Initiative', 'Version', 'Waiting since', 'Review']);
    expect(text()).toContain('Team approvals · Presented and not yet approved');
    expect(text()).toContain('Nothing records who must decide one, so the queue is your team\'s.');
    const queue = queueOf(WAITING).rows;
    expect(rows('Team approvals')).toHaveLength(queue.length);
    rows('Team approvals').forEach((tr, i) => {
      expect(tr.textContent).toContain(queue[i].path);
      expect(tr.textContent).toContain(`v${queue[i].version}`);
      // The snapshot by its short hash, and whole in the version cell's title.
      expect(tr.textContent).toContain(queue[i].contentRevision.slice(3, 11));
      expect(tr.querySelector(`td[title="v${queue[i].version}, ${queue[i].contentRevision}"]`)).not.toBeNull();
      expect(tr.textContent).toContain(waited(queue[i].waitingSince, WAITING.meta.asOf));
    });
  });

  it('each row opens its exact document for review, under the team the server read the queue for', () => {
    browser(null);
    mount(ok(WAITING));
    for (const r of queueOf(WAITING).rows as WaitingRow[]) {
      const review = screen.getByRole('link', { name: `Review ${r.path} v${r.version} of ${r.initiative}` });
      expect(review).toHaveAttribute('href', `/initiatives/atlas/${r.initiative}/${r.path}`);
    }
  });

  it('is the team\'s one queue for a member too, still Team approvals and assigned to nobody', () => {
    browser(null);
    const member = answer(MEMBER, WAITING_PATH);
    mount(ok(member));
    expect(queueOf(member).rows).toEqual(queueOf(WAITING).rows);
    expect(rows('Team approvals')).toHaveLength(queueOf(WAITING).rows.length);
  });
});

describe('History', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/approvals?tab=history'); });

  it('lists version and content revision, approved at, presentation and decision basis as the gateway classified them', () => {
    browser(null);
    mount(ok(HISTORY, HISTORY_PATH));
    expect(headers('Approved in your name')).toEqual(['Document', 'Initiative', 'Version', 'Approved at', 'Presentation', 'Decision basis']);
    const mine = historyOf(HISTORY).rows as ApprovalRow[];
    expect(rows('Approved in your name')).toHaveLength(10);
    rows('Approved in your name').forEach((tr, i) => {
      const r = mine[i];
      expect(tr.textContent).toContain(`v${r.version}`);
      expect(tr.textContent).toContain(r.contentRevision.slice(3, 11));
      expect(tr.querySelector(`td[title="v${r.version}, ${r.contentRevision}"]`)).not.toBeNull();
      expect(tr.textContent).toContain(approvedWhen(r.approvedAt));
      expect(tr.textContent).toContain(PRESENTATION[r.presentation].label);
      expect(tr.textContent).toContain(DECISION_BASIS[r.decisionBasis].label);
    });
    // The first page holds three classes of presentation and every basis; the unknown presentation is the next page's.
    expect(new Set(mine.map((r) => r.presentation))).toEqual(new Set(['console_revision_shown', 'agent_context_covered', 'not_recorded']));
    expect(new Set(mine.map((r) => r.decisionBasis))).toEqual(new Set(['explicit_recorded', 'standing_delegation_recorded', 'unknown']));
  });

  it('says Approved in your name and N of M approved with no presentation recorded, and claims no reading or signing beyond it', () => {
    browser(null);
    mount(ok(HISTORY, HISTORY_PATH));
    expect(text()).toContain(`Approved in your name · ${noPresentationLine(HISTORY.tiles.noPresentation!, HISTORY.tiles.inYourName)}. Newest first.`);
    expect(text()).toContain('2 of 10 approved with no presentation recorded, and 1 unknown. Newest first.');
    expect(text()).not.toMatch(/signed by|signed it|you read|read by you|at the keyboard|your agent/i);
  });

  it('pages at ten, the next page read on the server and not again in the browser, the day-only approval marked so', async () => {
    browser();
    const { serve } = mount(ok(HISTORY, HISTORY_PATH));
    expect(historyOf(HISTORY).total).toBeGreaterThan(10);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Page 2' })); });
    await settle();
    expect(window.location.search).toBe('?tab=history&page=2');
    expect(reads()).toEqual([]);
    const next = approvalsPath({ tab: 'history', page: '2' });
    serve(ok(answer(ME, next), next));
    await waitFor(() => expect(rows('Approved in your name')).toHaveLength(historyOf(HISTORY).total - 10));
    const sealed = (historyOf(answer(ME, next)).rows as ApprovalRow[]).find((r) => r.approvedAt.length === 10)!;
    expect(sealed.presentation).toBe('unknown');
    expect(text()).toContain('Day only');
    expect(text()).toContain(approvedWhen(sealed.approvedAt));
    expect(reads()).toEqual([]);
  });

  it('is the caller\'s own: a member never reads the superadmin\'s approvals in the team they share', () => {
    browser(null);
    const member = answer(MEMBER, HISTORY_PATH);
    mount(ok(member, HISTORY_PATH));
    const theirs = new Set((historyOf(member).rows as ApprovalRow[]).map((r) => r.contentRevision));
    expect(theirs.size).toBeGreaterThan(0);
    expect(rows('Approved in your name')).toHaveLength(theirs.size);
    for (const r of historyOf(HISTORY).rows) expect(theirs.has(r.contentRevision)).toBe(false);
    // Whole tokens live in the cells' titles now, so the markup is read, not only the text.
    for (const r of historyOf(HISTORY).rows) expect(document.body.innerHTML).not.toContain(r.contentRevision);
  });
});

describe('a tab is the server\'s parameter', () => {
  it('the browser reads nothing on mount after the server, nor while the other tab is the server\'s to read; the tiles stand meanwhile', async () => {
    browser();
    const { serve } = mount(ok(WAITING));
    await settle();
    expect(reads()).toEqual([]);
    // The History link moved the address; the server's read of it has not arrived.
    window.history.replaceState(null, '', '/approvals?tab=history');
    serve(ok(WAITING));
    await settle();
    expect(reads()).toEqual([]);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(tile('Approvals in your name').textContent).toContain(String(WAITING.tiles.inYourName));
    serve(ok(HISTORY, HISTORY_PATH));
    await waitFor(() => expect(rows('Approved in your name')).toHaveLength(10));
    expect(screen.getByRole('link', { name: /^History/ })).toHaveAttribute('aria-current', 'page');
    expect(reads()).toEqual([]);
  });
});

describe('the first paint of another tab or page', () => {
  it('draws the tab, the page and the rows the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/approvals?tab=history&page=2');
    browser(null);
    const path = approvalsPath({ tab: 'history', page: '2' });
    const second = answer(ME, path);
    expect(historyOf(second).rows.length).toBeGreaterThan(0);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><ApprovalsView served={ok(second, path)} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="Approved in your name"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(historyOf(second).rows.length);
      expect(container.querySelector('nav[aria-label="Approvals views"] [aria-current="page"]')?.textContent).toMatch(/^History/);
      expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('2');
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(historyOf(second).rows.length);
      await settle();
      expect(reads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [APPROVALS_DEFAULTS, { tab: 'waiting', page: '3' }, { tab: 'history', page: '2' }]) expect(filtersOfPath(approvalsPath(f))).toEqual(f);
  });
});

describe('every state draws', () => {
  it('error: the gateway\'s sentence and Retry, which reads again in the browser, and dashes that are not on their way', async () => {
    browser();
    mount({ state: 'failed', path: WAITING_PATH, reason: 'could not read the approvals' });
    expect(text()).toContain('could not read the approvals');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(text()).not.toContain('…');
    expect(reads()).toEqual([]);
    act(() => { screen.getByRole('button', { name: 'Retry' }).click(); });
    await waitFor(() => expect(rows('Team approvals')).toHaveLength(queueOf(WAITING).rows.length));
    expect(reads()).toHaveLength(1);
    expect(reads()[0]).toContain(`/api/console${WAITING_PATH}`);
  });

  it('slow: the bounded error, saying how long the platform was given', () => {
    browser(null);
    mount({ state: 'slow', path: WAITING_PATH });
    expect(text()).toContain(`The read did not answer within ${APPROVALS_BOUND_MS / 1000} seconds.`);
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('empty: nothing waits, nothing is in your name, and no zero is drawn for a wait that is not there', () => {
    browser(null);
    const none: Approvals = {
      ...WAITING,
      tiles: { waiting: 0, oldestWaitingSince: null, inYourName: 0, noPresentation: { count: 0, of: 0 } },
      weeks: [],
      waiting: { state: 'ok', data: { ...queueOf(WAITING), rows: [], total: 0, summary: { byInitiative: [], olderThan14Days: 0 } } },
      history: { state: 'ok', data: { ...historyOf(WAITING), rows: [], total: 0 } },
    };
    const { unmount } = mount(ok(none));
    expect(tile('Oldest wait').textContent).toContain('None waiting');
    expect(tile('No presentation recorded').textContent).toContain('0of 0 known');
    expect(text()).toContain('Nothing waits for approval');
    expect(text()).toContain('No approval in your name yet');
    unmount();
    window.history.replaceState(null, '', '/approvals?tab=history');
    mount(ok(none, HISTORY_PATH));
    expect(text()).toContain('An approval appears here once a revision of this team is approved in your name');
  });

  it('partial: a queue that could not be read says so in its place and reads Unavailable, and History stands', () => {
    browser(null);
    mount(ok({ ...WAITING, tiles: { ...WAITING.tiles, waiting: null, oldestWaitingSince: null }, waiting: gone }));
    expect(tile('Waiting now').textContent).toContain('Unavailable');
    expect(tile('Oldest wait').textContent).toContain('Unavailable');
    expect(text()).toContain('The waiting queue could not be read: query_failed. History and its figures stand.');
    expect(tile('Approvals in your name').textContent).toContain(String(WAITING.tiles.inYourName));
    expect(screen.getByText('Approvals in your name by week', { selector: 'caption' })).toBeInTheDocument();
  });

  it('partial: approvals in your name that could not be read say so, never zero, and Waiting stands', () => {
    window.history.replaceState(null, '', '/approvals?tab=history');
    browser(null);
    mount(ok({ ...HISTORY, tiles: { ...HISTORY.tiles, inYourName: null, noPresentation: null }, weeks: [], history: gone }, HISTORY_PATH));
    expect(tile('Approvals in your name').textContent).toContain('Unavailable');
    expect(tile('No presentation recorded').textContent).toContain('Unavailable');
    expect(text()).toContain('The approvals in your name could not be read: query_failed. Waiting and its figures stand.');
    expect(tile('Waiting now').textContent).toContain(String(HISTORY.tiles.waiting));
    expect(within(screen.getByRole('navigation', { name: 'Approvals views' })).getAllByRole('link')[0].textContent).toBe(`Waiting${queueOf(HISTORY).total}`);
  });
});
