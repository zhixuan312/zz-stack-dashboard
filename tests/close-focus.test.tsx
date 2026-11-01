import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CloseInitiative } from '@/console/close';
import { browserStub } from './browser';
import { ME } from '../scripts/fake-gateway/people.ts';

/**
 * Done, after a close made here: the page now reads the initiative closed, so the trigger goes with the dialog. The
 * keyboard's place must land on what stands in the trigger's place, never on the body (WCAG 2.4.3).
 */
const SLUG = '2026-10-08-result-explanations';

afterEach(() => { browserStub(null, ME); });

const wrap = (client: QueryClient, ui: ReactElement) => <QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>;

describe('Close initiative, once the close is made', () => {
  it('puts focus on the status in the trigger\'s place when Done closes the dialog', async () => {
    browserStub(() => [200, { outcome: 'accepted', closedBy: 'ana@example.com', document: null }], ME);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (closed: boolean) => wrap(client, <CloseInitiative team="atlas" slug={SLUG} closed={closed} freeform={false} documents={['spec.md']} />);
    const view = render(ui(false));
    fireEvent.click(screen.getByRole('button', { name: 'Close initiative' }));
    const dialog = await screen.findByRole('dialog');
    await act(async () => { fireEvent.click(within(dialog).getByRole('radio', { name: /^Accepted/ })); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Record the close' })); });
    const done = await within(dialog).findByRole('button', { name: 'Done' });
    // The page's read comes back closed while the dialog shows the answer.
    view.rerender(ui(true));
    done.focus();
    fireEvent.click(done);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Closed as accepted.');
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(screen.queryByRole('button', { name: 'Close initiative' })).toBeNull();
  });
});
