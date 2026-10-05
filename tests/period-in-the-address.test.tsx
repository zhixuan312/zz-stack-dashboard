import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A view's state lives in the address, and this file holds both halves of that.
 *
 * The write: a filter change keeps the reporting period, which is written with `history.replaceState`
 * and so is invisible to Next's own copy of the search params. A rebuild from that copy dropped
 * `?period=` the moment a person touched a filter — the shared link lost the window, and a reload
 * fell back to the default because the period store's memory is a module variable a reload clears.
 *
 * The read: the address is what the hook reads, so a page ships its own text. Next's `useSearchParams`
 * client-renders everything up to the nearest Suspense boundary — measured on `/teams`: LCP 2212ms
 * reading it, 632ms not. That is why the mock below offers NO `useSearchParams`: a hook that started
 * using it again would fail here rather than quietly costing every page its prerender.
 */
const nav = vi.hoisted(() => {
  const subs = new Set<() => void>();
  return {
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    notify: () => subs.forEach((f) => f()),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    push() {},
    replace(url: string) { window.history.replaceState(null, '', url); nav.notify(); },
    refresh() {}, back() {}, prefetch() {},
  }),
  useSearchParams: () => { throw new Error('the console reads the address through src/lib/address.ts'); },
}));

import { PeriodProvider, usePeriod } from '@/console/period';
import { useQueryState } from '@/components/patterns/data-table';
import { useAddressParam } from '@/lib/address';

/** The two writers a page has: the period picker in the chrome, and the page's own filters. */
function View() {
  const { period, setPeriod } = usePeriod();
  const [filters, setFilters] = useQueryState({ show: 'all' });
  const view = useAddressParam('view');
  const search = useSyncExternalStore(nav.subscribe, () => window.location.search, () => '');
  return (
    <QueryClientProvider client={useMemo(() => new QueryClient(), [])}>
      <button onClick={() => setPeriod('30d')}>30D</button>
      <button onClick={() => setFilters({ show: 'waiting' })}>Waiting on you</button>
      <button onClick={() => setFilters({ show: 'all' })}>All</button>
      <span data-testid="period">{period}</span>
      <span data-testid="show">{filters.show}</span>
      <span data-testid="view">{view ?? 'none'}</span>
      <span data-testid="search">{search}</span>
    </QueryClientProvider>
  );
}

const mount = () => render(<PeriodProvider><View /></PeriodProvider>);
const at = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => { window.history.replaceState(null, '', '/initiatives'); });

describe('a view is its address', () => {
  it('a filter change keeps the period in the address', () => {
    mount();
    fireEvent.click(screen.getByText('30D'));
    expect(at('search')).toBe('?period=30d');

    fireEvent.click(screen.getByText('Waiting on you'));
    // The address a person copies has to carry both, or the window they were looking at is not
    // what the link opens.
    expect(at('search')).toBe('?period=30d&show=waiting');
    expect(at('period')).toBe('30d');
    expect(at('show')).toBe('waiting');
  });

  it('a shared link opens on the period and the view it names, and keeps them', () => {
    window.history.replaceState(null, '', '/initiatives?period=7d&view=read&show=waiting');
    mount();
    expect(at('period')).toBe('7d');
    expect(at('view')).toBe('read');
    expect(at('show')).toBe('waiting');

    fireEvent.click(screen.getByText('Waiting on you'));
    expect(at('search')).toContain('period=7d');
  });

  it('a filter cleared back to its default leaves the address at the period alone', () => {
    mount();
    fireEvent.click(screen.getByText('30D'));
    fireEvent.click(screen.getByText('Waiting on you'));
    expect(at('search')).toBe('?period=30d&show=waiting');
    // The period is the chrome's reporting window, not one of the page's filters: a filter bar that
    // cleared it would reset the window of every page from one page's table.
    fireEvent.click(screen.getByText('All'));
    expect(at('search')).toBe('?period=30d');
  });

  it('a page reads no search params from Next, which is what costs it its prerender', () => {
    // Every render above went through `useSearchParams` throwing. Reaching this line is the proof.
    mount();
    expect(at('view')).toBe('none');
  });
});
