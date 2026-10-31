/**
 * The deep-DOM helper: one implementation of "every element of the page", for the browser suites.
 *
 * `document.querySelectorAll('*')` stops at a shadow root, so a suite built on it never sees a custom element's own
 * content. These functions walk through open shadow roots and slots instead. Every suite injects `DEEP_SOURCE`
 * (the same code as a string) into the page, so there is one implementation, not a copy per suite:
 *
 *   await page.eval(DEEP_SOURCE);                       // once per page load, defines the functions as globals
 *   await page.eval(`deepAll().length`);                // then call them in any later expression
 *
 * Supported boundary:
 *   - Open shadow roots are entered, nested ones included, and slots are followed (`assignedSlot`).
 *   - Closed shadow roots are NOT entered: the platform gives no handle to their inside, so `deepAll` returns the host and
 *     nothing under it. An undefined custom element has no root yet and is returned as an ordinary element. A suite that
 *     must not pass silently over either reports the host as unmeasured; telling them apart is the suite's job
 *     (`customElements.get(tag)` for "defined", `shadowRoot` for "open").
 *   - Iframes are not entered. `<template>` content is inert and not entered.
 *   - Nothing here is tab order: `deepAll` is a deterministic traversal order, not the order a keyboard visits.
 *
 * The functions are self-contained (they use only DOM globals and each other), so `Function.prototype.toString` of each
 * one is valid page code. The file has no dependency.
 */

/** Where a search starts. `null` is a scope that was looked up and not found: nothing is under it. */
export type DeepRoot = Document | ShadowRoot | Element | null;

/**
 * Deterministic host-first traversal of the chosen root and reachable open roots.
 * An Element root is included. Each element is returned once. This is not tab order.
 *
 * Order: an element, then the children of its open shadow root (depth first), then its light children (depth first). A
 * Document root starts at the document element; a ShadowRoot root starts at its children and does not include its host.
 */
export function deepAll(root: DeepRoot = document): Element[] {
  const out: Element[] = [];
  const visit = (el: Element) => {
    out.push(el);
    if (el.shadowRoot) for (const child of Array.from(el.shadowRoot.children)) visit(child);
    for (const child of Array.from(el.children)) visit(child);
  };
  if (!root) return out;
  if (root instanceof Element) visit(root);
  else if (root instanceof Document) { if (root.documentElement) visit(root.documentElement); }
  else for (const child of Array.from(root.children)) visit(child);
  return out;
}

/** Resolve the active element through nested open roots. Like `document.activeElement` it is the body when nothing is focused. */
export function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/**
 * First native selector match in deepAll order, restricted to the chosen scope.
 * Combinators are evaluated within the native tree, not across shadow boundaries.
 *
 * `matches` is what stops a combinator at the boundary: `x-host .inner` never matches an element inside the root of
 * `x-host`, and a selector written for the inside (`.inner`) matches there. An Element root can match itself.
 */
export function deepQuery(selector: string, root: DeepRoot = document): Element | null {
  for (const el of deepAll(root)) if (el.matches(selector)) return el;
  return null;
}

/**
 * Every native selector match in deepAll order, restricted to the chosen scope: `querySelectorAll` through open roots.
 * A control inside a web component is found under a light-DOM container by searching from it, `deepQueryAll('button',
 * deepQuery('aside'))`, since `aside button` cannot cross the component's root.
 */
export function deepQueryAll(selector: string, root: DeepRoot = document): Element[] {
  return deepAll(root).filter((el) => el.matches(selector));
}

/** Prefer assignedSlot; otherwise parentElement; otherwise the enclosing open root's host. */
export function deepParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot;
  if (el.parentElement) return el.parentElement;
  const top = el.getRootNode();
  return top instanceof ShadowRoot ? top.host : null;
}

/**
 * An element's text as rendered: a slot contributes the text of what is assigned to it, or its fallback content when
 * nothing is. A web component's button is usually named by the text slotted into its host, which `textContent` of the
 * button inside the root does not include.
 */
export function deepText(el: Element): string {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.textContent ?? '';
    else if (n instanceof HTMLSlotElement) {
      const assigned = n.assignedNodes({ flatten: true });
      if (!assigned.length) out += deepText(n);
      else for (const a of assigned) out += a.nodeType === 3 ? (a.textContent ?? '') : a instanceof Element ? deepText(a) : '';
    } else if (n instanceof Element) out += deepText(n);
  }
  return out;
}

/** `closest()` across open roots and slots: the nearest of `el` and its composed ancestors that matches `selector`. */
export function deepClosest(el: Element, selector: string): Element | null {
  for (let n: Element | null = el; n; n = deepParent(n)) if (n.matches(selector)) return n;
  return null;
}

/**
 * How focus could mark an element, as one string: its outline, its shadow and its borders. A suite records it unfocused
 * so `ringed` tells a ring from a decoration that is always there; the audit and the keyboard walk read the same one.
 */
export function ringSignature(c: CSSStyleDeclaration): string {
  return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopStyle, c.borderTopWidth, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor].join('|');
}

/**
 * Whether focus gave `n` a ring: an outline, a coloured shadow or a border that was not there unfocused (`before`, its
 * `ringSignature` then). With no record, any drawn outline or coloured shadow counts.
 */
export function ringed(n: Element, before: string | undefined): boolean {
  const c = getComputedStyle(n);
  const outline = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0, shadow = /rgb|oklch|oklab|color/.test(c.boxShadow) && c.boxShadow !== 'none';
  if (!before) return outline || shadow;
  const b = before.split('|'), now = ringSignature(c).split('|');
  const outlineMoved = now.slice(0, 3).join('|') !== b.slice(0, 3).join('|'), shadowMoved = now[3] !== b[3], borderMoved = now.slice(4).join('|') !== b.slice(4).join('|') && c.borderTopStyle !== 'none';
  return (outline && outlineMoved) || (shadow && shadowMoved) || borderMoved;
}

/**
 * Where a focused element's ring may be drawn: the element, its frame and the frame's frame; inside a shadow root every
 * composed ancestor up to the outermost host, since the host is where `:host(:focus-within)` draws.
 */
export function ringChain(el: Element): Element[] {
  const chain = [el];
  if (el.getRootNode() instanceof ShadowRoot) {
    for (let n = deepParent(el); n; n = deepParent(n)) { chain.push(n); if (!(n.getRootNode() instanceof ShadowRoot)) break; }
  } else {
    const p = deepParent(el); if (p) chain.push(p);
    const g = p && deepParent(p); if (g) chain.push(g);
  }
  return chain;
}

/** The functions as page code, for `page.eval`: function declarations, so they become globals of the page. */
export const DEEP_SOURCE: string = [deepAll, deepActive, deepQuery, deepQueryAll, deepParent, deepText, deepClosest, ringSignature, ringed, ringChain].map((f) => f.toString()).join('\n');
