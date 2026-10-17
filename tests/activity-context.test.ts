import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/activity',
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace: (to: string) => window.history.replaceState(null, '', to), refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), requireNeed: async () => undefined }));

import { SurfaceOverride } from '@/components/base/surface';
import { PREPARED } from '@/data/prepared';
import type { ActivityLog, ActivitySummary, RefusalGroup } from '@/lib/destination-shapes';
import { formatDay } from '@/lib/format-date';
import { contextText } from '@/lib/shared-context';
import { NO_FILTER, activityContext, weekOf, type ActivityRead } from '@/views/activity-context';
import { ActivityView } from '@/views/pages/activity';
import { activityTool } from '@/views/tools/activity';
import { ME } from '../scripts/fake-gateway/people.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';

/**
 * Activity's agent side: the Ask on the refusals card, which asks about the week the person points at; `view_activity`,
 * which reads what the page reads and tells the assistant what the page tells it; `explore_activity`'s prepared query;
 * and the context itself, which carries the week, its four owners, the groups in view and the filters, and never a
 * sentence of another team's.
 */
const SUMMARY = activitySummary(ME)[1] as ActivitySummary;
const logOf = (query: URLSearchParams) => activityLog(ME, query)[1] as ActivityLog;
const LOG = logOf(new URLSearchParams());
const WEEKS = SUMMARY.weeks.state === 'ok' ? SUMMARY.weeks.data : [];
const GROUPS = SUMMARY.groups.state === 'ok' ? SUMMARY.groups.data.rows : [];
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const ASK = /^Ask: /;

beforeEach(() => {
  window.history.replaceState(null, '', '/activity');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const body = url.pathname.endsWith('/me') ? ME : url.pathname.endsWith('/activity/summary') ? SUMMARY : logOf(url.searchParams);
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
  gateway.get.mockReset();
  gateway.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://gateway.test');
    return url.pathname === '/activity/summary' ? SUMMARY : logOf(url.searchParams);
  });
});
afterEach(() => vi.unstubAllGlobals());

/** The page on the console's surface, with an assistant when `ask` is given. */
function draw(ask?: (q: string) => void) {
  const read: ActivityRead = { state: 'ok', data: SUMMARY, at: '2026-10-12T09:00:00Z' };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = createElement(QueryClientProvider, { client }, createElement(Tooltip.Provider, null, createElement(ActivityView, { read })));
  render(createElement(SurfaceOverride, { surface: ask ? { ask } : {} } as never, view));
}

const refusalsCard = () => screen.getByRole('figure', { name: /refused calls by week/ }).closest('.card') as HTMLElement;

describe('the Ask on the refusals card', () => {
  it('sits in the card\'s head, asking about last week, then about the week the cursor points at', async () => {
    const ask = vi.fn();
    draw(ask);
    const card = refusalsCard();
    const button = within(card).getByRole('button', { name: ASK });
    expect(card.firstElementChild!.contains(button)).toBe(true);
    expect(button).toHaveAccessibleName('Ask: What was refused last week, and which group of refusals should we fix first?');
    // The page has one Ask, and this is it: the refusals are its protagonist.
    expect(screen.getAllByRole('button', { name: ASK })).toHaveLength(1);
    fireEvent.keyDown(within(card).getByRole('group'), { key: 'Home' });
    const question = `What was refused in the week of ${formatDay(WEEKS[0].window.from)}, and who is each refusal put down to?`;
    const pointed = await within(card).findByRole('button', { name: `Ask: ${question}` });
    fireEvent.click(pointed);
    expect(ask).toHaveBeenCalledWith(question);
  });

  it('is absent when the console offers no assistant', () => {
    draw();
    expect(screen.queryAllByRole('button', { name: ASK })).toEqual([]);
  });

  it('tells the assistant the week the cursor rests on, with its four owners', async () => {
    const shared: string[] = [];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const read: ActivityRead = { state: 'ok', data: SUMMARY, at: '2026-10-12T09:00:00Z' };
    const view = createElement(QueryClientProvider, { client }, createElement(Tooltip.Provider, null, createElement(ActivityView, { read })));
    render(createElement(SurfaceOverride, { surface: { share: (text: string) => shared.push(text) } } as never, view));
    fireEvent.keyDown(within(refusalsCard()).getByRole('group'), { key: 'Home' });
    await waitFor(() => expect(shared.at(-1)).toContain(`The person is pointing at: the ${weekOf(WEEKS[0].window)}`));
  });
});

