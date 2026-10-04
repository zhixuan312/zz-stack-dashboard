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
