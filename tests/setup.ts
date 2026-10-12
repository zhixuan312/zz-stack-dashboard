import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// The assistant loads on demand (next/dynamic); its first import can take over a second while the gate also runs the
// type check and lint, so every waitFor and findBy allows five.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no ResizeObserver; Radix controls, the Segmented thumb and the charts observe their size.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

// jsdom has no IntersectionObserver; PageFrame watches its masthead to show the compact title.
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;

// The DOM stubs apply to jsdom files only; the route, tool and model tests run in node, where there is no Element.
if (typeof Element !== 'undefined') {
  // jsdom has no scrollIntoView; the command palette and Radix's Select scroll the active option into view.
  Element.prototype.scrollIntoView ??= () => {};
  // jsdom has no Pointer Capture API, which Radix's Select calls on the pointer-down that opens it. Without these no
  // test can open a Select: it dies on `hasPointerCapture is not a function` before an option is visible.
  for (const m of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
    Element.prototype[m] ??= (() => false) as never;
  }
}

// The request's cookies, for the demo policy's `current()` and the View as action. The jar is empty by default, so a
// sign-in resolved outside a request falls to the sample's own person; a test that cares about the cookie replaces this
// mock with its own, which wins.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

// The App Router's hooks, for layers rendered outside a Next request: PageFrame, DataTable and FilterBar read the path,
// the search params and the router. A test that cares about navigation mocks the module itself, which wins.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
