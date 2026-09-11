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
 * The Pointer Capture API, which jsdom does not implement at all and Radix's Select calls
 * on the pointer-down that OPENS it. Without these, no test in this repository could open
 * a Select — every attempt died on `target.hasPointerCapture is not a function` before an
 * option was ever visible.
 *
 * That gap is why a period picker wired to nothing survived for the life of the repo: the
 * control rendered, so a render test passed, and the one interaction that would have shown
 * it pushed no URL was the one interaction the harness could not perform. Stubbing them
 * costs three lines and makes every dropdown in the app testable.
 */
for (const m of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
  if (!Element.prototype[m]) {
    Element.prototype[m] = (() => false) as never;
  }
}
