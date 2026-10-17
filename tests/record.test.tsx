import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { cloneElement, createElement, isValidElement, Suspense, type ReactNode } from 'react';
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
  chromeAccess: async () => ({ only: ['/record'], user: { name: 'Ava', role: 'Superadmin' }, team: 'atlas', caller: 'ava.lindqvist@example.com' }),
}));
/** Every Heatmap the page draws, with the props it was handed, drawn as the release draws it. */
const heat = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('@/components/charts/heatmap', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/charts/heatmap')>();
  return { ...real, Heatmap: (p: Parameters<typeof real.Heatmap>[0]) => { heat.props.push(p); return createElement(real.Heatmap, p); } };
});

import { refusal } from '@/app.config';
import { SurfaceOverride } from '@/components/base/surface';
import { GatewayError } from '@/data/gateway';
import { dayOf } from '@/lib/format-date';
import type { RecordRead } from '@/lib/work-shapes';
import { RecordActions, RecordView } from '@/views/pages/record';
import { RECORD_BOUND_MS, RECORD_DEFAULTS, footOf, periodLine, recordPath, type RecordServed } from '@/views/record-context';
import RecordLoading from '../app/(dash)/record/loading';
import RecordPage from '../app/(dash)/record/page';
import { readRecord } from '../app/(dash)/record/read-record';
import { ME } from '../scripts/fake-gateway/people.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

/**
 * Record as the person reads it (Task I-105, AC-5.3), drawn from the fake gateway's own answers, the ones `pnpm verify`
 * serves the page: the lead as of its cutoff, the period control reading another period in the browser, the six slices
 * each labelled with its period, the year of days, the record paged at ten, and every state. The fixture's periods
 * move with the day it is run, so every date and count here is read off its own answer.
 */
const answer = (q: string) => record(ME, new URLSearchParams(q))[1] as RecordRead;
const ALL = answer('period=all');
const QUARTER = answer('period=quarter');
const PATH = recordPath(RECORD_DEFAULTS);
const ok = (data: RecordRead, path = PATH): RecordServed => ({ state: 'ok', path, data, team: 'atlas' });
const gone = { state: 'unavailable', reason: 'query_failed' } as const;
const none = { value: null, why: 'no_data' } as const;
const EMPTY: RecordRead = {
  ...ALL,
  lead: { ...ALL.lead, estimate: { ...ALL.lead.estimate!, words: 0, hours: null } },
  cumulative: [],
  foot: { closed: { value: 0, why: null }, opened: { value: 0, why: null }, documents: { value: 0, why: null }, versions: { value: 0, why: null }, approvalsInYourName: { value: 0, why: null } },
  work: { state: 'ok', data: { ...(ALL.work.state === 'ok' ? ALL.work.data : ({} as never)), closuresInAll: [], closuresByWeek: [], medianHoursByWeek: [], medianHoursToClose: { ...(ALL.work.state === 'ok' ? ALL.work.data.medianHoursToClose : ({} as never)), figure: none, denominator: 0 } } },
  documents: { state: 'ok', data: { ...(ALL.documents.state === 'ok' ? ALL.documents.data : ({} as never)), wordsByWeek: [], mostRewritten: [] } },
  record: { state: 'ok', data: { rows: [], total: 0, summary: { byOutcome: { open: 0, accepted: 0, delivered: 0, abandoned: 0 }, byFlow: [] } } },
};
const PARTIAL: RecordRead = { ...ALL, lead: { ...ALL.lead, estimate: null }, work: gone, agents: gone, record: gone };

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

/** The masthead's controls over the body, as the page lays them out, in the console's providers. */
function mount(served: RecordServed, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (s: RecordServed) => (
    <QueryClientProvider client={client}><SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><RecordActions served={s} /><RecordView served={s} /></Tooltip.Provider></SurfaceOverride></QueryClientProvider>
  );
  const rendered = render(tree(served));
  /** The navigation committing: the console's server rendered the page again, with its own read of the new address. */
  return { ...rendered, serve: (next: RecordServed) => act(() => rendered.rerender(tree(next))) };
}
const foot = (label: string) => within(document.querySelector('[data-foot]') as HTMLElement).getByText(label).nextElementSibling!.textContent;
const slices = () => [...document.querySelectorAll('[data-slice]')] as HTMLElement[];

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

