import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import type { InitiativeDetail, Me } from '@/lib/api-shapes';
import { initiativeContext, type InitiativeRead } from '@/views/initiative-context';
import { InitiativeClose, InitiativeView } from '@/views/pages/initiative';
import { close } from '../scripts/fake-gateway/work-initiatives.ts';
import { INITIATIVES, initiativeDetail } from '../scripts/fake-gateway/work.ts';

/**
 * An initiative with nothing written in it (review round 1, R1-C5, AC-5.8): it is listed, so its page opens, drawing
 * no documents and the close it may take, which is an abandon; the platform refuses a finished close of work with
 * nothing in it. The page's read is the fake's own answer, and the close the fake's `close()`, as the gateway answers
 * them. Both an empty initiative on a flow (the fake's own) and one with no flow are drawn.
 */
const AT = '2026-10-18T00:00:00Z';
const ON_A_FLOW = INITIATIVES.find((i) => i.documents === 0 && !i.closed)!;
const FREEFORM = '2026-09-05-research-notes';

afterEach(() => vi.unstubAllGlobals());

type Sent = { path: string; body: Record<string, unknown> };

/** The browser's reads and writes: the page's read answered with `detail`, a close with the fake's own, each kept. */
function gateway(me: Me, detail: InitiativeDetail) {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://console.test').pathname.replace('/api/console', '');
    const write = /^\/initiatives\/([^/]+)\/([^/]+)\/close$/.exec(path);
    if (!write) return { ok: true, status: 200, json: async () => detail } as unknown as Response;
    const one = { path, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> };
    sent.push(one);
    const [status, body] = close(me, write[1], write[2], one.body);
    return { ok: status < 300, status, json: async () => body } as unknown as Response;
  }));
  return sent;
}

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}

/** The page as its route composes it: the masthead's close, then the body, from one served read. */
async function draw(detail: InitiativeDetail) {
  const served: InitiativeRead = { state: 'ok', data: detail, team: detail.team, at: AT };
  await act(async () => {
    mount(<><InitiativeClose team={detail.team} slug={detail.slug} served={served} /><InitiativeView team={detail.team} slug={detail.slug} served={served} /></>);
  });
}

const meOf = (team: string): Me => ({
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: team, role: 'admin' }], activeTeam: team,
});

describe('an initiative with nothing written in it', () => {
  const cases: [string, InitiativeDetail][] = [
    ['on a flow', initiativeDetail(ON_A_FLOW.team, ON_A_FLOW.slug)!],
    ['with no flow', { ...initiativeDetail('atlas', FREEFORM)!, documents: [] }],
  ];

  it.each(cases)('%s: its page draws no documents, and the close it may take', async (_, detail) => {
    expect(detail.documents).toEqual([]);
    gateway(meOf(detail.team), detail);
    await draw(detail);
    expect(screen.getByText('Nothing written yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close initiative' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('radio')).toHaveLength(1);
    expect(within(dialog).getByRole('radio', { name: /^Abandoned/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: /^Accepted/ })).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: /^Delivered/ })).toBeNull();
    expect(dialog.textContent).toContain('Nothing has been written in it, so it can only be abandoned.');
  });

  it('is abandoned from its page, on no document, and the dialog says what the platform recorded', async () => {
    const detail = cases[0][1];
    const sent = gateway(meOf(detail.team), detail);
    await draw(detail);
    fireEvent.click(screen.getByRole('button', { name: 'Close initiative' }));
    const dialog = await screen.findByRole('dialog');
    await act(async () => { fireEvent.click(within(dialog).getByRole('radio', { name: /^Abandoned/ })); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Record the close' })); });
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ path: `/initiatives/${detail.team}/${detail.slug}/close`, body: { disposition: 'abandoned' } });
    const said = await within(dialog).findByText((_, el) => el?.hasAttribute('data-close-result') ?? false);
    expect(said.textContent).toBe('Closed as abandoned by ava.lindqvist@example.com.');
  });

  it('tells the assistant it has nothing written, and that the close a person may make is to abandon it', () => {
    const context = initiativeContext(cases[0][1], { updatedAt: AT, now: AT });
    expect(context.unknowns).toContain('Nothing has been written in it yet, so the close a person may make is to abandon it.');
  });
});
