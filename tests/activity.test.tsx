import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/activity',
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace: (to: string) => window.history.replaceState(null, '', to), refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import type { ActivityLog, ActivitySummary } from '@/lib/destination-shapes';
import { formatCount } from '@/lib/format-units';
import { ACTIVITY_BOUND_MS, fourOwners, type ActivityRead } from '@/views/activity-context';
import { ActivityView } from '@/views/pages/activity';
import ActivityLoading from '../app/(dash)/activity/loading';
import { ME } from '../scripts/fake-gateway/people.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';

/**
 * Activity as the person reads it: the summary the console's server read and handed to the page, and the log the
 * browser reads page by page. Every figure is the fake gateway's own answer for atlas, the one `pnpm verify` serves the
 * page, and the other states are built from it: a team with nothing recorded, a busy one, a summary whose parts failed,
 * and reads that failed or did not answer. The browser counts no owner and filters no row: each row on the page is a row
 * the gateway answered for the address the page asked.
 */
const SUMMARY = activitySummary(ME)[1] as ActivitySummary;
const ok = (data: ActivitySummary): ActivityRead => ({ state: 'ok', data, at: '2026-10-12T09:00:00Z' });
const logOf = (query: URLSearchParams) => activityLog(ME, query)[1] as ActivityLog;
const WEEKS = SUMMARY.weeks.state === 'ok' ? SUMMARY.weeks.data : [];
type RefusalWeek = Extract<ActivitySummary['weeks'], { state: 'ok' }>['data'][number];
const GROUPS = SUMMARY.groups.state === 'ok' ? SUMMARY.groups.data : { rows: [], groups: 0, rest: null };

let asked: string[] = [];
let answerLog: (query: URLSearchParams) => unknown = logOf;
let logStatus = 200;

beforeEach(() => {
  asked = [];
  answerLog = logOf;
  logStatus = 200;
  window.history.replaceState(null, '', '/activity');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    // The console's client adds the scope the superadmin reads in; what is asserted is the page's own address.
    const own = new URLSearchParams(url.searchParams);
    own.delete('scope');
    asked.push(url.pathname + (own.size ? `?${own}` : ''));
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
    if (url.pathname.endsWith('/me')) return json(200, ME);
    if (url.pathname.endsWith('/activity/summary')) return json(200, SUMMARY);
    if (url.pathname.endsWith('/activity')) return logStatus === 200 ? json(200, answerLog(url.searchParams)) : json(logStatus, { error: 'the gateway could not reach its database' });
    return json(404, { error: 'not here' });
  }));
});
afterEach(() => vi.unstubAllGlobals());

/** The view as the shell holds it: a query client that never retries, and the tooltips its tiles' hints are drawn in. */
function draw(read: ActivityRead): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tooltip.Provider><ActivityView read={read} /></Tooltip.Provider></QueryClientProvider>);
}

const tile = (label: string) => screen.getByRole('heading', { name: label, level: 2 }).closest('.card') as HTMLElement;
const figureOf = (label: string) => tile(label).querySelector('[data-value]')!.textContent;
const refusalsCard = () => screen.getByRole('figure', { name: /refused calls by week/ }).closest('.card') as HTMLElement;
const groupsTable = () => screen.getByRole('region', { name: 'Refusals by owner, tool and message' });
const logTable = () => screen.getByRole('region', { name: 'Activity' });
const logAsks = () => asked.filter((a) => /\/activity\?/.test(a));

describe('the tiles', () => {
  it('are the three of the last whole week: the calls with their weeks, the refused with its four owners, the tool refused most', () => {
    draw(ok(SUMMARY));
    expect(figureOf('Calls last week')).toBe(formatCount(SUMMARY.tiles.calls.figure.value!));
    expect(figureOf('Refused last week')).toBe(formatCount(SUMMARY.tiles.refused.figure.value!));
    expect(tile('Refused last week')).toHaveTextContent(fourOwners(SUMMARY.tiles.refused.owners));
    expect(tile('Refused last week')).toHaveTextContent('guardrail');
    expect(tile('Refused last week')).toHaveTextContent('tool failure');
    expect(figureOf('Most refused')).toBe(String(SUMMARY.tiles.mostRefused!.count));
    expect(tile('Most refused')).toHaveTextContent(`${SUMMARY.tiles.mostRefused!.tool}, of ${SUMMARY.tiles.mostRefused!.of}`);
    // The calls carry their shape, a week a point, and the page says its figures were read.
    expect(tile('Calls last week').querySelector('svg')).not.toBeNull();
    expect(document.querySelector('[data-figures="read"]')).not.toBeNull();
  });

  it('read nothing in the browser on mount: the summary is the server\'s', async () => {
    draw(ok(SUMMARY));
    await waitFor(() => expect(logAsks().length).toBeGreaterThan(0));
    expect(asked.some((a) => a.includes('/activity/summary'))).toBe(false);
  });
});

