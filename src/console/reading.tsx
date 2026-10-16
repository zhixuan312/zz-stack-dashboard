'use client';

import { lazy, Suspense } from 'react';

/**
 * A body of text, read behind the renderer's chunk.
 *
 * The markdown renderer is 141 KiB and is loaded lazily by design: a route that carries it in its first load goes over
 * the 820 KiB cap, and most of what a document route paints first is its header, its colophon and its tables. So the
 * body arrives as a second chunk, after the page has mounted.
 *
 * **What that costs, and why the fallback is not a fixed box.** `next/dynamic`'s `loading` is written once at module
 * scope and cannot see a prop, so it could not know how tall the body is — even though the page already does. A fixed
 * `h-64` is **256px** for a spec that measures **1,475px** at the phone width, so the card grew by more than a thousand
 * pixels when the chunk landed and everything below it moved once, after first paint. Measured at 390px on
 * `/initiatives/…/spec.md`: **CLS 0.231** against a 0.1 bar, reported with `card` as the shifted element at 0.198.
 *
 * `React.lazy` with a `<Suspense>` of its own is what lets the fallback be the body itself.
 */
const Prose = lazy(() => import('@/components/patterns/prose').then((m) => ({ default: m.Prose })));


/**
 * The body itself while the renderer's chunk is in flight — **not a placeholder, and not a second markdown renderer**:
 * it is the same `whitespace-pre-wrap` the page's Source view already draws, so the reader has the document's own words
 * at once instead of a grey block. The renderer then replaces it with the same words, laid out.
 *
 * The measured reason: the body is in hand at ~350 ms and the renderer's chunk lands at ~2,861 ms, and the phone profile's
 * largest contentful paint is *the body's first paragraph* — so a page whose body arrives before its renderer fails LCP
 * on the one element it is waiting for. Six document routes measure 2.88–3.04 s against a 2.5 s bar for exactly this.
 *
 * **And it is a trade rather than a free fix, which is why it is one line and measured rather than argued**: the plain
 * text's height is not the formatted height — headings are larger in prose and the marks go — so the swap can move the
 * page. Measured, it went the right way: the sweep that took the LCP down about 0.35 s took this page's CLS from 0.035
 * to 0.023, which is not the same as saying it cannot move. Whichever this measures, the other number is the cost.
 */
export function ReadingBody({ children }: { children: string }) {
  return (
    <Suspense fallback={<pre className="rounded-lg border border-line bg-surface-sunk p-4 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{children}</pre>}>
      <Prose>{children}</Prose>
    </Suspense>
  );
}
