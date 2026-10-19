import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the initiatives page shows are the gateway's: the list answers its rows already filtered and paged for the
 * active team, so the page draws each row's gates, state and next move as given, and asks the server again for a
 * filter or a page rather than narrowing what it holds.
 *
 * What it pins is the page's most derived cell, **Gates passed**, `${passed} of ${of}` as the row carries it, so a page that
 * counted anything itself cannot pass both rows; that the Team column is gone, since Work is the active team's; and the
 * address the page is drawn from, which carries its filters and its page of ten and nothing else: the console's server
 * reads it, so the browser asks for none of it while the server's answer is the latest.
 *
 * `cell()` reads the header row for a column's position, then that cell of the row carrying the needle, taking the
 * cell's FIRST child because a `DataTable` also draws the words a phone card uses.
 */
import type { InitiativeList, InitiativeRow } from '@/lib/work-shapes';
import type { InitiativesRead } from '@/views/initiatives-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { InitiativesView } from '@/views/pages/initiatives';

const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };

const ROWS: InitiativeRow[] = [
  { slug: '2026-09-28-search-relevance', flow: 'sdlc-flow', state: 'waiting', gates: { passed: 1, of: 2 },
    nextMove: { action: 'await_approval', stage: 'plan', document: 'plan.md', waitingOn: 'stakeholder', why: 'plan.md is written and waits on approval' },
    lastTouched: '2026-10-01T00:00:00Z', opened: '2026-09-28T00:00:00Z', closed: null },
  { slug: '2026-09-22-payout-schedule', flow: 'ops', state: 'open', gates: { passed: 0, of: 1 },
    nextMove: { action: 'write_document', stage: 'intent', document: 'intent.md', waitingOn: 'agent', why: 'the intent stage is under way' },
    lastTouched: '2026-09-30T00:00:00Z', opened: '2026-09-22T00:00:00Z', closed: null },
];

const LIST: InitiativeList = {
  meta: { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: WINDOW.from, to: '2026-10-15T00:00:00Z' }, scope: 'active-team', population: 'atlas', coverageFrom: null },
  tiles: { open: 2, waiting: 1, closed: { accepted: 3, delivered: 1, abandoned: 2 } },
  closures: { state: 'ok', data: [] },
  rows: ROWS, total: 23,
  summary: { state: 'ok', data: {
    total: 23, byState: { open: 1, waiting: 1, quiet: 15, accepted: 3, delivered: 1, abandoned: 2 },
    byFlow: [{ flow: 'sdlc-flow', count: 20 }, { flow: 'ops', count: 2 }, { flow: null, count: 1 }],
    touched: [], previous: { window: WINDOW, total: 21 },
  } },
  nextMoveState: 'ok',
};

let asked: URL[] = [];

/** The server's read of the address with `query`, answered by the list. */
const served = (query = ''): InitiativesRead => {
  const p = new URLSearchParams(query);
  const path = listPath({ ...INITIATIVES_DEFAULTS, ...Object.fromEntries(p) });
  return { state: 'ok', path, data: LIST, team: 'atlas' };
};

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    asked.push(url);
    return { ok: true, status: 200, json: async () => LIST } as unknown as Response;
  };
}

/** The text of the row carrying `needle`, in the column whose header is `header`. */
function cell(needle: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(needle));
  if (column < 0 || !row) return `no ${header} column or no ${needle} row`;
  const td = [...row.querySelectorAll('td')][column];
  // What the table draws: past a phone card's dot, and its own words where a phone has others.
  const drawn = td?.querySelector(':scope > [class~="@max-[640px]:hidden"]') ?? td?.querySelector(':scope > :not([data-sep])') ?? td;
  return drawn?.textContent?.trim() ?? '';
}

/** The list reads the page asked for, by their query strings, less the console's scope, which Work's list ignores. */
const listReads = () => asked.filter((u) => u.pathname.endsWith('/initiatives'))
  .map((u) => new URLSearchParams([...u.searchParams].filter(([k]) => k !== 'scope')));

beforeEach(() => {
  asked = [];
  window.history.replaceState(null, '', '/initiatives');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

/** The page with the server's `read`, and a way to hand it the server's next one, as a navigation does. */
function mount(read: InitiativesRead = served()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (r: InitiativesRead) => <QueryClientProvider client={client}><Tooltip.Provider><InitiativesView served={r} /></Tooltip.Provider></QueryClientProvider>;
  const { rerender } = render(ui(read));
  return { next: (r: InitiativesRead) => rerender(ui(r)) };
}

/** Lets anything the page would read in the browser be asked. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

describe('the figures on the initiatives page', () => {
  it('draws each row\'s gates, state and next move as the gateway answered them', () => {
    mount();
    expect(cell('2026-09-28-search-relevance', 'Gates passed')).toBe('1 of 2');
    expect(cell('2026-09-22-payout-schedule', 'Gates passed')).toBe('0 of 1');
    expect(cell('2026-09-28-search-relevance', 'State')).toBe('Waiting');
    expect(cell('2026-09-28-search-relevance', 'Flow position')).toBe('Approve plan.md, waiting on a person');
    expect(document.body.textContent).toContain('23 initiatives');
  });

  it('has no Team column: Work is the active team\'s', () => {
    mount();
    expect([...document.querySelectorAll('th')].map((h) => h.textContent?.trim())).not.toContain('Team');
  });

  it('is drawn from the first page of ten, and the browser asks the gateway nothing beside the server', async () => {
    expect(served().path).toBe('/initiatives?limit=10&offset=0');
    mount();
    await settle();
    expect(listReads()).toEqual([]);
    expect(asked.some((u) => u.searchParams.has('waiting'))).toBe(false);
  });

  it('a filter and a page are the server\'s parameters: the address it reads carries them, and the browser waits for it', async () => {
    window.history.replaceState(null, '', '/initiatives?state=quiet&page=2');
    const { next: navigate } = mount(served());
    await settle();
    // The address moved and the server's answer for it has not arrived: no read beside it, and no stale rows.
    expect(listReads()).toEqual([]);
    expect(document.body.textContent).not.toContain('2026-09-28-search-relevance');
    const next = served('state=quiet&page=2');
    expect(Object.fromEntries(new URLSearchParams(next.path.split('?')[1]))).toEqual({ state: 'quiet', limit: '10', offset: '10' });
    navigate(next);
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    await settle();
    expect(listReads()).toEqual([]);
  });
});