describe('the refusals by week', () => {
  it('is a Column chart with parts: tool failures critical, malformed calls warning, a guardrail and other neutral, each named', () => {
    draw(ok(SUMMARY));
    const card = refusalsCard();
    expect([...card.querySelectorAll('[data-legend] li')].map((li) => li.textContent)).toEqual(['Tool failure', 'Malformed call', 'A guardrail held', 'Other']);
    const tones = (part: string) => [...new Set([...card.querySelectorAll(`[data-part="${part}"]`)].map((p) => p.getAttribute('data-tone')))];
    expect(tones('theirs')).toEqual(['critical']);
    expect(tones('ours')).toEqual(['warning']);
    expect(tones('guardrail')).toEqual(['neutral']);
    expect(tones('other')).toEqual(['neutral']);
    // A column a week, oldest first, the running week last.
    expect(card.querySelectorAll('[data-column]').length).toBe(WEEKS.length);
    expect(card.querySelector('[data-column]:last-child')!.hasAttribute('data-running')).toBe(!WEEKS.at(-1)!.complete);
  });

  it('draws a week of tool failures and others alone, both named and both counted', () => {
    const only = (w: RefusalWeek): RefusalWeek => ({ ...w, refused: 5, owners: { guardrail: 0, ours: 0, theirs: 3, other: 2 } });
    draw(ok({ ...SUMMARY, weeks: { state: 'ok', data: WEEKS.map(only) } }));
    const card = refusalsCard();
    expect(card.querySelectorAll('[data-part="theirs"]').length).toBe(WEEKS.length);
    expect(card.querySelectorAll('[data-part="other"]').length).toBe(WEEKS.length);
    const row = within(card).getAllByRole('row', { hidden: true })[1];
    expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['3', '0', '0', '2', '5']);
  });

  it('says it did not load when the gateway could not read the weeks, and the tiles stand', () => {
    draw(ok({ ...SUMMARY, weeks: { state: 'unavailable', reason: 'query_failed' } }));
    expect(screen.getByText('Refusals did not load')).toBeInTheDocument();
    expect(figureOf('Calls last week')).toBe(formatCount(SUMMARY.tiles.calls.figure.value!));
  });
});

describe('the refusal groups', () => {
  it('lists each owner, tool and message as the gateway grouped them, most first, and says a refusal recorded none', () => {
    draw(ok(SUMMARY));
    const rows = within(groupsTable()).getAllByRole('row').slice(1);
    expect(rows.length).toBe(Math.min(10, GROUPS.rows.length));
    const first = GROUPS.rows[0];
    expect(rows[0]).toHaveTextContent(first.tool);
    expect(rows[0]).toHaveTextContent(first.message!);
    expect(rows[0]).toHaveTextContent(`${first.count}×`);
    const silent = GROUPS.rows.findIndex((g) => g.message === null);
    expect(silent).toBeGreaterThanOrEqual(0);
    expect(rows[silent]).toHaveTextContent('No message recorded');
    expect(rows[silent]).toHaveTextContent('Other');
  });

  it('says the smallest groups are counted together when the gateway folded them', () => {
    draw(ok(extreme(['activity', 'summary'], SUMMARY) as ActivitySummary));
    expect(groupsTable()).toHaveTextContent('the 640 smallest, 91,000 refusals, are counted together');
  });

  it('says it did not load when the gateway could not group them', () => {
    draw(ok({ ...SUMMARY, groups: { state: 'unavailable', reason: 'query_failed' } }));
    expect(screen.getByText('Refusals by owner, tool and message did not load')).toBeInTheDocument();
  });
});

