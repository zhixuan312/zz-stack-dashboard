import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Query } from '@/console/query';
import { ApiError } from '@/lib/api';

/**
 * A panel's failed read keeps its error and its Retry where they are while it reads again, as the pages' own Retry does
 * since Task I-150 (`useServed`): a read something else starts leaves Retry as it is, and only the person's own press
 * makes it busy. A busy Button is disabled, and a focused control that becomes disabled loses focus, which is a keyboard
 * user's place (Harbormaster #3763).
 */
function Panel({ read, team = 'atlas' }: { read: () => Promise<string[]>; team?: string }) {
  const list = useQuery<string[], ApiError>({ queryKey: ['members', team], queryFn: read, retry: false });
  return <Query query={list} what="The list">{(rows) => <p>{rows.join(', ')}</p>}</Query>;
}

function held() {
  const waiting: ((error: ApiError) => void)[] = [];
  const read = () => new Promise<string[]>((_, reject) => { waiting.push(reject); });
  const fail = async (message: string) => { await act(async () => { waiting.splice(0).forEach((reject) => reject(new ApiError(503, message))); }); };
  return { read, fail, sent: () => waiting.length };
}

describe('a panel whose read failed', () => {
  it('keeps its error and the same Retry, not busy, while a read it did not ask for runs', async () => {
    const client = new QueryClient();
    const { read, fail, sent } = held();
    render(<QueryClientProvider client={client}><Panel read={read} /></QueryClientProvider>);
    await fail('The gateway is not answering.');
    const retry = await screen.findByRole('button', { name: 'Retry' });
    retry.focus();

    act(() => { void client.invalidateQueries({ queryKey: ['members', 'atlas'] }); });
    await waitFor(() => expect(sent()).toBe(1));
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry);
    expect(retry).not.toHaveAttribute('aria-busy');
    expect(retry).not.toBeDisabled();
    expect(document.activeElement).toBe(retry);
    expect(screen.getByText('The gateway is not answering.')).toBeInTheDocument();
    await fail('Still not answering.');
    expect(await screen.findByText('Still not answering.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry);
  });

  it('makes Retry busy for the person\'s own press, until the read answers', async () => {
    const client = new QueryClient();
    const { read, fail, sent } = held();
    render(<QueryClientProvider client={client}><Panel read={read} /></QueryClientProvider>);
    await fail('The gateway is not answering.');
    const retry = await screen.findByRole('button', { name: 'Retry' });

    fireEvent.click(retry);
    await waitFor(() => expect(sent()).toBe(1));
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry);
    expect(retry).toHaveAttribute('aria-busy', 'true');
    await fail('Still not answering.');
    expect(await screen.findByText('Still not answering.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toHaveAttribute('aria-busy');
  });

  it('keeps no failure across a change of what it reads: another team\'s first read is drawn as loading', async () => {
    const client = new QueryClient();
    const { read, fail, sent } = held();
    const view = render(<QueryClientProvider client={client}><Panel read={read} /></QueryClientProvider>);
    await fail('The gateway is not answering.');
    await screen.findByRole('button', { name: 'Retry' });

    view.rerender(<QueryClientProvider client={client}><Panel read={read} team="beacon" /></QueryClientProvider>);
    await waitFor(() => expect(sent()).toBe(1));
    expect(screen.queryByText('The gateway is not answering.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
