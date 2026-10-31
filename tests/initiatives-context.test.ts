import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), requireNeed: async () => undefined }));

import { SurfaceOverride } from '@/components/base/surface';
import { PREPARED } from '@/data/prepared';
import { contextText } from '@/lib/shared-context';
import type { InitiativeList } from '@/lib/work-shapes';
import { CONTEXT_BUDGET } from '@/logic/context';
import { initiativeContext } from '@/logic/initiative-context';
import { CLOSE_IS_THE_PERSON_S, OUTCOMES, initiativesContext, monthOf, nextOf, type InitiativesRead } from '@/logic/initiatives-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/logic/initiatives-filter';
import { InitiativesView } from '@/views/pages/initiatives';
import { initiativeTool } from '@/logic/tools/initiative';
import { initiativesTool } from '@/logic/tools/initiatives';
import { initiativeDetail, initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { ME } from '../scripts/fake-gateway/people.ts';

/**
 * Initiatives' agent side (Task I-106, AC-5.5): the Ask in the list's filter bar; `view_initiatives` and
 * `view_initiative`, which read what the pages read and tell the assistant what the pages tell it; `explore_initiatives`'
 * prepared query; and the context itself, which carries the filters, the rows in view with where each goes next and the
 * summary, and says that a person closes an initiative, in the dialog, and the assistant never does.
 */
const listOf = (path: string) => initiativeList(ME, new URLSearchParams(path.split('?')[1]))[1] as InitiativeList;
const PATH = listPath(INITIATIVES_DEFAULTS);
const LIST = listOf(PATH);
const ALL = { q: '', state: 'all', flow: 'all' };
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const ASK = /^Ask: /;

function mount(served: InitiativesRead, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = createElement(Tooltip.Provider, null, createElement(InitiativesView, { served }));
  return render(createElement(QueryClientProvider, { client }, createElement(SurfaceOverride, { surface: ask ? { ask } : {} } as never, page)));
}

beforeEach(() => {
  gateway.get.mockReset();
  gateway.get.mockImplementation(async (path: string) => (path.startsWith('/initiatives?') ? listOf(path) : initiativeDetail('atlas', path.split('/').at(-1)!)));
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  window.history.replaceState(null, '', '/initiatives');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the Ask', () => {
  it('sits in the list\'s filter bar, on the Initiatives table, with the assistant on, and asks about the filters applied', () => {
    const ask = vi.fn();
    const { unmount } = mount({ state: 'ok', path: PATH, data: LIST, team: 'atlas' }, ask);
    const [button] = screen.getAllByRole('button', { name: ASK });
    expect(button.closest('[data-protagonist="Initiatives"]')).not.toBeNull();
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    expect(button.closest('section')?.querySelector('input[type="search"]')).not.toBeNull();
    const plain = button.getAttribute('aria-label');
    unmount();
    window.history.replaceState(null, '', '/initiatives?state=quiet');
    const quiet = listPath({ ...INITIATIVES_DEFAULTS, state: 'quiet' });
    const again = mount({ state: 'ok', path: quiet, data: listOf(quiet), team: 'atlas' }, ask);
    expect(screen.getAllByRole('button', { name: ASK })[0].getAttribute('aria-label')).not.toBe(plain);
    again.unmount();
    mount({ state: 'ok', path: quiet, data: listOf(quiet), team: 'atlas' });
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
  });
});

describe('view_initiatives', () => {
  it('answers the same InitiativeList the page reads, its summary included, with the page\'s context', async () => {
    const { data, context } = await initiativesTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual(LIST);
    expect((data as InitiativeList).summary.state).toBe('ok');
    expect({ ...context, freshness: null }).toEqual({ ...initiativesContext(LIST, { filters: ALL, page: 1, ...arrival }), freshness: null });
    expect(initiativesTool.page).toBe('/initiatives');
  });

  it('takes the route\'s own arguments, state, flow, q, limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(initiativesTool.input.shape).sort()).toEqual(['flow', 'limit', 'offset', 'q', 'state']);
    const { context } = await initiativesTool.read({ state: 'quiet', q: 'search', offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/initiatives?state=quiet&q=search&limit=10&offset=10');
    expect(context.address).toBe('/initiatives?q=search&state=quiet&page=2');
    const off = await initiativesTool.read({ limit: 3, offset: 12 });
    expect(gateway.get).toHaveBeenLastCalledWith('/initiatives?limit=3&offset=12');
    expect(contextText(off.context)).toContain('does not show exactly these');
  });
});

describe('view_initiative', () => {
  it('answers the initiative\'s page, with its context', async () => {
    const slug = '2026-09-28-search-relevance';
    const { data, context } = await initiativeTool.read({ team: 'atlas', slug });
    expect(gateway.get).toHaveBeenCalledWith(`/initiatives/atlas/${slug}`);
    expect(data).toEqual(initiativeDetail('atlas', slug));
    expect({ ...context, freshness: null }).toEqual({ ...initiativeContext(initiativeDetail('atlas', slug)!, arrival), freshness: null });
    expect(initiativeTool.page).toBe('/initiatives/[team]/[slug]');
    expect(await initiativeTool.explore.fixed!({ team: 'atlas', slug })).toEqual(Object.fromEntries(['words', 'approvals', 'runs', 'calls'].map((k) => [k, [{ field: 'initiative', op: 'eq', value: slug }]])));
  });
});

describe('explore_initiatives', () => {
  it('declares the closures and the openings, each over /work/query, filtered as Initiatives filters', () => {
    const { sources } = initiativesTool.explore;
    expect(Object.keys(sources)).toEqual(['closures', 'opened']);
    for (const s of Object.values(sources)) expect(PREPARED.find((r) => r.name === s.collection)?.route, s.collection).toBe('work');
    // The page's flow filter, and the closed states' outcomes, by the names the page filters by.
    expect(Object.keys(sources.closures.filters ?? {})).toEqual(expect.arrayContaining(['flow', 'outcome']));
    expect(sources.closures.filters?.outcome?.values).toEqual([...OUTCOMES]);
    expect(Object.keys(sources.opened.filters ?? {})).toEqual(['flow']);
    expect(sources.closures.drill.address({ slug: '2026-09-12-onboarding-revamp' })).toBe('/initiatives?q=2026-09-12-onboarding-revamp');
  });
});

describe('the context', () => {
  const text = (list = LIST, filters = ALL, page = 1) => contextText(initiativesContext(list, { filters, page, ...arrival }));

  it('carries the filters, the rows in view with their next move, and the summary', () => {
    const narrow = { q: 'search', state: 'waiting', flow: 'sdlc-flow' };
    const path = listPath({ ...narrow, page: '1' });
    const list = listOf(path);
    const said = text(list, narrow);
    expect(said).toContain('filtered to state waiting, flow sdlc-flow, matching "search"');
    for (const r of list.rows) expect(said).toContain(`${r.slug} (`);
    for (const r of list.rows) expect(said).toContain(`next: ${nextOf(r)}`);
    const all = text();
    const summary = LIST.summary.state === 'ok' ? LIST.summary.data : null;
    expect(all).toContain(`Initiatives: ${LIST.total}`);
    expect(all).toContain(`${summary!.byState.quiet} quiet`);
    expect(all).toContain(`Open: ${LIST.tiles.open}`);
    expect(all).toContain(`Waiting: ${LIST.tiles.waiting}`);
    expect(all).toContain(`${LIST.tiles.closed.accepted} accepted, ${LIST.tiles.closed.delivered} delivered, ${LIST.tiles.closed.abandoned} abandoned`);
    expect(all).toContain('Closures by week and outcome');
    expect(all.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('says of a row no flow governs what the screen says, No flow, never zz-core\'s absent next move', () => {
    const path = listPath({ ...INITIATIVES_DEFAULTS, q: 'research-notes' });
    const list = listOf(path);
    const freeform = list.rows.find((r) => r.flow === null)!;
    expect(freeform.nextMove?.action).toBe('none');
    expect(nextOf(freeform)).toBe('No flow');
    expect(text(list, { q: 'research-notes', state: 'all', flow: 'all' })).toContain(`${freeform.slug} (`);
    expect(text(list, { q: 'research-notes', state: 'all', flow: 'all' })).toContain('next: No flow');
  });

  it('says the assistant never closes, and that the close is made in the dialog, on the list and on an initiative', () => {
    expect(CLOSE_IS_THE_PERSON_S).toMatch(/assistant closes nothing/);
    expect(CLOSE_IS_THE_PERSON_S).toMatch(/in the dialog/);
    expect(text()).toContain(CLOSE_IS_THE_PERSON_S);
    expect(contextText(initiativeContext(initiativeDetail('atlas', '2026-10-08-result-explanations')!, arrival))).toContain(CLOSE_IS_THE_PERSON_S);
    // Neither tool can close: each reads, and neither takes anything a close is made of.
    for (const tool of [initiativesTool, initiativeTool]) {
      for (const field of ['disposition', 'accepted_by', 'no_signoff_reason', 'document']) expect(Object.keys(tool.input.shape)).not.toContain(field);
    }
    expect(initiativeTool.description).toContain('the assistant never does');
  });

  it('says what it could not read, never counting it as nothing', () => {
    const lost: InitiativeList = { ...LIST, closures: { state: 'unavailable', reason: 'down' }, summary: { state: 'unavailable', reason: 'down' }, nextMoveState: 'unavailable' };
    const said = text(lost);
    expect(said).toContain('The closures could not be read');
    expect(said).not.toMatch(/by week/);
    expect(said).toContain('The counts by state and flow could not be read');
    expect(said).toContain('no row\'s next move is known');
    expect(said).not.toContain('Closures by week and outcome, the last');
  });
});

describe('the closures named by the grain they arrive in (Task I-139)', () => {
  /** The list's closures cut as the gateway cuts a longer record: four whole periods of `months` months each, then the running one. */
  const cutBy = (months: number): InitiativeList => {
    const start = (i: number) => new Date(Date.UTC(2025, 0 + i * months, 1)).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const data = Array.from({ length: 5 }, (_, i) => ({
      window: { from: start(i), to: start(i + 1), observedFrom: start(i), observedThrough: i < 4 ? start(i + 1) : start(i).replace(/-01T/, '-05T'), complete: i < 4 },
      accepted: { value: 3 + i, why: null }, delivered: { value: 2, why: null }, abandoned: { value: i ? 1 : null, why: i ? null : 'query_failed' },
    }));
    return { ...LIST, closures: { state: 'ok', data } } as InitiativeList;
  };
  const said = (list: InitiativeList) => contextText(initiativesContext(list, { filters: ALL, page: 1, ...arrival }));

  it('says the closures by week when they arrive by week, each by its week', () => {
    expect(said(LIST)).toMatch(/Closures by week and outcome, the last \d+ whole weeks?: week of /);
  });

  it('says the closures by month or by quarter when they arrive so, each period by its own name, and never by week', () => {
    const months = said(cutBy(1));
    expect(months).toContain('Closures by month and outcome, the last 4 whole months: Jan 2025: 3 accepted, 2 delivered, abandoned not read; Feb 2025: 4 accepted');
    expect(months).not.toMatch(/by week|week of/);
    const quarters = said(cutBy(3));
    expect(quarters).toContain('Closures by quarter and outcome, the last 4 whole quarters: Jan to Mar 2025: 3 accepted');
    expect(quarters).toContain('Oct to Dec 2025: 6 accepted');
    expect(quarters).not.toMatch(/by week|week of/);
  });

  it('titles the chart, its columns and its count by the grain, on the page as in the context', () => {
    mount({ state: 'ok', path: PATH, data: cutBy(3), team: 'atlas' });
    expect(screen.getAllByText('Closures by quarter and outcome').length).toBeGreaterThan(0);
    expect(screen.getByText('The team\'s closures, 5 quarters, whatever the filters')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Closures by week');
  });

  it('says the closures could not be read with no grain, which an unread series has none of', () => {
    mount({ state: 'ok', path: PATH, data: { ...LIST, closures: { state: 'unavailable', reason: 'down' } }, team: 'atlas' });
    expect(screen.getByText('The closures could not be read')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/closures by week|the weeks/i);
  });
});

describe('monthOf', () => {
  it('names the month an instant falls in, in the reporting timezone', () => {
    expect(monthOf('2026-10-05T03:00:00Z')).toBe('Oct 2026');
    // 23:00 UTC on 30 Sep is already 1 Oct in Singapore.
    expect(monthOf('2026-09-30T23:00:00Z')).toBe('Oct 2026');
    expect(monthOf(Date.parse('2026-12-31T12:00:00Z'))).toBe('Dec 2026');
  });

  it('answers what it cannot read as it was given', () => {
    expect(monthOf('not a date')).toBe('not a date');
  });
});
