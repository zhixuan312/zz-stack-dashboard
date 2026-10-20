import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import type { DocumentDetail, InitiativeDetail, KnowledgeBody, KnowledgeLog } from '@/lib/api-shapes';
import type { KnowledgeSummary } from '@/lib/destination-shapes';
import type { InitiativeRead } from '@/views/initiative-context';
import type { ServerRead } from '@/views/knowledge-context';
import { DocumentView } from '@/views/pages/document';
import { InitiativeView } from '@/views/pages/initiative';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import KnowledgeLoading from '../app/(dash)/knowledge/loading';
import KnowledgeLogLoading from '../app/(dash)/knowledge/log/loading';
import NodeLoading from '../app/(dash)/knowledge/[team]/[...path]/loading';
import InitiativeLoading from '../app/(dash)/initiatives/[team]/[slug]/loading';
import DocumentLoading from '../app/(dash)/initiatives/[team]/[slug]/[...path]/loading';
import PluginLoading from '../app/(dash)/plugins/[plugin]/loading';
import SkillLoading from '../app/(dash)/plugins/[plugin]/[skill]/loading';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * Work's pages in the states no other test drew (Task I-126, AC-2.9), each drawn from the fake gateway's own answer in
 * that state, asked as `pnpm verify`'s sweep asks it: the session value `<person>+<state>` (scripts/fake-gateway/
 * states-partial.ts). So what is drawn here is what `scripts/states-check.ts` draws in a browser. A route's loading state
 * is its `loading.tsx`, which is what a person sees while the console's server reads; a page whose reads are the
 * browser's is drawn with its read unanswered.
 *
 * Each state is drawn as its explicit state: the loading state busy and naming nothing, an empty record saying it is
 * empty, an error saying what failed with a way to try again, and a partial answer drawing what answered beside the
 * words for what did not.
 */
let base = '';
let stop = () => {};
beforeAll(async () => {
  const gateway = await startFakeGateway();
  base = gateway.base;
  stop = () => gateway.proc.kill();
});
afterAll(() => stop());
afterEach(() => vi.unstubAllGlobals());

const realFetch = globalThis.fetch;
const AT = '2026-10-18T00:00:00Z';
const NODE = 'nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md';
const SLUG = '2026-09-28-search-relevance';

/** One read as the console's server makes it, for the member in `state`. */
async function served<T>(state: string, path: string): Promise<ServerRead<T>> {
  const res = await realFetch(`${base}/api/console${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: `zz_console=member+${state}` } });
  const body = await res.json() as T & { error?: string };
  return res.ok ? { state: 'ok', data: body, at: AT } : { state: 'failed', reason: body.error ?? `HTTP ${res.status}` };
}

/** The browser's reads, sent to the fake gateway for the member in `state`. */
function browser(state: string) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(`${base}${String(input)}`, { method: init?.method, body: init?.body, headers: { accept: 'application/json', cookie: `zz_console=member+${state}` } })));
}

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
/** The page is no longer saying it is on its way: every read it made answered. */
const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 5_000 });
/** An error the page draws in place of what failed, with Retry beside it. */
const failedWithRetry = () => {
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0);
};

describe('each route\'s loading state, while the console\'s server reads', () => {
  it.each([
    ['Knowledge', KnowledgeLoading], ['the knowledge log', KnowledgeLogLoading], ['a knowledge node', NodeLoading],
    ['an initiative', InitiativeLoading], ['a document', DocumentLoading], ['a plugin', PluginLoading], ['a skill', SkillLoading],
  ])('%s is busy at once', (_, Loading) => {
    render(<Loading />);
    expect(screen.getByRole('status', { name: /^Loading (page|document)$/ })).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Knowledge', () => {
  it('empty: a shelf with nothing on it says so, and no figure stands for a week nobody searched', async () => {
    browser('empty');
    await act(async () => { mount(<KnowledgeView read={await served<KnowledgeSummary>('empty', '/knowledge/summary')} />); });
    await settled();
    expect(text()).toMatch(/No (lesson|question|search)|Nothing/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('partial: the part that failed says so, and every part that answered is still drawn', async () => {
    browser('partial');
    const read = await served<KnowledgeSummary>('partial', '/knowledge/summary');
    expect(read.state === 'ok' && read.data.questions.state).toBe('unavailable');
    await act(async () => { mount(<KnowledgeView read={read} />); });
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // The tiles and the newest lessons answered.
    expect(document.querySelector('[data-figures="read"]')).not.toBeNull();
    const newest = read.state === 'ok' && read.data.newest.state === 'ok' ? read.data.newest.data : [];
    expect(newest.length).toBeGreaterThan(0);
    expect(text()).toContain(newest[0].title);
  });
});

describe('the knowledge log', () => {
  it('empty: says nothing was recorded, not that it did not load', async () => {
    await act(async () => { mount(<KnowledgeLogView read={await served<KnowledgeLog>('empty', '/knowledge/log')} />); });
    await settled();
    expect(text()).toMatch(/No (lesson|entr|change)|Nothing/);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a knowledge node', () => {
  const draw = async (state: string) => {
    const read = await served<KnowledgeBody>(state, `/knowledge/atlas/${NODE}`);
    await act(async () => { mount(<KnowledgeNodeView read={read} team="atlas" rel={NODE} />); });
    return read;
  };

  it('empty: a lesson with no text says it has none', async () => {
    browser('empty');
    const read = await draw('empty');
    expect(read.state === 'ok' && read.data.body).toBe('');
    await settled();
    expect(text()).toMatch(/no text|nothing (is )?written|is empty/i);
  });

  it('error: says the node did not load, with the gateway\'s sentence and Retry', async () => {
    browser('error');
    await draw('error');
    failedWithRetry();
    expect(text()).toContain('The gateway could not reach its database');
  });
});

describe('an initiative', () => {
  const draw = async (state: string) => {
    const read = await served<InitiativeDetail>(state, `/initiatives/atlas/${SLUG}`);
    const served_: InitiativeRead = read.state === 'ok' ? { state: 'ok', data: read.data, team: 'atlas', at: AT } : read.state === 'failed' ? read : { state: 'slow' };
    await act(async () => { mount(<InitiativeView team="atlas" slug={SLUG} served={served_} />); });
  };

  it('empty: an initiative with nothing written says so', async () => {
    browser('empty');
    await draw('empty');
    await settled();
    expect(text()).toContain('Nothing written yet');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error: says the initiative did not load, with Retry', async () => {
    browser('error');
    await draw('error');
    failedWithRetry();
  });
});

describe('a document', () => {
  const draw = async (state: string) => {
    const read = await served<DocumentDetail>(state, `/document/atlas/${SLUG}/spec.md`);
    await act(async () => { mount(<DocumentView team="atlas" slug={SLUG} rel="spec.md" served={read} teamPage={false} />); });
  };

  it('empty: a document with no body says it has none', async () => {
    browser('empty');
    await draw('empty');
    expect(await screen.findByText('This document has no body in the store.')).toBeInTheDocument();
    await settled();
  });

  it('error: says the document did not load, with Retry', async () => {
    browser('error');
    await draw('error');
    expect(await screen.findByText('This document did not load')).toBeInTheDocument();
    failedWithRetry();
  });

  it('is the answer the fake gives an empty document', async () => {
    const read = await served<DocumentDetail>('empty', `/document/atlas/${SLUG}/spec.md`);
    expect(read).toMatchObject({ state: 'ok', data: { body: null, versions: [], sources: [] } });
  });
});
