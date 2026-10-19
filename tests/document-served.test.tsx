import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The console's server's reads, answered without a gateway, and its gate let through: the document's read is under
 * test. `redirect` is tests/setup.ts's, which throws the address it was sent to.
 */
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), gate: async () => null, may: async () => false }));

import { PeriodProvider } from '@/console/period';
import { GatewayError } from '@/data/gateway';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import type { DocumentRead } from '@/views/document-read';
import { INITIATIVES_BOUND_MS } from '@/views/initiatives-context';
import { DocumentView } from '@/views/pages/document';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { DETAIL } from '../scripts/verify.config.ts';
import DocumentPage from '../app/(dash)/initiatives/[team]/[slug]/[...path]/page';

/**
 * A document is read on the console's server and drawn in the first paint (Task I-137, AC-2.9): the route reads it as
 * the person, bounded as every page's server read is, and hands it to the view, which follows it in the browser
 * (`useServed`) rather than reading it first. So the body, the title and the status are in the HTML the route answers,
 * and each state the read can end in is drawn alone: not found, failed, and no answer within the bound.
 */
const SLUG = '2026-09-28-search-relevance';
const AT = `/document/atlas/${SLUG}/spec.md`;
const DOC = documentDetail('atlas', SLUG, 'spec.md')!;
const params = (path = ['spec.md']) => Promise.resolve({ team: 'atlas', slug: SLUG, path });

const ME: Me = {
  email: 'noah.okafor@example.com', name: 'Noah Okafor', role: 'member', mayRead: true,
  superadmin: false, via: 'session', teams: [{ slug: 'atlas', role: 'member' }], activeTeam: 'atlas',
};

/** Every read the browser sent, by address. */
let reads: string[] = [];
/** The browser's answers: `null` leaves a read unanswered. */
let answer: (path: string, init?: RequestInit) => [number, unknown] | null = () => null;

beforeEach(() => {
  reads = [];
  answer = () => null;
  gateway.get.mockReset();
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    reads.push(url);
    const said = answer(url.replace(/^\/api\/console/, '').replace(/[?&]scope=platform/, ''), init);
    if (!said) return new Promise(() => {});
    const [status, body] = said;
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const tree = (client: QueryClient, ui: ReactNode) => (
  <QueryClientProvider client={client}><PeriodProvider><Tooltip.Provider>{ui}</Tooltip.Provider></PeriodProvider></QueryClientProvider>
);
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

/**
 * The page the console's server sends for `ui`, in `container`, as a browser holds it once the stream has finished:
 * a boundary that resolved after the shell arrives as hidden markup with a script that puts it in place, which
 * `innerHTML` leaves unrun, so each is run here as the browser runs it.
 */
async function serve(ui: ReactNode, container: HTMLElement): Promise<void> {
  const { prelude } = await prerender(ui);
  container.innerHTML = await new Response(prelude).text();
  for (const script of container.querySelectorAll('script')) new Function(script.textContent ?? '')();
}

/** The browser's reads of the document itself; the version chain reads earlier snapshots of it on its own. */
const documentReads = (at = AT) => reads.filter((u) => u.startsWith(`/api/console${at}`) && !u.includes('revision='));
/** Where primary-data and the states check find a document's body: its rendered text, or its plain text before that. */
const BODY = DETAIL[`/initiatives/atlas/${SLUG}/spec.md`]!.replace(/\bmain /g, '');
/** Nothing in the page's main part says it is still on its way: no busy region and no skeleton. */
const alone = (root: ParentNode) => {
  expect(root.querySelector('[aria-busy="true"]')).toBeNull();
  expect(root.querySelectorAll('.shimmer')).toHaveLength(0);
};

describe('the document route, rendered on the console\'s server', () => {
  it('carries the document\'s body, title and status, and the browser takes it over without reading it', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === AT) return DOC;
      throw new GatewayError(404, 'HTTP 404');
    });
    const page = await DocumentPage({ params: params(), searchParams: Promise.resolve({}) });
    expect(gateway.get).toHaveBeenCalledWith(AT);

    const container = document.body.appendChild(document.createElement('div'));
    try {
      await serve(tree(client(), page), container);
      expect(container.innerHTML).not.toContain('<!--$?-->');
      const text = container.textContent ?? '';
      expect(text).toContain(DOC.title);
      expect(text).toContain('People search the research archive by the words they remember');
      expect(text).toContain('Approved');
      // The masthead's status is the document's own, never the placeholder that stands while a read is on its way.
      expect(container.querySelector('header')?.textContent).toContain('Approved');
      expect(container.querySelector('header .shimmer')).toBeNull();
      // The body is readable as it arrives: nothing around it is busy or a skeleton.
      const body = container.querySelector(BODY);
      expect(body?.textContent).toContain('People search the research archive');
      expect(body?.closest('[aria-busy="true"], .shimmer')).toBeNull();

      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, tree(client(), page), { onRecoverableError: (e) => mismatches.push(e) }); });
      await settle();
      expect(mismatches).toEqual([]);
      expect(container.textContent).toContain('People search the research archive by the words they remember');
      expect(documentReads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the document whose path has a directory in it, segment by segment', async () => {
    gateway.get.mockImplementation(async () => { throw new GatewayError(404, 'HTTP 404'); });
    await DocumentPage({ params: params(['sources', '2026-10-06%20call.md']), searchParams: Promise.resolve({}) });
    expect(gateway.get).toHaveBeenCalledWith(`/document/atlas/${SLUG}/sources/2026-10-06 call.md`);
  });

  it('sends a session that ended to sign in, back to the document', async () => {
    gateway.get.mockRejectedValue(new GatewayError(401, 'Sign in again.'));
    await expect(DocumentPage({ params: params(), searchParams: Promise.resolve({}) })).rejects.toThrow(`NEXT_REDIRECT /login?next=${encodeURIComponent(`/initiatives/atlas/${SLUG}/spec.md`)}`);
  });
});

