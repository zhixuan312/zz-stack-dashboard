import { act, fireEvent, render, screen } from '@testing-library/react';
import { use, useEffect, useInsertionEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A search box over a view whose state is its address keeps every key, including one typed while its own write is
 * still navigating.
 *
 * The box is the release's `useSearchDraft` over this console's `useQueryState`, and the draft follows the applied
 * search whenever that changes. So the applied search may change only when the address really did: a write is shown
 * at once and stays shown until the address is read again. Between the navigation committing and the address being
 * announced, the hook used to hand back the address as it was before the write for one render, and the draft took
 * that render for a change from elsewhere and threw away what had been typed since. Measured in a browser on
 * `/teams`: a key typed up to 40 ms after the write was lost in 15 of 24 trials.
 *
 * The router below is Next's as far as an address is concerned, which is what the fault turns on: `replace` is a
 * state update inside the caller's transition, the transition waits on the server, and `window.location` moves when
 * that state commits, not when `replace` is called.
 */
const next = vi.hoisted(() => ({ replace: (url: string) => { void url; }, answer: () => {} }));

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push() {}, replace: (url: string) => next.replace(url), refresh() {}, back() {}, prefetch() {} }),
  useSearchParams: () => { throw new Error('the console reads the address through src/lib/address.ts'); },
}));

import { useQueryState, useSearchDraft } from '@/components/patterns/data-table';

type Navigation = { url: string | null; served: Promise<void> };

function Router({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<Navigation>({ url: null, served: Promise.resolve() });
  useEffect(() => { next.replace = (url) => setNav({ url, served: new Promise((resolve) => { next.answer = resolve; }) }); }, []);
  if (nav.url !== null) use(nav.served);
  useInsertionEffect(() => { if (nav.url !== null) window.history.replaceState(null, '', nav.url); }, [nav]);
  return children;
}

/** Every applied search the view was rendered with, in order: a value handed back for one render never reaches the screen. */
const rendered: string[] = [];

function Search() {
  const [f, set] = useQueryState({ q: '', status: 'all', page: '1' });
  if (rendered[rendered.length - 1] !== f.q) rendered.push(f.q);
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  return (
    <>
      <input role="searchbox" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => set({ status: 'active', page: '1' })}>Active</button>
      <span data-testid="applied">{f.q}</span>
      <span data-testid="status">{f.status}</span>
    </>
  );
}

const box = () => screen.getByRole('searchbox') as HTMLInputElement;
const type = (text: string) => act(() => { fireEvent.change(box(), { target: { value: text } }); });
const pause = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const served = () => act(async () => { next.answer(); await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => { vi.useFakeTimers(); window.history.replaceState(null, '', '/teams'); rendered.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('a search box over the address', () => {
  it('keeps a key typed while its own write is navigating', async () => {
    render(<Router><Search /></Router>);
    await type('at');
    await pause(250);
    // The write is on its way: shown at once, and the address not yet moved.
    expect(screen.getByTestId('applied').textContent).toBe('at');
    expect(window.location.search).toBe('');

    await type('atl');
    await served();
    expect(window.location.search).toBe('?q=at');
    expect(box().value).toBe('atl');

    await pause(250);
    await served();
    expect(window.location.search).toBe('?q=atl');
    expect(box().value).toBe('atl');
  });

  it('never shows the search as it was before the write once the write is shown', async () => {
    render(<Router><Search /></Router>);
    await type('at');
    await pause(250);
    await served();
    expect(window.location.search).toBe('?q=at');
    expect(rendered).toEqual(['', 'at']);
  });

  it('still follows the address when something else moves it', async () => {
    render(<Router><Search /></Router>);
    await type('at');
    await pause(250);
    await served();
    // Back, or a link: the address moves without this hook writing it.
    await act(async () => { window.history.replaceState(null, '', '/teams'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByTestId('applied').textContent).toBe('');
    expect(box().value).toBe('');
  });

  it('shows a filter the moment it is pressed and keeps it when the navigation lands', async () => {
    render(<Router><Search /></Router>);
    await act(async () => { fireEvent.click(screen.getByText('Active')); });
    expect(screen.getByTestId('status').textContent).toBe('active');
    await served();
    expect(window.location.search).toBe('?status=active');
    expect(screen.getByTestId('status').textContent).toBe('active');
  });
});
