import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CloseInitiative } from '@/console/close';
import type { Me } from '@/lib/api-shapes';
import { InitiativeClose } from '@/views/pages/initiative';
import { close } from '../scripts/fake-gateway/work-initiatives.ts';
import { initiativeDetail } from '../scripts/fake-gateway/work.ts';

/**
 * Close, on an initiative's page (Task I-106, AC-5.6): the three choices a person makes each submit the `CloseInput`
 * the spec maps them to and never an outcome; what the dialog then says is the outcome the gateway answered; a refusal
 * keeps what the person typed; a close somebody made first is said to be so. The gateway is the fake's own `close()`,
 * which answers as the platform decides a close, unless a case needs an answer it would not give.
 */
const ME: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};
const READY = '2026-10-08-result-explanations';
const FREEFORM = '2026-09-05-research-notes';
const CLOSED = '2026-09-12-onboarding-revamp';

beforeAll(() => {
  // Radix's Select scrolls its chosen option into view and asks for pointer capture, neither of which jsdom has.
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});
afterEach(() => { vi.unstubAllGlobals(); });

type Sent = { path: string; body: Record<string, unknown> };

/** The browser's writes, answered by `answer` (the fake's close by default), each one kept in `sent`. */
function gateway(answer?: (sent: Sent) => [number, unknown]) {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://console.test').pathname.replace('/api/console', '');
    const one = { path, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> };
    sent.push(one);
    const [, team, slug] = /^\/initiatives\/([^/]+)\/([^/]+)\/close$/.exec(path) ?? [];
    const [status, body] = answer ? answer(one) : close(ME, team, slug, one.body);
    return { ok: status < 300, status, json: async () => body } as unknown as Response;
  }));
  return sent;
}

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}

const docsOf = (slug: string) => initiativeDetail('atlas', slug)!.documents.filter((d) => !d.path.startsWith('sources/') && d.type !== 'handover').map((d) => d.path);

/** Opens the dialog and chooses `choice`, answering with the dialog. */
async function choose(choice: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Close initiative' }));
  const dialog = await screen.findByRole('dialog');
  await act(async () => { fireEvent.click(within(dialog).getByRole('radio', { name: choice })); });
  return dialog;
}

const submit = async (dialog: HTMLElement) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Record the close' })); });
};

describe('the three choices each submit the CloseInput the spec maps them to', () => {
  it('accepted is finished, with no sign-off field and no outcome', async () => {
    const sent = gateway();
    mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
    const dialog = await choose(/^Accepted/);
    await submit(dialog);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ path: `/initiatives/atlas/${READY}/close`, body: { disposition: 'finished' } });
  });

  it('delivered is finished with the person\'s reason nobody signed off, and asks for it first', async () => {
    const sent = gateway();
    mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
    const dialog = await choose(/^Delivered/);
    expect(within(dialog).getByRole('button', { name: 'Record the close' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Why nobody signed it off/), { target: { value: '  The stakeholder left the team.  ' } });
    await submit(dialog);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toEqual({ disposition: 'finished', no_signoff_reason: 'The stakeholder left the team.' });
  });

  it('abandoned is abandoned, the document it stops at the platform\'s to choose', async () => {
    const sent = gateway();
    mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
    const dialog = await choose(/^Abandoned/);
    await submit(dialog);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toEqual({ disposition: 'abandoned' });
  });

  it('never names an outcome or a closer, whichever is chosen', async () => {
    const sent = gateway(() => [200, { outcome: 'accepted', closedBy: ME.email, document: 'review.md' }]);
    for (const choice of [/^Accepted/, /^Delivered/, /^Abandoned/]) {
      const { unmount } = mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
      const dialog = await choose(choice);
      const reason = within(dialog).queryByLabelText(/Why nobody signed it off/);
      if (reason) fireEvent.change(reason, { target: { value: 'Nobody was left to sign.' } });
      await submit(dialog);
      unmount();
    }
    await waitFor(() => expect(sent).toHaveLength(3));
    for (const { body } of sent) {
      expect(body).not.toHaveProperty('outcome');
      expect(body).not.toHaveProperty('closed_by');
    }
  });

  it('a close with no flow names the document it finishes on, of those a close may land on', async () => {
    const sent = gateway();
    mount(<CloseInitiative team="atlas" slug={FREEFORM} closed={false} freeform documents={docsOf(FREEFORM)} />);
    const dialog = await choose(/^Accepted/);
    expect(within(dialog).getByRole('button', { name: 'Record the close' })).toBeDisabled();
    const picker = within(dialog).getByRole('combobox');
    await act(async () => { fireEvent.keyDown(picker, { key: 'Enter' }); });
    await act(async () => { fireEvent.click(await screen.findByRole('option', { name: 'ideas.md' })); });
    await submit(dialog);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toEqual({ disposition: 'finished', document: 'ideas.md' });
  });
});

