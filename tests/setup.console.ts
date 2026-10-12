/**
 * What this console's tests need beyond Meridian's own `tests/setup.ts`, which is the release's file and is left as
 * the release wrote it. `vitest.config.ts` runs both, that one first.
 */
import { createElement } from 'react';
import { vi } from 'vitest';

/**
 * `localStorage`, which this jsdom leaves present but unusable: Node 25 passes its own
 * `--localstorage-file` flag through without a path, and `window.localStorage` ends up an object
 * whose methods are missing. The console remembers a person's platform/team choice there, and its
 * own reads tolerate a browser that refuses access — so without a working store every test sees
 * only the refusal, and a scope switch that never persisted looks the same as one that did.
 *
 * A Map behind the Storage interface, so a test can assert the choice was remembered. jsdom files only: the route,
 * tool and model tests run in node, where there is no window.
 */
if (typeof window !== 'undefined' && typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

/**
 * Every render goes through a QueryClientProvider. `useDataClock` (`src/lib/api.ts`) reads the console's cache to
 * stamp a relative time, and these tests render one component at a time — with nothing above it, `useQueryClient`
 * throws before the component draws. A fresh client per render, so no test inherits another's cached data.
 */
vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>();
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const withQuery = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }) }, children);
  return {
    ...actual,
    render: (ui: React.ReactElement, options?: Parameters<typeof actual.render>[1]) =>
      actual.render(ui, { ...options, wrapper: options?.wrapper ?? withQuery }),
  };
});