describe('each state the server\'s read ends in, drawn alone', () => {
  async function drawn(failure: () => Promise<never>) {
    gateway.get.mockImplementation(failure);
    const page = await DocumentPage({ params: params(), searchParams: Promise.resolve({}) });
    await act(async () => { render(tree(client(), page)); });
  }

  it('not found: says the document does not exist, as an address that names nothing', async () => {
    await drawn(async () => { throw new GatewayError(404, 'No document spec.md in this initiative.'); });
    // primary-data and the states check read a record answered as not existing by this title (`main p.t-card`).
    expect(screen.getByText('This document does not exist')).toHaveClass('t-card');
    expect(screen.getByText('No document spec.md in this initiative.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    alone(document.body);
    await settle();
    expect(documentReads()).toEqual([]);
  });

  it('refused or failed: the gateway\'s sentence and Retry, which reads it in the browser', async () => {
    await drawn(async () => { throw new GatewayError(403, 'You may not read this initiative.'); });
    expect(screen.getByRole('alert')).toHaveTextContent('This document did not load');
    expect(screen.getByRole('alert')).toHaveTextContent('You may not read this initiative.');
    alone(document.body);

    answer = (path) => (path === AT ? [200, DOC] : null);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('People search the research archive by the words they remember', { exact: false })).toBeInTheDocument();
    expect(documentReads()).toHaveLength(1);
  });

  it('unanswered within the bound: says so, with Retry, instead of waiting longer', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const pending = DocumentPage({ params: params(), searchParams: Promise.resolve({}) });
    await vi.advanceTimersByTimeAsync(INITIATIVES_BOUND_MS);
    const page = await pending;
    vi.useRealTimers();
    await act(async () => { render(tree(client(), page)); });
    expect(screen.getByRole('alert')).toHaveTextContent(`The read did not answer within ${INITIATIVES_BOUND_MS / 1000} seconds.`);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    alone(document.body);
  });
});

describe('the browser, following the server\'s read', () => {
  const served = (doc: DocumentDetail = DOC): DocumentRead => ({ state: 'ok', data: doc, at: '2026-10-18T00:00:00.000Z' });
  const view = (read: DocumentRead) => <DocumentView team="atlas" slug={SLUG} rel="spec.md" served={read} teamPage={false} />;

  it('reads the document again once something says it changed, and draws what it brought', async () => {
    const c = client();
    await act(async () => { render(tree(c, view(served()))); });
    await settle();
    expect(documentReads()).toEqual([]);

    answer = (path) => (path === AT ? [200, { ...DOC, body: 'What it says now.' }] : null);
    await act(() => c.invalidateQueries({ queryKey: ['console'] }));
    expect(await screen.findByText('What it says now.')).toBeInTheDocument();
    expect(documentReads()).toHaveLength(1);
  });

  it('keeps a state the server\'s read ended in on screen, and its Retry neither busy nor disabled, while a change makes the browser read it again', async () => {
    // A change anywhere to documents reads a missing or failed document again. Until that read answers, the page says
    // what it said, so a keyboard user on Retry keeps their place (`pnpm verify`'s keyboard path lost it, #3763). Retry
    // is not busy for a read the person did not ask for: the managed Button disables a busy button, and a focused
    // control that becomes disabled loses focus.
    for (const read of [{ state: 'missing', reason: 'No document spec.md in this initiative.' }, { state: 'failed', reason: 'The gateway did not answer.' }] as const) {
      const c = client();
      const { unmount } = render(tree(c, view(read)));
      await settle();
      const retry = screen.getByRole('button', { name: 'Retry' });
      retry.focus();
      expect(documentReads()).toEqual([]);

      await act(() => { void c.invalidateQueries({ queryKey: ['console'] }); });
      await waitFor(() => expect(documentReads()).toHaveLength(1));
      expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry);
      expect(retry).not.toHaveAttribute('aria-busy');
      expect(retry).not.toBeDisabled();
      expect(document.activeElement).toBe(retry);
      expect(document.querySelectorAll('.shimmer')).toHaveLength(0);
      unmount();
      reads = [];
    }
  });

  it('records what a Reload brought as shown, when an Approve conflict raised it over the server\'s read', async () => {
    const plan = documentDetail('atlas', SLUG, 'plan.md')!;
    const planAt = `/document/atlas/${SLUG}/plan.md`;
    const shown: Record<string, unknown>[] = [];
    answer = (path, init) => {
      if (path === '/me') return [200, ME];
      if (path.startsWith('/documents/shown')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        shown.push(body);
        return [200, { ok: true, review_context: 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb', content_revision: body.content_revision, recorded: true }];
      }
      if (path.startsWith('/documents/approve')) return [409, { conflict: 'changed', error: 'plan.md changed after this page showed it.' }];
      if (path === planAt) return [200, plan];
      return null;
    };
    const user = userEvent.setup();
    await act(async () => { render(tree(client(), <DocumentView team="atlas" slug={SLUG} rel="plan.md" served={served(plan)} teamPage={false} />)); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(await screen.findByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(documentReads(planAt)).toHaveLength(1);
    expect(shown.map((b) => [b.content_revision, b.review_context])).toEqual([
      [plan.content_revision, undefined], [plan.content_revision, 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb'],
    ]);
  });
});
