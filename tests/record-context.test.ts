import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, Fragment, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ subs: new Set<() => void>() }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
    replace(url: string) { window.history.replaceState(null, '', url); nav.subs.forEach((f) => f()); },
  }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  requireNeed: async () => { if (!access.allowed) throw new Error('not permitted'); },
}));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { PREPARED } from '@/data/prepared';
import { contextText, type SharedContext } from '@/lib/shared-context';
import type { RecordRead } from '@/lib/work-shapes';
import { CONTEXT_BUDGET } from '@/views/context';
import { RecordActions, RecordView } from '@/views/pages/record';
import { RECORD_DEFAULTS, footOf, grainWords, leadOf, periodLine, recordContext, recordPath, tickOf, tileText, tilesOf } from '@/views/record-context';
import { recordTool } from '@/views/tools/record';
import { ME } from '../scripts/fake-gateway/people.ts';
import { extreme } from '../scripts/fake-gateway/states.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

/**
 * What the page and the assistant are both told about Record (Task I-105), from the one response its page reads: the
 * Ask on the lead about the period chosen, `view_record(period)` answering the same `RecordRead` with the page's own
 * context, `explore_record`'s measures over `/work/query`, and the shared context, which carries the period, the
 * cutoff, the coverage, the pace and each slice's figures and follows the period control.
 */
const answer = (q: string) => record(ME, new URLSearchParams(q))[1] as RecordRead;
const ALL = answer('period=all');
const QUARTER = answer('period=quarter');
const YEAR = answer('period=year');
const fact = (c: SharedContext, label: string) => c.facts.find((f) => f.label === label);
const gone = { state: 'unavailable', reason: 'query_failed' } as const;

/** The page's controls over its body, in the console's providers, with an assistant listening when `ask` is given. */
function mount(served: Parameters<typeof RecordView>[0]['served'], surface: { ask?: (q: string) => void; share?: (t: string, c?: object) => void } = {}) {
  const ui = createElement(Fragment, null, createElement(RecordActions, { served }), createElement(RecordView, { served }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(SurfaceOverride, { surface } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, ui))));
}
const ok = (data: RecordRead) => ({ state: 'ok' as const, path: recordPath(RECORD_DEFAULTS), data, team: 'atlas' });

beforeEach(() => { gateway.get.mockReset(); access.allowed = true; window.history.replaceState(null, '', '/record'); });
afterEach(() => vi.unstubAllGlobals());

