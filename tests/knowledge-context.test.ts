import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Next's router as far as an address goes: `replace` moves it, which is what the page's own state is read from. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace: (url: string) => window.history.replaceState(null, '', url), refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

/**
 * Knowledge's agent side (Task I-108): where the page hands its search to the assistant, and what the assistant is told
 * and may read.
 *
 * - Ask sits in the head of the search card, asking about the question and its results, and is there only when the
 *   console offers an assistant.
 * - `view_knowledge` answers the same `KnowledgeSummary` the page's server read is, by the shelf route's own arguments
 *   and never the search; `view_search` the same ranked results the page's search is; and `explore_knowledge` declares
 *   the shelf, the lessons made and the searches, each answered by Work's `/work/query`.
 * - The context carries the question, the results in view, the inventory and the questions that found nothing.
 * - Nothing the assistant is offered here adds or supersedes a lesson: every read is a GET, and no source writes.
 *
 * The gateway is `fetch`, answering from the fake gateway's own fixtures, the ones `pnpm verify` serves, and every
 * request this app makes is recorded with its method.
 */
import { SurfaceOverride } from '@/components/base/surface';
import { PREPARED } from '@/data/prepared';
import { preparedCollection } from '@/data/prepared-aggregate';
import type { SearchAnswer } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { contextText } from '@/lib/shared-context';
import { knowledgeContext, type ServerRead } from '@/views/knowledge-context';
import { KNOWLEDGE_EXPLORE } from '@/views/knowledge-explore';
import { KnowledgeView, SEARCH_TITLE } from '@/views/pages/knowledge';
import { knowledgeTool } from '@/views/tools/knowledge';
import { knowledgeLogTool } from '@/views/tools/knowledge-log';
import { knowledgeNodeTool } from '@/views/tools/knowledge-node';
import { searchTool } from '@/views/tools/search';
import { ME } from '../scripts/fake-gateway/people.ts';
import { search } from '../scripts/fake-gateway/search.ts';
import { KNOWLEDGE } from '../scripts/fake-gateway/work.ts';
import { KNOWLEDGE_LOG, knowledgeList, knowledgeSummary, lesson } from '../scripts/fake-gateway/work-knowledge.ts';

const SUMMARY = knowledgeSummary(ME)[1] as KnowledgeSummary;
const LIST = knowledgeList(ME, new URLSearchParams())[1] as KnowledgeList;
const QUESTION = 'latency budget';
const ANSWER: SearchAnswer = search(QUESTION, 10, null);
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };

/** Every request this app's server made: its address and method. */
let calls: { url: string; method: string }[] = [];
const saved = { fetch: global.fetch, env: { ...process.env } };

/** The gateway, as `fetch`, answering the superadmin from the fake's fixtures. */
function gateway() {
  calls = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://console.test');
    calls.push({ url: String(input), method: init?.method ?? 'GET' });
    const path = url.pathname.replace('/api/console', '');
    const q = url.searchParams;
    const body = path === '/me' ? ME
      : path === '/knowledge/summary' ? SUMMARY
        : path === '/knowledge' ? knowledgeList(ME, q)[1]
          : path === '/knowledge/log' ? { entries: KNOWLEDGE_LOG }
            : path === '/search' ? search(q.get('q') ?? '', Number(q.get('limit') ?? 5), q.get('initiative'))
              : path.startsWith('/knowledge/') ? lesson(path.split('/')[2], path.split('/').slice(3).join('/'))
                : path === '/work/query' ? { groups: [{ key: 'decision', value: { value: 2, why: null } }], rest: null, total: { value: 2, why: null }, rows: null }
                  : {};
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test' });
  delete process.env.ZZ_DEV_PAT;
  gateway();
});
afterEach(() => {
  global.fetch = saved.fetch;
  process.env = { ...saved.env };
});

const READ: ServerRead<KnowledgeSummary> = { state: 'ok', data: SUMMARY, at: '2026-10-12T09:00:00Z' };

