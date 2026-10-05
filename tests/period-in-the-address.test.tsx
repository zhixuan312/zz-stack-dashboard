import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reporting period lives in the address, next to every other view state.
 *
 * It is read by pages that send it to the gateway (`/overview?period=30d`) and by pages that window
 * their own rows by it, so it has to survive the other way of writing the address: a page's filters
 * rebuild the query string from the search params Next knows about, and it only knows what it last
 * NAVIGATED to. A `history.replaceState` is invisible to it, which is how a filter change used to
 * strip `?period=` — the address lost the window, a shared link stopped carrying it, and a reload
 * fell back to the default because the store's own memory is a module variable that a reload clears.
 *
 * DELIBERATE: the mock below models that contract instead of smoothing it. The shared setup's
 * `next/navigation` mock returns empty params and a no-op router, so a bug that lives in what
 * happens BETWEEN those two is invisible to it.
 */
const nav = vi.hoisted(() => {
  const subs = new Set<() => void>();
  return {
    /** What Next last navigated to — set by `replace`, never by a raw `history.replaceState`. */
    known: null as string | null,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    notify: () => subs.forEach((f) => f()),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => {
    const search = useSyncExternalStore(nav.subscribe, () => (nav.known ??= window.location.search), () => '');
    return useMemo(() => new URLSearchParams(search), [search]);
  },
  useRouter: () => ({
    push() {},
    replace(url: string) {
      const at = url.indexOf('?');
      nav.known = at < 0 ? '' : url.slice(at);
      window.history.replaceState(null, '', url);
      nav.notify();
    },
    refresh() {}, back() {}, prefetch() {},
  }),
}));

import { PeriodProvider, usePeriod } from '@/console/period';
import { useQueryState } from '@/components/patterns/data-table';

/** The two writers a page has: the period picker in the chrome, and the page's own filters. */
function View() {
  const { period, setPeriod } = usePeriod();
  const [filters, setFilters] = useQueryState({ show: 'all' });
  return (
    <QueryClientProvider client={new QueryClient()}>
      <button onClick={() => setPeriod('30d')}>30D</button>
      <button onClick={() => setFilters({ show: 'waiting' })}>Waiting on you</button>
      <button onClick={() => setFilters({ show: 'all' })}>All</button>
      <span data-testid="period">{period}</span>
      <span data-testid="show">{filters.show}</span>
    </QueryClientProvider>
  );
}

const mount = () => render(<PeriodProvider><View /></PeriodProvider>);

beforeEach(() => {
  nav.known = null;
  window.history.replaceState(null, '', '/initiatives');
});

describe('the period is a view state in the address', () => {
  it('a filter change keeps the period in the address', async () => {
    mount();
    fireEvent.click(screen.getByText('30D'));
    expect(window.location.search).toBe('?period=30d');

    fireEvent.click(screen.getByText('Waiting on you'));
    // The address a person copies has to carry both, or the window they were looking at is not
    // what the link opens.
    expect(window.location.search).toContain('period=30d');
    expect(window.location.search).toContain('show=waiting');
    expect(screen.getByTestId('period').textContent).toBe('30d');
  });

  it('a shared link opens on the period it names, and keeps it', async () => {
    window.history.replaceState(null, '', '/initiatives?period=7d');
    mount();
    expect(screen.getByTestId('period').textContent).toBe('7d');

    fireEvent.click(screen.getByText('Waiting on you'));
    expect(window.location.search).toContain('period=7d');
  });

  it('a filter cleared back to its default leaves the address at the period alone', async () => {
    mount();
    fireEvent.click(screen.getByText('30D'));
    fireEvent.click(screen.getByText('Waiting on you'));
    expect(window.location.search).toBe('?period=30d&show=waiting');
    // The period is the chrome's reporting window, not one of the page's filters: a filter bar that
    // cleared it would reset the window of every page from one page's table.
    fireEvent.click(screen.getByText('All'));
    expect(window.location.search).toBe('?period=30d');
  });
});
