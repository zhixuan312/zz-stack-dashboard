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
