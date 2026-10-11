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
 * `React.lazy` with a `<Suspense>` of its own is what lets the fallback see `bytes`. **The estimate only has to be the
 * right order of magnitude** — a placeholder a little short moves things a little, where 256px for 1,475px moves them a
 * lot — so it is a rough constant rather than a calculation anyone has to keep true.
 */
export const Prose = lazy(() => import('@/components/patterns/prose').then((m) => ({ default: m.Prose })));

/** About 26 bytes of markdown to a rendered pixel, taken from a measurement rather than guessed: a 38 KB spec renders
 *  1,475px in a 2/3 cell at 390px wide. Clamped, so a pathological body cannot reserve an unbounded page. */
export function BodyRoom({ bytes }: { bytes: number }) {
  const height = Math.min(Math.max(320, Math.round(bytes / 26)), 20000);
  return <div aria-hidden className="shimmer block rounded-md" style={{ height }} />;
}

/** The body, with its room held until the renderer's chunk lands. `bytes` is the body's own length — `doc.bytes` for a
 *  document, `content.length` for a skill's text and a reference's — and nothing here needs it to be exact. */
export function ReadingBody({ bytes, children }: { bytes: number; children: string }) {
  return <Suspense fallback={<BodyRoom bytes={bytes} />}><Prose>{children}</Prose></Suspense>;
}