describe('the log', () => {
  it('asks the gateway for the address\'s four filters and its page, and draws the rows it answered', async () => {
    window.history.replaceState(null, '', '/activity?kind=tool_call&tool=core%3Adocument_edit&initiative=2026-09-28-search-relevance&refused=true&page=1');
    draw(ok(SUMMARY));
    await waitFor(() => expect(logAsks()).toContain('/api/console/activity?kind=tool_call&tool=core%3Adocument_edit&initiative=2026-09-28-search-relevance&refused=true&limit=10&offset=0'));
    const answer = logOf(new URLSearchParams('kind=tool_call&tool=core:document_edit&initiative=2026-09-28-search-relevance&refused=true&limit=10&offset=0'));
    await waitFor(() => expect(within(logTable()).getAllByRole('row').length - 1).toBe(Math.max(answer.rows.length, 1)));
    expect(within(logTable()).getByRole('searchbox')).toHaveValue('2026-09-28-search-relevance');
  });

  it('sends the initiative typed to the gateway, and nothing in the browser narrows the rows', async () => {
    draw(ok(SUMMARY));
    await waitFor(() => expect(within(logTable()).getAllByRole('row').length).toBeGreaterThan(1));
    fireEvent.change(within(logTable()).getByRole('searchbox'), { target: { value: '2026-09-28-search-relevance' } });
    await waitFor(() => expect(logAsks().at(-1)).toBe('/api/console/activity?initiative=2026-09-28-search-relevance&limit=10&offset=0'));
  });

  it('pages through the server, ten events a page', async () => {
    draw(ok(SUMMARY));
    const all = logOf(new URLSearchParams());
    expect(all.total).toBeGreaterThan(10);
    await waitFor(() => expect(within(logTable()).getAllByRole('row').length).toBe(11));
    fireEvent.click(within(logTable()).getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(logAsks().at(-1)).toBe('/api/console/activity?limit=10&offset=10'));
  });

  it('keeps a refusal\'s message, and says when none was recorded', async () => {
    window.history.replaceState(null, '', '/activity?refused=true');
    draw(ok(SUMMARY));
    await waitFor(() => expect(within(logTable()).getAllByText('No message recorded').length).toBeGreaterThan(0));
    expect(within(logTable()).getAllByText('Refused').length).toBeGreaterThan(0);
  });

  it('offers Clear filters when the filters match nothing', async () => {
    window.history.replaceState(null, '', '/activity?initiative=no-such-work');
    draw(ok(SUMMARY));
    await waitFor(() => expect(within(logTable()).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument());
  });

  it('says why when the log could not be read, and the summary stands', async () => {
    logStatus = 500;
    draw(ok(SUMMARY));
    await waitFor(() => expect(within(logTable()).getByText('the gateway could not reach its database')).toBeInTheDocument());
    expect(figureOf('Calls last week')).toBe(formatCount(SUMMARY.tiles.calls.figure.value!));
  });
});

describe('every state', () => {
  it('a team with nothing recorded: zero calls, nothing refused, no group and an empty log', async () => {
    answerLog = (q) => empty(['activity'], logOf(q));
    draw(ok(empty(['activity', 'summary'], SUMMARY) as ActivitySummary));
    expect(tile('Most refused')).toHaveTextContent('Nothing refused last week');
    expect(within(groupsTable()).getByText('Nothing refused')).toBeInTheDocument();
    await waitFor(() => expect(within(logTable()).getByText('Nothing recorded yet')).toBeInTheDocument());
  });

  it('a busy team: names longer than any layout planned for, and the log at its ceiling', async () => {
    answerLog = (q) => extreme(['activity'], logOf(q));
    draw(ok(extreme(['activity', 'summary'], SUMMARY) as ActivitySummary));
    await waitFor(() => expect(logTable()).toHaveTextContent('500 events, the latest 500 read'));
  });

  it('a summary that failed on the server: dashes, the gateway\'s sentence, and Retry reads it in the browser', async () => {
    draw({ state: 'failed', reason: 'the gateway could not reach its database' });
    expect(screen.getByText('The week\'s figures did not load')).toBeInTheDocument();
    // `—` is not coming, as `…` would say: every tile of a summary that failed reads it.
    for (const label of ['Calls last week', 'Refused last week', 'Most refused']) expect(figureOf(label)).toBe('—');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    await waitFor(() => expect(asked).toContain('/api/console/activity/summary'));
    await waitFor(() => expect(figureOf('Calls last week')).toBe(formatCount(SUMMARY.tiles.calls.figure.value!)));
  });

  it('a summary that did not answer in time says so, never an endless skeleton', () => {
    draw({ state: 'slow' });
    expect(screen.getByText(`It did not answer within ${ACTIVITY_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
  });

  it('figures the gateway could not read are unavailable, never zero', () => {
    const gone = { ...SUMMARY.tiles.calls, figure: { value: null, why: 'unavailable' as const } };
    draw(ok({ ...SUMMARY, tiles: { calls: gone, refused: { ...SUMMARY.tiles.refused, ...gone }, mostRefused: null } }));
    expect(figureOf('Calls last week')).toBe('Unavailable');
    expect(figureOf('Refused last week')).toBe('Unavailable');
  });

  it('on its way: the three tiles, the chart and both tables, under the page\'s own title', () => {
    render(<ActivityLoading />);
    const busy = screen.getByRole('status', { name: /^Loading / });
    expect(busy.querySelectorAll('.card').length).toBe(3 + 1 + 2);
  });
});
