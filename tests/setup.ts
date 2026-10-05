import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements neither of these, and Radix and the charts both use them on
 * mount. Without the stubs every test that renders a Select, a Tooltip or a
 * TrendChart throws before it can assert anything.
 */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * The Pointer Capture API, which jsdom does not implement and Radix's Select calls on the
 * pointer-down that opens it. Without these stubs no test can open a Select: every attempt
 * dies on `target.hasPointerCapture is not a function` before an option is visible, so a
 * dropdown wired to nothing still passes its render test.
 */
for (const m of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
  if (!Element.prototype[m]) {
    Element.prototype[m] = (() => false) as never;
  }
}

/**
 * The App Router's hooks, for components rendered outside a Next request: Meridian's data table and filter bar read
 * the router and the search params. A test that cares about navigation mocks the module itself, which wins.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }),
}));

/* jsdom has no IntersectionObserver; Meridian's PageFrame watches its masthead to show the compact title. */
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;

/**
 * `localStorage`, which this jsdom leaves present but unusable: Node 25 passes its own
 * `--localstorage-file` flag through without a path, and `window.localStorage` ends up an object
 * whose methods are missing. The console remembers a person's platform/team choice there, and its
 * own reads tolerate a browser that refuses access — so without a working store every test sees
 * only the refusal, and a scope switch that never persisted looks the same as one that did.
 *
 * A Map behind the Storage interface, so a test can assert the choice was remembered.
 */
if (typeof globalThis.localStorage?.setItem !== 'function') {
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
