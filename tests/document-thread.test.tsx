import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  canPostThreadMessage, canReviseFromThread, DocumentThreadComposer, DocumentThreadRevise,
  mergeThreadMessages, type ThreadMessage,
} from '@/components/DocumentThread';

// Pure logic only — no `EventSource` here (native to the browser, not something worth
// mocking to exercise the merge/ordering rules) and no network (the composer is driven
// directly through its props, the same way ApproveAction's tests drive `canApprove`
// rather than mounting a real mutation).

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function msg(seq: number, body = `m${seq}`): ThreadMessage {
  return { seq, author: { name: 'A', email: 'a@b.example.com' }, body, created_at: '2026-09-01T00:00:00Z' };
}

describe('mergeThreadMessages', () => {
  it('de-duplicates by seq — a message replayed by a reconnect must not double', () => {
    const merged = mergeThreadMessages([msg(1), msg(2)], [msg(2), msg(3)]);
    expect(merged.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  it('orders ascending by seq regardless of the order either side arrived in', () => {
    const merged = mergeThreadMessages([msg(3), msg(1)], [msg(2)]);
    expect(merged.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  it('keeps the incoming copy of a seq already held, not the stale one', () => {
    const merged = mergeThreadMessages([msg(1, 'stale')], [msg(1, 'fresh')]);
    expect(merged).toEqual([msg(1, 'fresh')]);
  });

  it('is a no-op merge of two empty lists', () => {
    expect(mergeThreadMessages([], [])).toEqual([]);
  });
});

describe('canPostThreadMessage', () => {
  it('refuses a blank body', () => {
    expect(canPostThreadMessage('')).toBe(false);
  });

  it('refuses an all-whitespace body — the route would store it as a real message', () => {
    expect(canPostThreadMessage('   \n\t  ')).toBe(false);
  });

  it('admits a body with real content', () => {
    expect(canPostThreadMessage('looks good to me')).toBe(true);
  });
});

describe('DocumentThreadComposer', () => {
  it('disables Send and never calls onSubmit for a blank draft', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DocumentThreadComposer draft="" onDraftChange={() => {}} onSubmit={onSubmit} posting={false} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await user.click(send);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables Send for an all-whitespace draft', () => {
    render(<DocumentThreadComposer draft="   " onDraftChange={() => {}} onSubmit={() => {}} posting={false} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('enables Send and calls onSubmit once for a real draft', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <DocumentThreadComposer draft="looks good" onDraftChange={() => {}} onSubmit={onSubmit} posting={false} />,
    );
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).not.toBeDisabled();
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables Send while a post is already in flight', () => {
    render(<DocumentThreadComposer draft="hello" onDraftChange={() => {}} onSubmit={() => {}} posting />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});

describe('canReviseFromThread', () => {
  it('refuses an empty thread — there is nothing to revise from', () => {
    expect(canReviseFromThread([])).toBe(false);
  });

  it('admits a thread with at least one message', () => {
    expect(canReviseFromThread([msg(1)])).toBe(true);
  });
});

describe('DocumentThreadRevise', () => {
  it('disables the control for an empty thread, and a click on a disabled button does nothing', async () => {
    const user = userEvent.setup();
    renderWithClient(<DocumentThreadRevise team="product-1" initiative="init-1" path="spec.md" disabled />);
    const button = screen.getByRole('button', { name: 'Revise from this discussion' });
    expect(button).toBeDisabled();
    await user.click(button);
    // A disabled button fires no click, so the inline confirmation never appears — this is
    // what stops an empty-thread revision from being one accidental double-click away.
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('enables the control once the thread has something in it', () => {
    renderWithClient(<DocumentThreadRevise team="product-1" initiative="init-1" path="spec.md" disabled={false} />);
    expect(screen.getByRole('button', { name: 'Revise from this discussion' })).not.toBeDisabled();
  });

  it('swaps to an inline confirmation, never a modal, on click — and names the consequence', async () => {
    const user = userEvent.setup();
    renderWithClient(<DocumentThreadRevise team="product-1" initiative="init-1" path="spec.md" disabled={false} />);
    await user.click(screen.getByRole('button', { name: 'Revise from this discussion' }));
    expect(screen.getByText(/write a new draft from this discussion and clear the current approval/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels back to the plain button without ever calling the route', async () => {
    const user = userEvent.setup();
    renderWithClient(<DocumentThreadRevise team="product-1" initiative="init-1" path="spec.md" disabled={false} />);
    await user.click(screen.getByRole('button', { name: 'Revise from this discussion' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Revise from this discussion' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });
});