beforeEach(() => { gateway.get.mockReset(); heat.props = []; window.history.replaceState(null, '', '/record'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the page', () => {
  it('reads the record on the console\'s server for the address, and draws it under its name with the read\'s cutoff', async () => {
    gateway.get.mockResolvedValue(ALL);
    browser(null);
    const tree = await settled(await RecordPage({ searchParams: Promise.resolve({}) }));
    render(<QueryClientProvider client={new QueryClient()}><Tooltip.Provider><Suspense fallback={null}>{tree}</Suspense></Tooltip.Provider></QueryClientProvider>);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Record');
    expect(gateway.get).toHaveBeenCalledWith('/record?period=all&limit=10&offset=0');
    expect(screen.getByText(/^As of /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeEnabled();
    expect(reads()).toEqual([]);
  });

  it('offers the period before the server\'s read has answered, and reads nothing in the browser meanwhile', async () => {
    browser(() => [200, ALL]);
    render(<QueryClientProvider client={new QueryClient()}><RecordActions served={null} /></QueryClientProvider>);
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeDisabled();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
  });

  it('reads the period and the page the address names, and sends a session that ended to sign-in', async () => {
    gateway.get.mockResolvedValue(QUARTER);
    await expect(readRecord({ period: 'quarter', page: '2' })).resolves.toMatchObject({ state: 'ok', path: '/record?period=quarter&limit=10&offset=10' });
    gateway.get.mockRejectedValue(new GatewayError(401, 'signed out'));
    await expect(readRecord(RECORD_DEFAULTS)).rejects.toThrow('NEXT_REDIRECT /login?next=%2Frecord');
  });

  it('says a read slower than its bound is unavailable, never an endless skeleton', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const read = readRecord(RECORD_DEFAULTS);
    await vi.advanceTimersByTimeAsync(RECORD_BOUND_MS);
    await expect(read).resolves.toEqual({ state: 'slow', path: PATH });
  });

  it('is loading before the gate has answered, naming the page only where the refusal lets it', () => {
    render(<RecordLoading />);
    expect(screen.getByRole('status', { name: refusal === 'absent' ? 'Loading page' : 'Loading record' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('the lead', () => {
  it('reads One person, writing this, estimated and the pace, as of the cutoff, above the words added in all', () => {
    browser(null);
    mount(ok(ALL));
    const card = document.querySelector('[data-figure]') as HTMLElement;
    expect(card.textContent).toContain('One person, writing this · as of');
    // The figure's unit is its own span: `575` then `h`.
    expect(card.querySelector('[data-value]')!.textContent).toBe('575h');
    expect(card.textContent).toContain('Estimated at 500 words an hour, over 287,400 words your documents and lessons retain as of');
    const chart = within(card).getByText('Words added, a running total, by week');
    expect(card.querySelector('[data-value]')!.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(foot('Work closed')).toBe(footOf(ALL)[0].value);
  });

  it('reads Unavailable, never zero, when the retained text could not be read', () => {
    browser(null);
    mount(ok(PARTIAL));
    expect(document.querySelector('[data-figure] [data-value]')!.textContent).toBe('Unavailable');
    expect(screen.getByText('The retained text could not be read, so there is no estimate.')).toBeInTheDocument();
  });
});

describe('the period control', () => {
  it('reads another period on the server, never in the browser beside it, and changes the period\'s figures, the lead still as of its cutoff', async () => {
    browser((path) => [200, answer(path.split('?')[1])]);
    const { serve } = mount(ok(ALL));
    const kicker = document.querySelector('[data-figure] .t-kicker')!.textContent;
    expect(foot('Work closed')).toBe(footOf(ALL)[0].value);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Quarter' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    serve(ok(QUARTER, recordPath({ period: 'quarter', page: '1' })));
    await waitFor(() => expect(slices()[0].textContent).toContain(periodLine(QUARTER)));
    expect(reads()).toEqual([]);
    expect(foot('Work closed')).toBe(footOf(QUARTER)[0].value);
    expect(document.querySelector('[data-figure] .t-kicker')!.textContent).toBe(kicker);
    expect(window.location.search).toBe('?period=quarter');
  });
});

describe('the slices', () => {
  it('draws Work, Documents, Knowledge, Your agents and Firsts and bests with their period, then the record', () => {
    browser(null);
    mount(ok(ALL));
    expect(slices().map((s) => s.querySelector('h2')!.textContent)).toEqual(['Work', 'Documents', 'Knowledge', 'Your agents', 'Firsts and bests', 'The record']);
    for (const s of slices().slice(0, 5)) {
      expect(s.textContent).toContain(periodLine(ALL));
      expect(s.querySelectorAll('[data-split="tiles"] > *')).toHaveLength(4);
    }
  });

  it('draws the year of days as the release\'s Heatmap of days on a quantile scale, in the reporting time zone', () => {
    browser(null);
    mount(ok(ALL));
    const agents = ALL.agents.state === 'ok' ? ALL.agents.data : null;
    const year = agents!.days.at(-1)!.day.slice(0, 4);
    const days = heat.props.find((p) => 'days' in p)!;
    expect(days).toMatchObject({ scale: 'quantile', unit: 'runs' });
    expect(days.days).toEqual(agents!.days.filter((d) => d.day.startsWith(year)).map((d) => ({ date: d.day, value: d.runs })));
    expect(days.running).toBe(agents!.days.at(-1)!.day === dayOf(ALL.meta.asOf, ALL.meta.timezone));
    expect(heat.props.find((p) => 'values' in p)).toMatchObject({ timezone: ALL.meta.timezone, values: agents!.weekdayHour });
  });

  it('pages the record at ten, the next page read on the server and not again in the browser', async () => {
    browser((path) => [200, answer(path.split('?')[1])]);
    const { serve } = mount(ok(ALL));
    const table = slices().at(-1)!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(ALL.record.state === 'ok' && ALL.record.data.total).toBeGreaterThan(10);
    await act(async () => { fireEvent.click(within(table).getByRole('button', { name: 'Page 2' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    const next = recordPath({ period: 'all', page: '2' });
    serve(ok(answer(next.split('?')[1]) as RecordRead, next));
    await waitFor(() => expect(slices().at(-1)!.querySelectorAll('tbody tr')).toHaveLength(2));
    expect(reads()).toEqual([]);
  });
});

describe('every state draws', () => {
  it('loading, while the server\'s read of a new address is on its way', () => {
    window.history.replaceState(null, '', '/record?period=year');
    browser(null);
    mount(ok(ALL));
    expect(screen.getByRole('status', { name: 'Loading record' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeDisabled();
  });

  it('empty: each chart and list says nothing is recorded, never zero for a figure with none', () => {
    browser(null);
    mount(ok(EMPTY));
    expect(document.querySelector('[data-figure] [data-value]')!.textContent).toBe('No words recorded');
    expect(screen.getAllByText('Nothing recorded in the period').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Nothing rewritten in the period')).toBeInTheDocument();
    expect(screen.getByText('No initiative yet')).toBeInTheDocument();
    expect(within(slices()[0]).getByText('None recorded')).toBeInTheDocument();
  });

  it('error: the gateway\'s sentence and Retry, which reads again in the browser', async () => {
    browser(() => [200, ALL]);
    mount({ state: 'failed', path: PATH, reason: 'could not read the record' });
    expect(screen.getByText('Record did not load')).toBeInTheDocument();
    expect(screen.getByText('could not read the record')).toBeInTheDocument();
    expect(reads()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(slices()).toHaveLength(6));
    expect(reads()).toHaveLength(1);
  });

  it('slow: the bounded error, saying how long the platform was given', () => {
    browser(null);
    mount({ state: 'slow', path: PATH });
    expect(screen.getByText(`The platform did not answer within ${RECORD_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading record' })).toBeNull();
  });

  it('partial: a slice that could not be read says so in its place, and the rest stands', () => {
    browser(null);
    mount(ok(PARTIAL));
    expect(screen.getByText('The work could not be read.')).toBeInTheDocument();
    expect(screen.getByText('Your agents\' runs could not be read.')).toBeInTheDocument();
    expect(screen.getByText('The record of initiatives could not be read.')).toBeInTheDocument();
    expect(slices()[1].querySelectorAll('[data-split="tiles"] > *')).toHaveLength(4);
  });
});