describe('the Ask on the lead', () => {
  it('sits in the Featured metric\'s head, asking about the period chosen, with the assistant on, and is absent with it off', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const ask = vi.fn();
    const { unmount } = mount(ok(ALL), { ask });
    const button = screen.getByRole('button', { name: /^Ask: / });
    const head = button.closest('[data-figure]')!.firstElementChild!;
    expect(head.contains(button)).toBe(true);
    expect(head.querySelector('.t-kicker')!.textContent).toContain('One person, writing this');
    expect(button.getAttribute('aria-label')).toContain(periodLine(ALL).toLowerCase());
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(ok(ALL));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('view_record', () => {
  it('answers the same RecordRead its page reads for the period, told through the same context', async () => {
    gateway.get.mockResolvedValue(QUARTER);
    const { data, context } = await recordTool.read({ period: 'quarter' });
    expect(gateway.get).toHaveBeenCalledWith('/record?period=quarter&limit=10&offset=0');
    expect(data).toEqual(QUARTER);
    expect(context).toEqual(recordContext(QUARTER, { filters: { ...RECORD_DEFAULTS, period: 'quarter' } }));
    gateway.get.mockResolvedValue(ALL);
    await recordTool.read({});
    expect(gateway.get).toHaveBeenLastCalledWith(recordPath(RECORD_DEFAULTS));
  });

  it('takes the period alone, is the record feature\'s at /record, and refuses where its page would', async () => {
    expect(Object.keys(recordTool.input.shape)).toEqual(['period']);
    expect(recordTool.input.safeParse({ period: '30d' }).success).toBe(false);
    expect(recordTool).toMatchObject({ name: 'record', title: 'Record', page: '/record', needs: FEATURES.record.needs });
    access.allowed = false;
    await expect(recordTool.read({})).rejects.toThrow('not permitted');
    expect(gateway.get).not.toHaveBeenCalled();
  });
});

describe('explore_record', () => {
  it('declares its slices\' measures over /work/query: closures, words, approvals, lessons and runs', () => {
    const sources = recordTool.explore.sources;
    expect(Object.keys(sources)).toEqual(['closures', 'words', 'approvals', 'lessons', 'runs']);
    for (const s of Object.values(sources)) {
      const row = PREPARED.find((r) => r.name === s.collection);
      expect(row, s.collection).toBeDefined();
      expect(row!.route, s.collection).toBe('work');
    }
  });
});

describe('the shared context', () => {
  it('carries the period, the cutoff, the pace and the coverage, the foot and each slice\'s figures', () => {
    const c = recordContext(QUARTER, { filters: { ...RECORD_DEFAULTS, period: 'quarter' } });
    expect(c).toMatchObject({ view: 'record', title: 'Record', address: '/record?period=quarter' });
    expect(fact(c, 'Period')!.value).toBe(periodLine(QUARTER));
    expect(fact(c, 'One person, writing this')).toMatchObject({ value: `${leadOf(QUARTER).text}, estimated at 500 words an hour`, change: expect.stringContaining('as of ') });
    for (const f of footOf(QUARTER)) expect(fact(c, f.label)!.value).toBe(f.value);
    const tiles = tilesOf(QUARTER);
    for (const [k, title] of [['work', 'Work'], ['documents', 'Documents'], ['knowledge', 'Knowledge'], ['agents', 'Your agents'], ['firsts', 'Firsts and bests']] as const) {
      for (const t of tiles[k]!) expect(fact(c, title)!.value).toContain(tileText(t));
    }
    const text = contextText(c);
    expect(text).toContain(`The estimate: ${leadOf(QUARTER).coverage}`);
    expect(text).toContain(QUARTER.meta.population);
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('holds its budget for every period, and says a part that could not be read is unknown', () => {
    for (const r of [ALL, QUARTER, YEAR]) expect(contextText(recordContext(r, { filters: RECORD_DEFAULTS })).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    const c = recordContext({ ...ALL, lead: { ...ALL.lead, estimate: null }, work: gone, record: gone }, { filters: RECORD_DEFAULTS });
    expect(fact(c, 'One person, writing this')!.value).toBe('Unavailable');
    expect(fact(c, 'Work')).toBeUndefined();
    expect(c.unknowns).toEqual(expect.arrayContaining(['The retained text could not be read, so there is no estimate.', 'The work could not be read.', 'The record of initiatives could not be read.']));
    expect(recordContext(null, { filters: RECORD_DEFAULTS, trouble: 'could not read the record' }).unknowns[0]).toContain('could not read the record');
  });

  it('follows the period control: the period chosen is what the page shares once it has arrived', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://console.test');
      const body = url.pathname.endsWith('/me') ? ME : answer(url.search.slice(1));
      return Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
    }));
    const shared: SharedContext[] = [];
    const share = (_t: string, c?: object) => { shared.push(c as SharedContext); };
    const { rerender } = mount(ok(ALL), { share });
    await waitFor(() => expect(shared.at(-1) && fact(shared.at(-1)!, 'Period')!.value).toBe(periodLine(ALL)));
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Year' })); });
    // The navigation commits with the console's server's read of the new period, as Next renders it.
    const year = { ...ok(YEAR), path: recordPath({ period: 'year', page: '1' }) };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => rerender(createElement(QueryClientProvider, { client }, createElement(SurfaceOverride, { surface: { share } } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null,
      createElement(Fragment, null, createElement(RecordActions, { served: year }), createElement(RecordView, { served: year })))))));
    await waitFor(() => expect(shared.at(-1)?.address).toBe('/record?period=year'));
    await waitFor(() => expect(fact(shared.at(-1)!, 'Period')?.value).toBe(periodLine(YEAR)));
    expect(fact(shared.at(-1)!, 'Work closed')!.value).toBe(footOf(YEAR)[0].value);
  });
});

describe('the grain the series arrive in (Task I-139)', () => {
  /** The busy team's record, whose whole record the gateway cuts by quarter and whose year by month. */
  const busy = (period: string) => extreme(['record'], answer(`period=${period}`), null, new URLSearchParams(`period=${period}`), 'atlas') as RecordRead;
  const windowsOf = (r: RecordRead) => r.cumulative.map((p) => p.window);

  it('names a series by the grain it arrives in: a quarter\'s by week, a year\'s by month, the whole busy record\'s by quarter', () => {
    expect(grainWords(windowsOf(QUARTER))).toBe('by week');
    expect(grainWords(windowsOf(busy('year')))).toBe('by month');
    expect(grainWords(windowsOf(busy('all')))).toBe('by quarter');
    // A quarter's column is its first month's, as a month's is.
    const quarters = windowsOf(busy('all'));
    expect(tickOf(quarters)(quarters[0].from)).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    expect(tickOf(windowsOf(QUARTER))(windowsOf(QUARTER)[0].from)).toMatch(/^Week of /);
  });

  it('tells the assistant the grain the page draws the series in, never by week for months or quarters', () => {
    const said = (r: RecordRead, period: 'quarter' | 'year' | 'all') => contextText(recordContext(r, { filters: { ...RECORD_DEFAULTS, period } }));
    expect(said(QUARTER, 'quarter')).toContain('drawn by week');
    const year = said(busy('year'), 'year');
    expect(year).toContain('drawn by month');
    expect(year).not.toMatch(/by (week|quarter)\b/);
    const all = said(busy('all'), 'all');
    expect(all).toContain('drawn by quarter');
    expect(all).not.toMatch(/by (week|month)\b/);
    expect(all.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });
});