/** The page on the console's surface, with an assistant when `ask` is given, and the tooltips Ask is drawn in. */
function mount(ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree: ReactNode = createElement(QueryClientProvider, { client }, createElement(KnowledgeView, { read: READ }));
  render(createElement(SurfaceOverride, { surface: ask ? { ask } : {} } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, tree)));
}

/** The card an element sits in, and whether it sits in that card's head rather than its body. */
function inHeadOf(el: HTMLElement): HTMLElement | null {
  const card = el.closest('.card') as HTMLElement | null;
  return card && card.firstElementChild?.contains(el) ? card : null;
}

describe('Ask on the Knowledge page', () => {
  it('sits in the search card\'s head and asks about the question and its results', async () => {
    window.history.replaceState(null, '', '/knowledge');
    const ask = vi.fn();
    mount(ask);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Question' }), { target: { value: QUESTION } });
    await act(async () => { fireEvent.submit(screen.getByRole('search')); });
    const button = await screen.findByRole('button', { name: `Ask: What do the results for "${QUESTION}" say, and what do they leave open?` });
    const card = inHeadOf(button);
    expect(card, 'Ask is in a card\'s head').not.toBeNull();
    expect(card!.querySelector('h2, h3')?.textContent).toBe(SEARCH_TITLE);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(`What do the results for "${QUESTION}" say, and what do they leave open?`);
  });

  it('is there before any question, and absent when the console offers no assistant', async () => {
    window.history.replaceState(null, '', '/knowledge');
    mount(vi.fn());
    const [first] = await screen.findAllByRole('button', { name: /^Ask: / });
    expect(inHeadOf(first)?.querySelector('h2, h3')?.textContent).toBe(SEARCH_TITLE);
    document.body.innerHTML = '';
    mount();
    await waitFor(() => expect(document.body.textContent).toContain(SEARCH_TITLE));
    expect(screen.queryAllByRole('button', { name: /^Ask: / })).toEqual([]);
  });
});

