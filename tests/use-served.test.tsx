import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServed } from '@/views/use-served';

/**
 * A page whose first read the console's server made follows it with `useServed`. A filter or a page of rows moves the
 * address through the router, and the server renders the page again with its own read of the new address: the browser
 * waits for that answer rather than asking the gateway the same thing beside it, which every press did twice.
 */
let urls: string[] = [];

beforeEach(() => {
  urls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ rows: [] }) } as Response;
  }));
});

afterEach(() => vi.unstubAllGlobals());

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe('useServed', () => {
  it('asks the browser for nothing while the server\'s read of the address is the latest', async () => {
    renderHook(() => useServed('/teams?page=1', true), { wrapper });
    await settle();
    expect(urls).toEqual([]);
  });

  it('asks the browser for nothing while a navigation to a new address is on its way, the server reading it', async () => {
    const { rerender } = renderHook(({ path, served, waiting }) => useServed(path, served, waiting), {
      wrapper, initialProps: { path: '/teams?page=1', served: true, waiting: false },
    });
    // The press: the address the page draws moves at once, the server's answer for it is still on its way.
    rerender({ path: '/teams?page=2', served: false, waiting: true });
    await settle();
    // The navigation commits with the server's read of the new address.
    rerender({ path: '/teams?page=2', served: true, waiting: false });
    await settle();
    expect(urls).toEqual([]);
  });

  it('reads in the browser an address the server did not read, once no navigation is on its way', async () => {
    renderHook(() => useServed('/teams?page=3', false, false), { wrapper });
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toContain('/teams?page=3');
  });

  it('reads in the browser when a Retry follows a server read that brought nothing', async () => {
    const { result } = renderHook(() => useServed('/teams?page=1', true), { wrapper });
    await settle();
    expect(urls).toEqual([]);
    act(() => result.current.follow());
    await waitFor(() => expect(urls).toHaveLength(1));
  });
});