describe('what the dialog says after the gateway answers', () => {
  it('shows the outcome the gateway answered, not the choice made', async () => {
    // A choice of Accepted the platform recorded otherwise: the dialog says what was recorded.
    gateway(() => [200, { outcome: 'delivered', closedBy: 'mei.tanaka@example.com', document: 'review.md' }]);
    mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
    const dialog = await choose(/^Accepted/);
    await submit(dialog);
    const result = await waitFor(() => {
      const found = dialog.querySelector('[data-close-result]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(result.textContent).toBe('Closed as delivered by mei.tanaka@example.com, on review.md.');
  });

  it('a refusal is said in the dialog, and what the person typed is kept', async () => {
    gateway(() => [400, { error: 'ERROR: 2026-10-08-result-explanations cannot be closed as finished: approve review is not approved.' }]);
    mount(<CloseInitiative team="atlas" slug={READY} closed={false} freeform={false} documents={docsOf(READY)} />);
    const dialog = await choose(/^Delivered/);
    fireEvent.change(within(dialog).getByLabelText(/Why nobody signed it off/), { target: { value: 'The stakeholder left the team.' } });
    await submit(dialog);
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('approve review is not approved'));
    expect(within(dialog).getByLabelText(/Why nobody signed it off/)).toHaveValue('The stakeholder left the team.');
    expect(within(dialog).getByRole('radio', { name: /^Delivered/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Record the close' })).toBeEnabled();
  });

  it('a 409 says somebody closed it first, with the gateway\'s sentence, and keeps the text', async () => {
    // The fake answers a closed initiative's close with its conflict, as the route does.
    gateway();
    mount(<CloseInitiative team="atlas" slug={CLOSED} closed={false} freeform={false} documents={docsOf(CLOSED)} />);
    const dialog = await choose(/^Delivered/);
    fireEvent.change(within(dialog).getByLabelText(/Why nobody signed it off/), { target: { value: 'Shipped without a review.' } });
    await submit(dialog);
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/^Somebody closed it first\. /);
    expect(alert).toHaveTextContent('The first decision stands.');
    expect(within(dialog).getByLabelText(/Why nobody signed it off/)).toHaveValue('Shipped without a review.');
    expect(within(dialog).getByRole('button', { name: 'Record the close' })).toBeDisabled();
  });
});

describe('Close on an initiative\'s page', () => {
  const served = (slug: string, team: string | null = 'atlas') => ({ state: 'ok' as const, data: initiativeDetail('atlas', slug)!, team, at: '2026-10-15T00:00:00Z' });

  it('is offered on an open initiative of the team the person acts for', () => {
    gateway();
    mount(<InitiativeClose team="atlas" slug={READY} served={served(READY)} />);
    expect(screen.getByRole('button', { name: 'Close initiative' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('is not offered once it is closed, nor on another team\'s initiative, nor before the read', () => {
    gateway();
    const { unmount } = mount(<InitiativeClose team="atlas" slug={CLOSED} served={served(CLOSED)} />);
    expect(screen.queryByRole('button', { name: 'Close initiative' })).toBeNull();
    unmount();
    const other = mount(<InitiativeClose team="atlas" slug={READY} served={served(READY, 'beacon')} />);
    expect(screen.queryByRole('button', { name: 'Close initiative' })).toBeNull();
    other.unmount();
    mount(<InitiativeClose team="atlas" slug={READY} served={{ state: 'slow' }} />);
    expect(screen.queryByRole('button', { name: 'Close initiative' })).toBeNull();
  });
});