describe('view_activity', () => {
  it('takes the spec\'s arguments and nothing more', () => {
    expect(Object.keys(activityTool.input.shape)).toEqual(['kind', 'tool', 'initiative', 'refused', 'limit', 'offset']);
    expect(activityTool.input.safeParse({ refused: 'yes' }).success).toBe(false);
    expect(activityTool.input.safeParse({ initiative: '../settings' }).success).toBe(false);
    expect(activityTool.input.safeParse({ tool: 'core:document_edit', kind: 'document.patch', offset: 10 }).success).toBe(true);
    expect(activityTool.page).toBe('/activity');
  });

  it('answers the same ActivitySummary the page draws, and the page of the log the page asks for', async () => {
    const { context, data } = await activityTool.read({});
    expect(gateway.get).toHaveBeenCalledWith('/activity/summary');
    expect(gateway.get).toHaveBeenCalledWith('/activity?limit=10&offset=0');
    expect(data.summary).toEqual(SUMMARY);
    expect(data.log).toEqual(LOG);
    const page = activityContext({ summary: SUMMARY, log: LOG, ...arrival });
    expect(context.facts).toEqual(page.facts);
    expect(context.insights).toEqual(page.insights);
  });

  it('reads the log by the filters and the page it is given, and its context is at that page', async () => {
    const { context } = await activityTool.read({ refused: 'true', tool: 'core:document_edit', offset: 10 });
    expect(gateway.get).toHaveBeenCalledWith('/activity?tool=core%3Adocument_edit&refused=true&limit=10&offset=10');
    expect(context.address).toBe('/activity?tool=core%3Adocument_edit&refused=true&page=2');
    expect(context.scope).toContain('tool core:document_edit, refused calls only');
  });
});

describe('explore_activity', () => {
  it('declares the calls and the refusals, each over /work/query', () => {
    const sources = activityTool.explore.sources;
    expect(Object.keys(sources)).toEqual(['calls', 'refusals']);
    for (const s of Object.values(sources)) expect(PREPARED.find((r) => r.name === s.collection)?.route, s.collection).toBe('work');
    expect(Object.keys(sources.refusals.filters ?? {})).toContain('owner');
  });
});

describe('the context', () => {
  it('carries the week the person points at, with its four owners', () => {
    const last = WEEKS.length - 2;
    const w = WEEKS[last];
    const c = activityContext({ summary: SUMMARY, log: LOG, index: last, ...arrival });
    expect(c.focus).toContain(`the ${weekOf(w.window)}`);
    expect(c.focus).toContain(`${w.calls} calls, ${w.refused} refused`);
    for (const owner of ['guardrail', 'malformed', 'tool failure', 'other']) expect(c.focus).toContain(owner);
    expect(activityContext({ summary: SUMMARY, ...arrival }).focus).toBeUndefined();
  });

  it('carries the groups in view, the page of the table the person reads', () => {
    const many: RefusalGroup[] = Array.from({ length: 14 }, (_, i) => ({ ...GROUPS[0], tool: `core:tool_${i + 1}`, count: 20 - i }));
    const summary: ActivitySummary = { ...SUMMARY, groups: { state: 'ok', data: { rows: many, groups: 14, rest: null } } };
    const first = contextText(activityContext({ summary, groupsPage: 1, ...arrival }));
    expect(first).toContain('groups 1 to 10 of 14 in view');
    expect(first).toContain('core:tool_1,');
    const second = contextText(activityContext({ summary, groupsPage: 2, ...arrival }));
    expect(second).toContain('groups 11 to 14 of 14 in view');
    expect(second).toContain('core:tool_11,');
    expect(second).not.toContain('core:tool_1,');
  });

  it('carries the filters in force, in its scope and its address', () => {
    const filters = { ...NO_FILTER, kind: 'tool_call', initiative: '2026-09-28-search-relevance', refused: 'false' };
    const c = activityContext({ summary: SUMMARY, log: logOf(new URLSearchParams('kind=tool_call&initiative=2026-09-28-search-relevance&refused=false')), filters, page: 1, ...arrival });
    expect(c.scope).toContain('kind tool_call, initiative 2026-09-28-search-relevance, calls not refused and other events');
    expect(c.address).toBe('/activity?kind=tool_call&initiative=2026-09-28-search-relevance&refused=false');
  });

  it('carries no other team\'s message, and none of the platform\'s maintenance', () => {
    const text = contextText(activityContext({ summary: SUMMARY, log: LOG, index: 0, ...arrival }));
    expect(text).toContain('No message recorded');
    expect(text).not.toMatch(/beacon|chargeback|refund-flow|reindex/);
  });
});
