import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PeriodProvider } from '@/console/period';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import DocumentPage from '../app/(dash)/initiatives/[team]/[slug]/[...path]/page';

/**
 * The document page and the presentation it records, wired together.
 *
 * A read can refetch on its own (window focus, another write's invalidation), and a refetch can bring a newer
 * snapshot of the document while the reader has "Approve this document?" open. Confirm must never sign that newer
 * text: the reader pressed Approve on what they had read. The page says the document changed, holds Approve, and
 * records the newer snapshot only when the reader reloads.
 */
const OLD = 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const NEW = 'cr_cccccccccccccccccccccccccc';
const CONTEXT = 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb';

const me: Me = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true,
  superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'member' }], activeTeam: 'team-one',
};

const docAt = (content_revision: string, body: string): DocumentDetail => ({
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow', current_revision: 1,
  current_version: 1, correction: null, content_revision,
  type: 'agreement', status: 'draft', outcome: null, approved_by: null, approved_at: null, closed_by: null,
  title: 'The spec', tags: null, stakeholder: null, fields: {}, evidence: null, superseded_by: null, body,
  updated_at: '2026-09-01T00:00:00Z', bytes: body.length,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  // One version, so the history panel reads nothing of its own.
  versions: [{ path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null, updated_at: '2026-09-01T00:00:00Z', version: 1, revision: 1 }],
  sources: [],
});

/** What the store holds now; a test moves it to stand for another session revising the document. */
let stored: DocumentDetail;
/** Every write the page sent, by route, with its body. */
let writes: { route: string; body: Record<string, unknown> }[];

beforeEach(() => {
  stored = docAt(OLD, 'What the reader read.');
  writes = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.startsWith('/api/console/me')) return json(me);
    if (url.startsWith('/api/console/document/')) return json(stored);
    const route = url.replace(/^\/api\/console\//, '').replace(/\?.*$/, '');
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    writes.push({ route, body });
    if (route === 'documents/shown') return json({ ok: true, review_context: CONTEXT, content_revision: body.content_revision, recorded: true });
    return json({ ok: true, result: 'approved' });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Rendered inside an awaited `act`: the page suspends on its params until they resolve. */
async function renderPage(client: QueryClient) {
  const params = Promise.resolve({ team: 'team-one', slug: 'init-1', path: ['spec.md'] });
  await act(async () => { render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <Tooltip.Provider>
          <Suspense fallback={null}><DocumentPage params={params} /></Suspense>
        </Tooltip.Provider>
      </PeriodProvider>
    </QueryClientProvider>,
  ); });
}

describe('the document page under a refetch', () => {
  it('never lets Confirm sign a snapshot that arrived after Approve was pressed', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderPage(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    // Another session revises the document, and a background refetch brings the new text in.
    stored = docAt(NEW, 'What somebody else wrote since.');
    await act(() => client.refetchQueries({ queryKey: ['console', '/document/team-one/init-1/spec.md'] }));
    await screen.findByText('What somebody else wrote since.');

    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('This document changed while you were reading it');
    // The newer snapshot is not recorded as shown until the reader asks for it, and nothing was signed.
    expect(writes.filter((w) => w.route === 'documents/shown').map((w) => w.body.content_revision)).toEqual([OLD]);
    expect(writes.some((w) => w.route === 'documents/approve')).toBe(false);

    // Reload: the page records what it now shows, under the context it holds, and Approve is offered for that.
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(screen.queryByText('This document changed while you were reading it')).toBeNull();
    expect(writes.filter((w) => w.route === 'documents/shown').map((w) => [w.body.content_revision, w.body.review_context]))
      .toEqual([[OLD, undefined], [NEW, CONTEXT]]);
  });

  it('holds Approve beside the out-of-date banner an Approve conflict raised, and a reload clears both', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const answer = vi.mocked(fetch).getMockImplementation()!;
    const said = 'spec.md changed after this page showed it, so it was not approved. Reload to read what it says now, then approve that.';
    vi.mocked(fetch).mockImplementation(async (url, init) => (String(url).includes('/documents/approve')
      ? new Response(JSON.stringify({ conflict: 'changed', error: said }), { status: 409, headers: { 'content-type': 'application/json' } })
      : answer(url, init)));
    await renderPage(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByText(said);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(screen.queryByText(said)).toBeNull();
  });

  // zz-core records the console's ticketless presentation as covering the whole snapshot, and an approval signs its
  // review metadata with its body. So the page where Approve is offered shows every piece of it.
  it('shows the review metadata an approval signs, where Approve is offered', async () => {
    stored = { ...docAt(OLD, 'What the reader read.'), title: 'Spec: relevance that explains itself', tags: ['search', 'ranking'],
               stakeholder: 'noah.okafor@example.com', fields: { audience: 'research team', risk: 'medium' } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderPage(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(screen.getAllByText('Spec: relevance that explains itself').length).toBeGreaterThan(0);
    expect(screen.getByText('Stakeholder')).toBeInTheDocument();
    expect(screen.getByText('noah.okafor@example.com')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('search, ranking')).toBeInTheDocument();
    expect(screen.getByText('audience')).toBeInTheDocument();
    expect(screen.getByText('research team')).toBeInTheDocument();
    expect(screen.getByText('risk')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });
});
