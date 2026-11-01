import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * `useConsoleMutation` sends a write once while it is out: a second press of the same write, which a keyboard reaches
 * before the busy state is drawn, sends nothing. A different write from the same hook (another row, another role) is
 * its own write and goes.
 */
afterEach(() => { vi.unstubAllGlobals(); });

/** Every write sent, each answered 200 once `release` is called. */
function gateway() {
  const sent: unknown[] = [];
  const waiting: (() => void)[] = [];
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Promise<Response>((resolve) => {
      waiting.push(() => resolve({ ok: true, status: 200, json: async () => ({ ok: true, result: 'done' }) } as unknown as Response));
    });
  }));
  const release = async () => { await act(async () => { waiting.splice(0).forEach((go) => go()); }); };
  return { sent, release };
}

function hook() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useConsoleMutation<{ ok: true; result: string }, { email: string; role: string }>('/settings/team/members'), { wrapper }).result;
}

describe('useConsoleMutation', () => {
  it('sends the same write once while it is out, and again once it has answered', async () => {
    const { sent, release } = gateway();
    const result = hook();
    const first = result.current.mutateAsync({ email: 'ana@example.com', role: 'member' });
    void result.current.mutateAsync({ email: 'ana@example.com', role: 'member' });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await release();
    await expect(first).resolves.toEqual({ ok: true, result: 'done' });
    expect(sent).toHaveLength(1);

    const again = result.current.mutateAsync({ email: 'ana@example.com', role: 'member' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await release();
    await expect(again).resolves.toEqual({ ok: true, result: 'done' });
  });

  it('sends a different write from the same hook while the first is out', async () => {
    const { sent, release } = gateway();
    const result = hook();
    const add = result.current.mutateAsync({ email: 'ana@example.com', role: 'member' });
    const role = result.current.mutateAsync({ email: 'ben@example.com', role: 'admin' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await release();
    await expect(Promise.all([add, role])).resolves.toHaveLength(2);
    expect(sent).toEqual([{ email: 'ana@example.com', role: 'member' }, { email: 'ben@example.com', role: 'admin' }]);
  });
});