describe('what the assistant reads from Knowledge', () => {
  it('view_knowledge answers the same KnowledgeSummary the page is handed, and the shelf\'s page', async () => {
    const { data } = await knowledgeTool.read({});
    expect(data.summary).toEqual(SUMMARY);
    expect(data.list).toEqual(LIST);
    expect(Object.keys(data).sort()).toEqual(['list', 'summary']);
  });

  it('view_knowledge takes the shelf route\'s own arguments, sends them to it, and never reads the search', async () => {
    expect(Object.keys(knowledgeTool.input.shape)).toEqual(['q', 'kind', 'limit', 'offset']);
    const { data, context } = await knowledgeTool.read({ q: 'search', kind: 'decision', limit: 5, offset: 10 });
    expect(calls.map((c) => c.url)).toContain('http://gateway.test/api/console/knowledge?q=search&kind=decision&limit=5&offset=10&scope=platform');
    expect(calls.some((c) => c.url.includes('/api/console/search'))).toBe(false);
    expect(data.list).toEqual(knowledgeList(ME, new URLSearchParams('q=search&kind=decision&limit=5&offset=10'))[1]);
    // The page has no words filter: its address is the kind and the page of ten the rows fall in, and the context says
    // that address does not show exactly these rows.
    expect(context.address).toBe('/knowledge?kind=decision&page=2');
    expect(context.scope).toContain('lessons matching "search"');
    expect(context.unknowns.some((u) => u.includes('does not show exactly these lessons'))).toBe(true);
  });

  it('view_knowledge at the page\'s own rows addresses them exactly', async () => {
    const { context } = await knowledgeTool.read({ kind: 'decision', offset: 10 });
    expect(context.address).toBe('/knowledge?kind=decision&page=2');
    expect(context.unknowns.some((u) => u.includes('does not show exactly'))).toBe(false);
  });

  it('view_search answers the same ranked results, in the same order', async () => {
    const { data } = await searchTool.read({ q: QUESTION, limit: 8 });
    expect(data).toEqual(search(QUESTION, 8, null));
    expect(data.results.map((r) => r.path)).toEqual(ANSWER.results.slice(0, 8).map((r) => r.path));
  });

  it('explore_knowledge declares the shelf, the lessons made and the searches, each over /work/query', async () => {
    expect(knowledgeTool.explore).toBe(KNOWLEDGE_EXPLORE);
    expect(Object.keys(KNOWLEDGE_EXPLORE.sources)).toEqual(['shelf', 'lessons', 'searches']);
    // The log is the page's log, and offers the page's prepared query.
    expect(knowledgeLogTool.explore).toBe(KNOWLEDGE_EXPLORE);
    for (const source of Object.values(KNOWLEDGE_EXPLORE.sources)) {
      const row = PREPARED.find((r) => r.name === source.collection)!;
      expect(row.route, `${source.collection} is Work's`).toBe('work');
      calls = [];
      await preparedCollection(row).aggregate({ measures: [{ name: 'n', agg: 'count' }] });
      expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/api/console/work/query']);
      expect(new URL(calls[0].url).searchParams.get('measure')).toBe(row.measure);
    }
  });

  it('the context carries the question, the results in view, the inventory and the questions that found nothing', () => {
    const c = knowledgeContext({ summary: SUMMARY, list: LIST, filters: { q: QUESTION, kind: 'all' }, page: 1, search: ANSWER, ...arrival });
    const text = contextText(c);
    expect(c.scope).toContain(`searched for "${QUESTION}"`);
    expect(c.insights[0].text).toContain(`The search for "${QUESTION}" ranked ${ANSWER.ranked_total}`);
    for (const r of ANSWER.results.slice(0, 3)) expect(text).toContain(r.title.slice(0, 40));
    expect(c.facts.find((f) => f.label === 'Results')?.value).toBe(`${ANSWER.results.length} of ${ANSWER.ranked_total} ranked`);
    expect(c.facts.find((f) => f.label === 'Lessons adopted')?.value).toBe(String(SUMMARY.tiles.standing.value));
    expect(c.facts.find((f) => f.label === 'Superseded')?.value).toBe(String(SUMMARY.tiles.superseded.value));
    expect(c.facts.find((f) => f.label === 'Searches with no result')?.value).toBe(String(SUMMARY.tiles.noResult.figure.value));
    expect(text).toContain('"how do we rotate the signing key" 3×');
    expect(text.length).toBeLessThanOrEqual(2400);
  });

  it('the context says a result is retrieval coverage, and a shared lesson is addressed for anybody', () => {
    const shared = search('recency', 10, null).results.find((r) => r.shelf === 'platform');
    expect(shared, 'the fake\'s shared shelf answers recency').toBeTruthy();
    const c = knowledgeContext({ summary: SUMMARY, list: LIST, filters: { q: 'recency', kind: 'all' }, page: 1, search: search('recency', 10, null), ...arrival });
    expect(c.unknowns.some((u) => u.includes('retrieval coverage'))).toBe(true);
    expect(contextText(c)).toContain('(the shared shelf');
  });
});

describe('the assistant never adds or supersedes a lesson', () => {
  it('every Knowledge read it is offered is a GET, and none names a write', async () => {
    const node = KNOWLEDGE[0];
    await knowledgeTool.read({ q: QUESTION });
    await searchTool.read({ q: QUESTION });
    await knowledgeNodeTool.read({ team: node.team, path: node.path });
    await knowledgeLogTool.read({});
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls.some((c) => /knowledge_(add|supersede)|\/(add|supersede)\b/.test(c.url))).toBe(false);
    for (const t of [knowledgeTool, searchTool, knowledgeNodeTool, knowledgeLogTool]) {
      expect(t.name).not.toMatch(/add|supersede|write|edit/);
      expect(Object.keys(t)).not.toContain('write');
    }
  });
});
