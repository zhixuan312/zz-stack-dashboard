import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServed, useServedAddress } from '@/views/use-served';

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

describe('useServedAddress', () => {
  const DEFAULTS = { status: 'all', page: '1' };
  const filtersOfPath = (path: string) => {
    const q = new URLSearchParams(path.split('?')[1]);
    return { status: q.get('status') ?? 'all', page: String(Number(q.get('offset')) / 10 + 1) };
  };
  /** The address a page draws, as text. */
  function Drawn({ served }: { served: { path: string } | null }) {
    const [f] = useServedAddress(DEFAULTS, served, filtersOfPath);
    return <p>{`${f.status} ${f.page}`}</p>;
  }

  beforeEach(() => window.history.replaceState(null, '', '/teams?status=archived&page=2'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('draws the address the server read on the console\'s server, where the address reader answers its defaults', () => {
    expect(renderToString(<Drawn served={{ path: '/teams?status=archived&limit=10&offset=10' }} />)).toBe('<p>archived 2</p>');
    expect(renderToString(<Drawn served={null} />)).toBe('<p>all 1</p>');
  });

  it('hydrates onto the same address, then draws the address itself', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    // The server read another address than the one the browser now holds, so the hand-over is seen.
    const served = { path: '/teams?status=active&limit=10&offset=0' };
    container.innerHTML = renderToString(<Drawn served={served} />);
    const mismatches: unknown[] = [];
    await act(async () => { hydrateRoot(container, <Drawn served={served} />, { onRecoverableError: (e) => mismatches.push(e) }); });
    expect(mismatches).toEqual([]);
    expect(container.textContent).toBe('archived 2');
    container.remove();
  });

  it('draws the address itself from the first render once the browser knows it', () => {
    const { container } = render(<Drawn served={{ path: '/teams?status=active&limit=10&offset=0' }} />);
    expect(container.textContent).toBe('archived 2');
  });
});
